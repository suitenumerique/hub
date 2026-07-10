import {
  ClientEvent,
  Direction,
  EventTimeline,
  EventType,
  type IRoomTimelineData,
  KnownMembership,
  MatrixError,
  type MatrixClient,
  type MatrixEvent,
  NotificationCountType,
  Preset,
  RelationType,
  type Room,
  RoomEvent,
  SyncState,
  type SyncStateData,
  type Thread,
  ThreadEvent,
} from "matrix-js-sdk/lib/matrix";
import { HttpApiEvent } from "matrix-js-sdk/lib/http-api";
import { type ReactionEventContent } from "matrix-js-sdk/lib/types";

import { type IdTokenClaims } from "oidc-client-ts";

import { emojiToCodepoints } from "@/features/chat/fluentEmoji";
import { toggleReaction } from "@/features/chat/reactions";
import {
  type MatrixDriverSettings,
  parseMatrixDriverSettings,
  TCHAP_HOMESERVER_LIST,
} from "@/features/matrix/config";
import { initClient, startClient } from "@/features/matrix/initMatrix";
import { MatrixUserInterface } from "@/features/matrix/types";
import {
  buildOidcTokenRefreshFunction,
  completeOidcLogin,
  getOIDCAuthUrl,
  getUserIdFromAccessToken,
} from "@/features/matrix/utils/auth";
import { fetchHomeserverForEmail } from "@/features/matrix/utils/autodiscovery";
import { hashAvatarColor } from "@/features/ui/components/avatar/palette";

import {
  ChatConnectionState,
  ChatEvent,
  ChatEventListener,
  ChatUserFilters,
  GetChatThreadParams,
  GetChatMessagesParams,
  MarkChatThreadReadParams,
  SendChatMessageParams,
  SendChatThreadReplyParams,
  StartChatThreadParams,
  ToggleChatReactionParams,
  ToggleChatThreadReactionParams,
} from "../Driver";
import {
  AccountId,
  ChatInvitation,
  ChatLocalUser,
  ChatMessage,
  ChatMessageAuthor,
  ChatMessagesPage,
  ChatReaction,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
  ChatUnread,
  ChatUser,
  LocalChat,
  LocalChatSections,
  User,
} from "../types";
import { MockDriver } from "./MockDriver";

/** Matches `getChatMessages`'s default; the homeserver may clamp it lower. */
const DEFAULT_CHAT_PAGE_SIZE = 50;

// A generous fetch limit is requested from the user directory and the filtered
// list sliced to a small display count, so removing self/excluded never starves
// the New Chat dropdown.
const PEOPLE_SEARCH_FETCH_LIMIT = 20;
const PEOPLE_SEARCH_DISPLAY_LIMIT = 8;

type ReactionRelations = NonNullable<
  ReturnType<Room["relations"]["getChildEventsForEvent"]>
>;

// localStorage keys owned by this driver. Token persistence lives in the
// driver itself — there is no separate store module; everything else flows
// through React Query.
const STORAGE = {
  user: "matrixUser",
  // Everything needed to refresh the OIDC access token on a later page load.
  oidc: "matrixOidc",
  oidcState: "oidc_state",
} as const;

/** OIDC session data persisted so tokens can be refreshed after a reload. */
type StoredOidc = {
  clientId: string;
  issuer: string;
  idToken: string;
  idTokenClaims: IdTokenClaims;
  redirectUri: string;
};
const OIDC_HS_KEY = "oidc_hs";
const SYNC_STORE_DB_NAME = "matrix-web-sync-store";
const CRYPTO_STORE_DB_NAME = "crypto-store";

const storageKey = (
  accountId: AccountId,
  key: string,
  owner?: string | null,
): string => {
  const ownedKey = owner ? `${key}:${owner}` : key;
  return accountId === "default" ? ownedKey : `${ownedKey}:${accountId}`;
};

const isMatrixSessionInvalidError = (error: unknown): boolean => {
  if (!(error instanceof MatrixError)) {
    return false;
  }
  return (
    error.errcode === "M_UNKNOWN_TOKEN" ||
    error.httpStatus === 401 ||
    (error.httpStatus === 503 &&
      /introspect the access token/i.test(error.message))
  );
};

const isRecoverableMatrixPaginationError = (error: unknown): boolean => {
  if (!(error instanceof MatrixError) || isMatrixSessionInvalidError(error)) {
    return false;
  }
  return error.httpStatus === 403 || error.httpStatus === 404;
};

const toChatUser = (user: MatrixUserInterface): ChatLocalUser => ({
  userId: user.mxId,
  accessToken: user.accessToken,
  refreshToken: user.refreshToken,
});

/**
 * The members that make up a conversation: everyone except the connected user
 * whose membership is `join` or `invite`. Left/banned members are excluded so
 * they neither inflate a group nor linger in its name; invited members are kept
 * so a just-created conversation already shows its counterpart(s) before they
 * accept. Single source for `kind`/`name` in `matrixRoomToLocalChat` and the set
 * `getChatForUsers` matches against, so the two can never disagree.
 */
const roomOtherMembers = (room: Room, currentUserId: string | undefined) =>
  room
    .getMembers()
    .filter(
      (member) =>
        member.userId !== currentUserId &&
        (member.membership === KnownMembership.Join ||
          member.membership === KnownMembership.Invite),
    );

/** Order- and duplicate-independent key for comparing two participant sets. */
const participantSetKey = (userIds: string[]): string =>
  [...new Set(userIds)].sort().join(" ");

/** The room's explicit `m.room.name`, when set to a non-empty value. */
const explicitRoomName = (room: Room): string | undefined => {
  const name = room.currentState
    ?.getStateEvents(EventType.RoomName, "")
    ?.getContent<{ name?: string }>()?.name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
};

/** Maps a joined room to a normal conversation row. */
const matrixJoinedRoomToLocalChat = (
  room: Room,
  currentUserId: string | undefined,
): LocalChat => {
  const others = roomOtherMembers(room, currentUserId);
  const participantIds = others.map((member) => member.userId);
  // Direct = exactly one counterpart (join or invite). Based on the participant
  // set rather than the joined-member count, so a just-created DM stays direct
  // before its invitee accepts.
  const isDirect = participantIds.length === 1;
  const otherNames = others.map((member) => member.name || member.userId);
  const timestamp = room.getLastActiveTimestamp();

  // A 1:1 is identified by the other person and ignores any room name (DMs
  // aren't renameable). A group uses its explicit name when set, otherwise the
  // members' display names so the header/list show everyone — not just the
  // first participant.
  const name = isDirect
    ? otherNames[0] || participantIds[0] || room.roomId
    : explicitRoomName(room) || otherNames.join(", ") || room.roomId;

  return {
    id: room.roomId,
    name,
    ...(timestamp > 0
      ? { lastActivityAt: new Date(timestamp).toISOString() }
      : {}),
    section: "all",
    kind: isDirect ? "direct" : "group",
    participantIds,
    visual: isDirect ? { kind: "initials" } : { kind: "icon", icon: "groups" },
    membership: "join",
  };
};

/**
 * The current user's `m.room.member` event in a room, when the SDK has it. For
 * an invited room this is the invitation event itself: its sender is the
 * inviter, its content carries the optional reason and direct marker, and its
 * timestamp is when the invite arrived.
 */
const myMemberEvent = (
  room: Room,
  currentUserId: string | undefined,
): MatrixEvent | undefined =>
  currentUserId ? room.getMember(currentUserId)?.events.member : undefined;

/**
 * Invitation metadata derived from the current user's invite membership event,
 * plus the raw event timestamp the row uses for `lastActivityAt`/list sorting.
 * Best-effort: an invite room exposes only stripped state, so each field is
 * filled only when present.
 */
const readInviteMetadata = (
  room: Room,
  currentUserId: string | undefined,
): { invitation: ChatInvitation; invitedAtTs: number } => {
  const memberEvent = myMemberEvent(room, currentUserId);
  const inviterId = memberEvent?.getSender();
  const content =
    memberEvent?.getContent<{ reason?: string; is_direct?: boolean }>() ?? {};
  const invitedAtTs = memberEvent?.getTs() ?? 0;
  const inviterName = inviterId ? room.getMember(inviterId)?.name : undefined;

  const invitation: ChatInvitation = {
    ...(inviterId ? { inviterId } : {}),
    ...(inviterName ? { inviterName } : {}),
    ...(typeof content.reason === "string" ? { reason: content.reason } : {}),
    ...(invitedAtTs > 0
      ? { invitedAt: new Date(invitedAtTs).toISOString() }
      : {}),
    ...(content.is_direct === true ? { isDirect: true } : {}),
  };
  return { invitation, invitedAtTs };
};

/** Maps an invited room to an invitation chat row (see {@link readInviteMetadata}). */
const matrixInviteRoomToLocalChat = (
  room: Room,
  currentUserId: string | undefined,
): LocalChat => {
  const { invitation, invitedAtTs } = readInviteMetadata(room, currentUserId);
  return {
    id: room.roomId,
    name:
      room.name ||
      invitation.inviterName ||
      invitation.inviterId ||
      room.roomId,
    ...(invitedAtTs > 0
      ? { lastActivityAt: new Date(invitedAtTs).toISOString() }
      : {}),
    section: "all",
    // The invite event's direct marker when set; group otherwise (safe default).
    kind: invitation.isDirect ? "direct" : "group",
    // The inviter is the only participant an invite reliably exposes; invite
    // rooms are excluded from `getChatForUsers` resolution until accepted.
    participantIds: invitation.inviterId ? [invitation.inviterId] : [],
    visual: { kind: "icon", icon: "mail" },
    membership: "invite",
    invitation,
  };
};

/**
 * Maps a room to a `LocalChat`, branching on the current user's membership: an
 * invited room becomes an invitation row, every other room a joined
 * conversation. Both reads (`getChats`, `getChat`) go through here so the two
 * mappings can never drift.
 */
const matrixRoomToLocalChat = (
  room: Room,
  currentUserId: string | undefined,
): LocalChat =>
  room.getMyMembership() === KnownMembership.Invite
    ? matrixInviteRoomToLocalChat(room, currentUserId)
    : matrixJoinedRoomToLocalChat(room, currentUserId);

const initialsFor = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return letters || "?";
};

/** The localpart of `@alice:server` → `alice`; a sensible fallback display name. */
const localpartOf = (userId: string): string =>
  userId.replace(/^@/, "").split(":")[0];

/** One homeserver user-directory result, narrowed to the fields the UI needs. */
type MatrixDirectoryUser = { user_id: string; display_name?: string };

/**
 * A directory search result mapped to the New Chat people shape. The Matrix id
 * is the stable handle the whole flow keys on (search → chip → existing-chat
 * resolution), so it is the `ChatUser.id`; the same id is the secondary line and
 * fills `email` (the directory carries no email, and the New Chat UI does not
 * render it). Initials and colour reuse the driver's own helpers so a person
 * looks identical in search, chips and message bubbles.
 */
const matrixDirectoryUserToChatUser = (user: MatrixDirectoryUser): ChatUser => {
  const name = user.display_name?.trim() || localpartOf(user.user_id);
  return {
    id: user.user_id,
    name,
    initials: initialsFor(name),
    color: hashAvatarColor(user.user_id),
    email: user.user_id,
    subtitle: user.user_id,
  };
};

/**
 * The chat UI marks a message as "sent by me" when its `authorId` is the
 * literal `"me"` (see `ChatVirtualList`). Matrix has no notion of the Hub user,
 * and the two identities are not linked yet, so the driver simply folds the
 * connected Matrix user onto that sentinel: whoever is logged into Matrix *is*
 * "me" for display purposes. Everyone else keeps their raw `mxId`.
 */
const SELF_AUTHOR_ID = "me";

const toAuthorId = (
  sender: string | undefined,
  selfUserId: string | undefined,
): string =>
  sender && sender === selfUserId ? SELF_AUTHOR_ID : (sender ?? "");

/** Timeline entries the chat UI renders as message bubbles. */
const isMessageEvent = (event: MatrixEvent): boolean =>
  event.getType() === EventType.RoomMessage && !event.isRedacted();

/** A user-visible message on the room's main timeline (not a reply or edit). */
const isMainTimelineMessage = (event: MatrixEvent): boolean =>
  isMessageEvent(event) &&
  (!event.threadRootId || event.isThreadRoot) &&
  event.getRelation()?.rel_type !== RelationType.Replace;

/**
 * Receipt-backed unread state for the main timeline. Notification counts cover
 * messages outside the limited sync window; loaded events make muted/default
 * push-rule cases deterministic.
 */
const computeRoomUnread = (
  room: Room,
  selfUserId: string | undefined,
): boolean => {
  if (!selfUserId) {
    return false;
  }
  if (room.getRoomUnreadNotificationCount(NotificationCountType.Total) > 0) {
    return true;
  }
  return room
    .getLiveTimeline()
    .getEvents()
    .filter(isMainTimelineMessage)
    .some((event) => {
      const eventId = event.getId();
      return (
        Boolean(eventId) &&
        event.getSender() !== selfUserId &&
        !room.hasUserReadEvent(selfUserId, eventId!)
      );
    });
};

/** Whether an ephemeral receipt event advances this connected user's marker. */
const receiptMentionsUser = (
  event: MatrixEvent,
  userId: string | undefined,
): boolean => {
  if (!userId) {
    return false;
  }
  const content = event.getContent() as Record<
    string,
    Record<string, Record<string, unknown>>
  >;
  return Object.values(content).some(
    (byType) =>
      byType?.["m.read"]?.[userId] !== undefined ||
      byType?.["m.read.private"]?.[userId] !== undefined,
  );
};

const isDirectThreadReply = (event: MatrixEvent, threadId: string): boolean =>
  isMessageEvent(event) &&
  event.getId() !== threadId &&
  event.getRelation()?.rel_type === RelationType.Thread;

/** Direct `m.thread` text replies, excluding roots, edits and annotations. */
const threadReplyEvents = (thread: Thread): MatrixEvent[] =>
  thread.events.filter((event) => isDirectThreadReply(event, thread.id));

type ThreadReplyCounter = {
  count: number;
  observedEventKeys: Set<string>;
};

/**
 * `Thread.length` is based on the root's server aggregation. During sync the
 * SDK can briefly re-process an older root summary after already delivering a
 * new reply. Keep the confirmed count monotonic for the lifetime of that SDK
 * Thread object, and remember live event keys so `Thread.newReply` followed by
 * `Thread.new` cannot count or emit the same reply twice.
 */
const threadReplyCounters = new WeakMap<Thread, ThreadReplyCounter>();

const threadReplyEventKey = (event: MatrixEvent): string | undefined => {
  const transactionId = event.getTxnId() ?? event.getUnsigned()?.transaction_id;
  if (transactionId) {
    return `txn:${transactionId}`;
  }
  const eventId = event.getId();
  return eventId ? `event:${eventId}` : undefined;
};

const threadReplySnapshot = (thread: Thread): number =>
  Math.max(thread.length, threadReplyEvents(thread).length);

const getThreadReplyCounter = (thread: Thread): ThreadReplyCounter => {
  const snapshot = threadReplySnapshot(thread);
  const existing = threadReplyCounters.get(thread);
  if (existing) {
    existing.count = Math.max(existing.count, snapshot);
    return existing;
  }
  const counter: ThreadReplyCounter = {
    count: snapshot,
    observedEventKeys: new Set(
      [
        ...threadReplyEvents(thread),
        ...(thread.replyToEvent ? [thread.replyToEvent] : []),
      ]
        .map(threadReplyEventKey)
        .filter((key): key is string => Boolean(key)),
    ),
  };
  threadReplyCounters.set(thread, counter);
  return counter;
};

/**
 * The SDK aggregate can lag behind during `ThreadEvent.NewReply`. Loaded events
 * cover the current window; the monotonic counter also protects older replies
 * which are outside that window from a stale aggregate rollback.
 */
const threadReplyCount = (thread: Thread): number =>
  getThreadReplyCounter(thread).count;

/** Records one newly-delivered direct reply and returns false for duplicates. */
const observeThreadReply = (
  thread: Thread,
  event: MatrixEvent,
  liveEvent: boolean,
): boolean => {
  if (!isDirectThreadReply(event, thread.id)) {
    return false;
  }
  const eventKey = threadReplyEventKey(event);
  if (!eventKey) {
    return false;
  }
  const existing = threadReplyCounters.get(thread);
  if (!existing) {
    // A brand-new Thread already contains its first reply. Seed from that
    // snapshot; existing threads are seeded when listeners are attached.
    getThreadReplyCounter(thread).observedEventKeys.add(eventKey);
    return true;
  }
  if (existing.observedEventKeys.has(eventKey)) {
    return false;
  }
  const previousCount = existing.count;
  const snapshot = threadReplySnapshot(thread);
  existing.observedEventKeys.add(eventKey);
  existing.count = Math.max(
    previousCount,
    snapshot,
    liveEvent && snapshot <= previousCount ? previousCount + 1 : snapshot,
  );
  return true;
};

const rememberThreadReplyCount = (thread: Thread, count: number): void => {
  const counter = getThreadReplyCounter(thread);
  counter.count = Math.max(counter.count, count);
};

const sortedThreadReplyEvents = (thread: Thread): MatrixEvent[] =>
  [...threadReplyEvents(thread)].sort(
    (left, right) => left.getTs() - right.getTs(),
  );

/**
 * Loaded unread replies for threads relevant to the user. Matrix notification
 * counts remain the authority when the list has not loaded every reply yet.
 */
const threadUnreadReplyEvents = (
  room: Room,
  thread: Thread,
  selfUserId: string | undefined,
): MatrixEvent[] => {
  if (!selfUserId) {
    return [];
  }
  const relevant =
    room.getJoinedMemberCount() === 2 ||
    thread.hasCurrentUserParticipated ||
    thread.rootEvent?.getSender() === selfUserId;
  if (!relevant) {
    return [];
  }
  return sortedThreadReplyEvents(thread).filter((event) => {
    const eventId = event.getId();
    return (
      Boolean(eventId) &&
      event.getSender() !== selfUserId &&
      !thread.hasUserReadEvent(selfUserId, eventId!)
    );
  });
};

const computeThreadUnread = (
  room: Room,
  thread: Thread,
  selfUserId: string | undefined,
): number =>
  Math.max(
    room.getThreadUnreadNotificationCount(
      thread.id,
      NotificationCountType.Total,
    ),
    threadUnreadReplyEvents(room, thread, selfUserId).length,
  );

const roomUnread = (
  room: Room,
  selfUserId: string | undefined,
): ChatUnread => ({
  unread:
    room.getUnreadNotificationCount(NotificationCountType.Total) > 0 ||
    computeRoomUnread(room, selfUserId) ||
    room
      .getThreads()
      .some((thread) => computeThreadUnread(room, thread, selfUserId) > 0),
  // Unlike getRoomUnreadNotificationCount, this includes thread mentions.
  highlight:
    room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0,
});

const authorForSender = (
  room: Room,
  userId: string,
  selfUserId: string | undefined,
): ChatMessageAuthor => {
  const name = room.getMember(userId)?.name ?? userId;
  return {
    id: toAuthorId(userId, selfUserId),
    name,
    initials: initialsFor(name),
    color: hashAvatarColor(userId),
  };
};

const addReactionRelations = (
  containers: ReactionRelations[],
  seen: Set<ReactionRelations>,
  relations: ReactionRelations | undefined,
): void => {
  if (relations && !seen.has(relations)) {
    seen.add(relations);
    containers.push(relations);
  }
};

/** Known `m.annotation` relation containers for a message or thread reply. */
const reactionRelationContainersFor = (
  room: Room,
  eventId: string,
  threadId?: string,
): ReactionRelations[] => {
  const containers: ReactionRelations[] = [];
  const seen = new Set<ReactionRelations>();
  addReactionRelations(
    containers,
    seen,
    room.relations.getChildEventsForEvent(
      eventId,
      RelationType.Annotation,
      EventType.Reaction,
    ),
  );

  const target = room.findEventById(eventId);
  const threadIds = new Set(
    [threadId, target?.threadRootId, room.getThread(eventId)?.id].filter(
      (id): id is string => Boolean(id),
    ),
  );
  for (const id of threadIds) {
    addReactionRelations(
      containers,
      seen,
      room
        .getThread(id)
        ?.timelineSet.relations.getChildEventsForEvent(
          eventId,
          RelationType.Annotation,
          EventType.Reaction,
        ),
    );
  }
  return containers;
};

/**
 * Maps Matrix annotations to the driver-neutral reaction shape. A sender is
 * counted at most once for a given emoji and variation-selector spellings are
 * collapsed onto the same chip, matching the UI's emoji identity rules.
 */
const aggregateReactions = (
  room: Room,
  eventId: string,
  selfUserId: string | undefined,
  threadId?: string,
): ChatReaction[] =>
  aggregateReactionEvents(
    reactionRelationContainersFor(room, eventId, threadId).flatMap(
      (relations) => relations.getRelations(),
    ),
    selfUserId,
  );

/** Aggregates a concrete set of annotation events by emoji and sender. */
const aggregateReactionEvents = (
  events: MatrixEvent[],
  selfUserId: string | undefined,
): ChatReaction[] => {
  const grouped = new Map<
    string,
    { emoji: string; senders: Set<string>; reactedByMe: boolean }
  >();
  for (const event of events) {
    if (event.isRedacted()) {
      continue;
    }
    const emoji = event.getRelation()?.key;
    const sender = event.getSender();
    if (!emoji || !sender) {
      continue;
    }
    const key = emojiToCodepoints(emoji);
    const group = grouped.get(key) ?? {
      emoji,
      senders: new Set<string>(),
      reactedByMe: false,
    };
    group.senders.add(sender);
    group.reactedByMe ||= sender === selfUserId;
    grouped.set(key, group);
  }

  return [...grouped.values()].map(({ emoji, senders, reactedByMe }) => ({
    emoji,
    count: senders.size,
    reactedByMe,
  }));
};

type ReactionSnapshot = {
  events: MatrixEvent[];
  reactions: ChatReaction[];
};

/**
 * Reads the homeserver's active annotations instead of trusting the SDK's
 * relation container, which can temporarily retain a sent-then-redacted local
 * echo across IndexedDB reloads. Pages are followed so counts stay exact.
 */
const fetchReactionSnapshot = async (
  mx: MatrixClient,
  roomId: string,
  eventId: string,
  selfUserId: string | undefined,
): Promise<ReactionSnapshot> => {
  const events: MatrixEvent[] = [];
  let from: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const result = await mx.relations(
      roomId,
      eventId,
      RelationType.Annotation,
      EventType.Reaction,
      {
        dir: Direction.Backward,
        limit: 100,
        ...(from ? { from } : {}),
      },
    );
    events.push(...result.events);
    if (!result.nextBatch) {
      return {
        events,
        reactions: aggregateReactionEvents(events, selfUserId),
      };
    }
    from = result.nextBatch;
  }
  throw new Error(
    `MatrixDriver: reactions for event "${eventId}" exceed the pagination safety limit.`,
  );
};

/** Reconciles a mapped message only when Matrix reports or caches reactions. */
const reconcileMessageReactions = async (
  mx: MatrixClient,
  room: Room,
  event: MatrixEvent,
  message: ChatMessage,
  selfUserId: string | undefined,
): Promise<ChatMessage> => {
  const hasServerAggregate = Boolean(
    event.getServerAggregatedRelation(RelationType.Annotation),
  );
  if (!hasServerAggregate && message.reactions.length === 0) {
    return message;
  }
  const snapshot = await fetchReactionSnapshot(
    mx,
    room.roomId,
    message.id,
    selfUserId,
  );
  return { ...message, reactions: snapshot.reactions };
};

/** Current user's active annotations for one emoji. */
const ownReactionEvents = (
  events: MatrixEvent[],
  emoji: string,
  selfUserId: string,
): MatrixEvent[] => {
  const key = emojiToCodepoints(emoji);
  return events.filter(
    (event) =>
      !event.isRedacted() &&
      event.getSender() === selfUserId &&
      emojiToCodepoints(event.getRelation()?.key ?? "") === key,
  );
};

/** Cache patches for a reaction target on the main timeline and/or a thread. */
const reactionUpdateEventsForTarget = (
  room: Room,
  targetId: string,
  reactions: ChatReaction[],
  threadIdHint?: string,
): ChatEvent[] => {
  const target = room.findEventById(targetId);
  const rootedThreadId =
    room.getThread(targetId)?.id ??
    (target?.isThreadRoot ? targetId : undefined);
  const containingThreadId = rootedThreadId
    ? undefined
    : (target?.threadRootId ?? threadIdHint);
  const threadId = rootedThreadId ?? containingThreadId;
  const events: ChatEvent[] = [];

  // A thread root also lives on the main timeline; replies live only in detail.
  if (!containingThreadId) {
    events.push({
      type: "reaction:updated",
      chatId: room.roomId,
      messageId: targetId,
      reactions,
    });
  }
  if (threadId) {
    events.push({
      type: "reaction:updated",
      chatId: room.roomId,
      messageId: targetId,
      reactions,
      threadId,
    });
  }
  return events;
};

/** Fine-grained cache patches for a live `m.reaction` annotation. */
const reactionEventToChatEvent = (
  event: MatrixEvent,
  room: Room,
  selfUserId: string | undefined,
): ChatEvent[] => {
  const relation = event.getRelation();
  if (relation?.rel_type !== RelationType.Annotation || !relation.event_id) {
    return [];
  }
  return reactionUpdateEventsForTarget(
    room,
    relation.event_id,
    aggregateReactions(room, relation.event_id, selfUserId, event.threadRootId),
    event.threadRootId,
  );
};

const matrixEventToChatMessage = (
  event: MatrixEvent,
  room: Room,
  selfUserId: string | undefined,
): ChatMessage => {
  const body = event.getContent<{ body?: string }>().body;
  const eventId = event.getId() ?? "";
  const message: ChatMessage = {
    id: eventId,
    authorId: toAuthorId(event.getSender(), selfUserId),
    content: typeof body === "string" ? body : "",
    timestamp: new Date(event.getTs()).toISOString(),
    reactions: aggregateReactions(
      room,
      eventId,
      selfUserId,
      event.threadRootId,
    ),
  };
  const thread = room.getThread(eventId);
  if (thread) {
    message.thread = {
      id: thread.id,
      replyCount: threadReplyCount(thread),
      unreadCount: computeThreadUnread(room, thread, selfUserId),
    };
  }
  return message;
};

const threadToChatThread = (
  room: Room,
  thread: Thread,
  selfUserId: string | undefined,
): ChatThread => {
  const lastReply = thread.replyToEvent ?? thread.rootEvent;
  const sender = lastReply?.getSender() ?? "";
  const body = lastReply?.getContent<{ body?: string }>().body;
  return {
    id: thread.id,
    rootMessageId: thread.id,
    author: authorForSender(room, sender, selfUserId),
    lastReplyAt: new Date(lastReply?.getTs() ?? 0).toISOString(),
    lastReplyPreview: typeof body === "string" ? body : "",
    replyCount: threadReplyCount(thread),
    unreadCount: computeThreadUnread(room, thread, selfUserId),
  };
};

const threadToChatThreadDetail = (
  room: Room,
  thread: Thread,
  selfUserId: string | undefined,
): ChatThreadDetail => {
  const replies = sortedThreadReplyEvents(thread);
  const events = thread.rootEvent ? [thread.rootEvent, ...replies] : replies;
  const unreadReplyIds = new Set(
    threadUnreadReplyEvents(room, thread, selfUserId)
      .map((event) => event.getId())
      .filter((eventId): eventId is string => Boolean(eventId)),
  );
  const firstUnreadReply = replies.findIndex((event) =>
    unreadReplyIds.has(event.getId() ?? ""),
  );
  return {
    id: thread.id,
    rootMessageId: thread.id,
    messages: events.map((event) =>
      matrixEventToChatMessage(event, room, selfUserId),
    ),
    authors: buildAuthors(room, events, selfUserId),
    firstUnreadIndex:
      firstUnreadReply < 0
        ? null
        : firstUnreadReply + (thread.rootEvent ? 1 : 0),
  };
};

/**
 * One `ChatMessageAuthor` per distinct *other* sender across the given events.
 * The current user is omitted: their messages render as "sent" bubbles, which
 * never look an author up (see `ChatVirtualList`).
 */
const buildAuthors = (
  room: Room,
  events: MatrixEvent[],
  selfUserId: string | undefined,
): ChatMessageAuthor[] => {
  const senderIds = [
    ...new Set(
      events
        .map((event) => event.getSender())
        .filter((id): id is string => Boolean(id) && id !== selfUserId),
    ),
  ];
  return senderIds.map((id) => {
    const name = room.getMember(id)?.name ?? id;
    return {
      id,
      name,
      initials: initialsFor(name),
      color: hashAvatarColor(id),
    };
  });
};

/**
 * A stable `ChatMessage` for a just-sent event, folded onto the `"me"` sentinel
 * with the REAL server event id so the composer hook can swap its optimistic
 * bubble for a `/sync`-consistent message. Kept a pure function so the send
 * mapping is unit-testable without a live server.
 */
const sendResponseToChatMessage = (
  eventId: string,
  content: string,
): ChatMessage => ({
  id: eventId,
  authorId: SELF_AUTHOR_ID,
  content,
  timestamp: new Date().toISOString(),
  reactions: [],
});

/**
 * True when `event` is THIS session's own outgoing echo — a local echo still in
 * flight (`status` set) or the remote echo the homeserver returned to the
 * sending device (`unsigned.transaction_id` / a local `txnId`). Those are
 * reconciled by the composer hook's optimistic→replace flow, so the sync bridge
 * must not re-broadcast them (that would duplicate the bubble).
 *
 * Deliberately NARROWER than "sent by the current user": the same user sending
 * from ANOTHER device (e.g. Element) carries no local txn id here, so that
 * message is delivered live like any other incoming one.
 */
const isOwnEcho = (event: MatrixEvent): boolean =>
  event.status !== null ||
  Boolean(event.getUnsigned()?.transaction_id) ||
  Boolean(event.getTxnId());

/**
 * Translates a single LIVE timeline event into the fine-grained `ChatEvent`s the
 * sync bridge should broadcast — an array, since "broadcast nothing" is a valid
 * outcome. Pure (no client, no driver state) so the mapping is unit-testable.
 *
 * A plain message becomes `message:new`, an edit becomes `message:updated`, and
 * a thread reply refreshes only the thread slices and its root summary.
 * Reactions become targeted cache patches; other non-text activity stays coarse
 * (`chat:changed`). This session's own message echo returns `[]` because the
 * optimistic→replace flow already rendered it.
 */
export const timelineEventToChatEvent = (
  event: MatrixEvent,
  room: Room,
  selfUserId: string | undefined,
): ChatEvent[] => {
  if (event.getType() === EventType.Reaction) {
    return reactionEventToChatEvent(event, room, selfUserId);
  }

  // Non-text activity (redactions, membership, other state) stays coarse.
  if (!isMessageEvent(event)) {
    return [{ type: "chat:changed", chatId: room.roomId }];
  }

  // Our own echo is already on screen via the optimistic bubble; suppressing it
  // here is what keeps a Hub-sent message from rendering twice.
  if (isOwnEcho(event)) {
    return [];
  }

  // A thread reply never becomes a top-level bubble. Refresh the thread slices
  // and replace the root message so its summary count/unread badge moves live.
  if (event.threadRootId && !event.isThreadRoot) {
    const root =
      room.getThread(event.threadRootId)?.rootEvent ??
      room.findEventById(event.threadRootId);
    return [
      { type: "threads:changed", chatId: room.roomId },
      ...(root
        ? [
            {
              type: "message:updated" as const,
              chatId: room.roomId,
              message: matrixEventToChatMessage(root, room, selfUserId),
            },
          ]
        : []),
    ];
  }

  // An edit (`m.replace`) updates an existing bubble in place.
  const relation = event.getRelation();
  if (relation?.rel_type === RelationType.Replace && relation.event_id) {
    const newBody = event.getContent<{ "m.new_content"?: { body?: string } }>()[
      "m.new_content"
    ]?.body;
    // Keep the ORIGINAL send time. `matrixEventToChatMessage` (history reads)
    // dates an edited message from its original event, so using the edit event's
    // ts here would make the bubble's time jump live, then revert on the next
    // refetch. Fall back to the edit ts only when the original is not loaded.
    const original = room.findEventById(relation.event_id);
    const originalMessage = original
      ? matrixEventToChatMessage(original, room, selfUserId)
      : null;
    return [
      {
        type: "message:updated",
        chatId: room.roomId,
        message: {
          ...originalMessage,
          id: relation.event_id,
          authorId: toAuthorId(event.getSender(), selfUserId),
          content: typeof newBody === "string" ? newBody : "",
          timestamp: new Date(original?.getTs() ?? event.getTs()).toISOString(),
          reactions: aggregateReactions(room, relation.event_id, selfUserId),
        },
      },
    ];
  }

  // A plain new message from anyone else (including the same user on another
  // device) appears live.
  return [
    {
      type: "message:new",
      chatId: room.roomId,
      message: matrixEventToChatMessage(event, room, selfUserId),
      authors: buildAuthors(room, [event], selfUserId),
    },
  ];
};

/**
 * Matrix-backed chat driver. All Matrix specifics — the OIDC handshake, client
 * bootstrap and `/sync` long-polling — live here, behind the generic `Driver`
 * contract, so the UI never imports anything Matrix.
 *
 * Rooms, messages, unread state, threads, and reactions are Matrix-backed,
 * while `/sync` is bridged onto the generic real-time event stream. Documents
 * remain on their legacy implementation until their Matrix-specific change.
 */
export class MatrixDriver extends MockDriver {
  override readonly supportsComposition: boolean = true;
  override readonly supportsThreadComposition: boolean = true;
  override readonly supportsConversationCreation: boolean = true;

  private mx: MatrixClient | null = null;
  /** Subscribers to the single global event stream. */
  private eventListeners = new Set<ChatEventListener>();
  /** Server ids sent by this driver, used to pair local and remote echoes. */
  private sentThreadReplyEventIds = new Set<string>();
  /** Detaches the Matrix `/sync` listeners; set when the client is bootstrapped. */
  private detachSync: () => void = () => {};
  /** Parsed per-account config; source of truth for discovery and OIDC. */
  private readonly settings: MatrixDriverSettings;
  /**
   * Server-confirmed joined rooms. `getVisibleRooms()` can include stale rooms
   * restored from IndexedDB after the local homeserver was reset.
   */
  private joinedRoomIds: Set<string> | null = null;
  /**
   * Storage namespace for the Hub/Matrix login context currently being
   * connected. `matrix-local` may be used by several seeded users in the same
   * browser, so credentials must not be keyed only by account id.
   */
  private storageOwner: string | null = null;

  constructor(
    accountId: AccountId = "default",
    settings: Record<string, unknown> = {},
  ) {
    super(accountId, settings);
    this.settings = parseMatrixDriverSettings(settings);
  }

  /**
   * Resolves the OIDC `login_hint`. Preference order: account config, dev
   * override, then the authenticated Hub user's email.
   */
  private resolveLoginHint(user: User | null | undefined): string {
    if (this.settings.loginHint) {
      return this.settings.loginHint;
    }
    const devHint = process.env.NEXT_PUBLIC_MATRIX_DEV_LOGIN_HINT;
    if (process.env.NODE_ENV === "development" && devHint) {
      return devHint;
    }
    return user?.email ?? "";
  }

  /**
   * Resolves the homeserver per account strategy. `fixed` uses the configured
   * base URL directly; `tchap-email` keeps the original identity-server lookup.
   */
  private async discoverHomeserver(
    loginHint: string,
  ): Promise<{ base_url: string; server_name: string }> {
    if (this.settings.discovery === "fixed") {
      return {
        base_url: this.settings.baseUrl,
        server_name: this.settings.serverName,
      };
    }
    return fetchHomeserverForEmail(loginHint, TCHAP_HOMESERVER_LIST);
  }

  async getChats(): Promise<LocalChatSections> {
    const mx = this.mx;
    if (!mx) {
      return {
        favourites: [],
        all: [],
      };
    }
    // Joined conversations (server-confirmed, so stale rooms restored from
    // IndexedDB after a homeserver reset don't linger) plus pending incoming
    // invitations, which aren't in `/joined_rooms` and are surfaced by their
    // membership instead.
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    const currentUserId = mx.getUserId() ?? undefined;
    const localChats = mx
      .getVisibleRooms()
      .filter(
        (room) =>
          joinedRoomIds.has(room.roomId) ||
          room.getMyMembership() === KnownMembership.Invite,
      )
      .map((room) => matrixRoomToLocalChat(room, currentUserId));

    return {
      favourites: [],
      all: localChats,
    };
  }

  /** Initial read-state snapshot for server-confirmed joined rooms. */
  async getUnread(): Promise<Record<string, ChatUnread>> {
    const mx = this.mx;
    if (!mx) {
      return {};
    }
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    const selfUserId = mx.getUserId() ?? undefined;
    return Object.fromEntries(
      mx
        .getVisibleRooms()
        .filter((room) => joinedRoomIds.has(room.roomId))
        .map((room) => [room.roomId, roomUnread(room, selfUserId)]),
    );
  }

  async getChat(chatId: string): Promise<LocalChat> {
    const { mx, room } = this.requireRoom("getChat", chatId);
    // A joined room (server-confirmed) or a pending invitation is addressable;
    // anything else (left/banned) is not.
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    if (
      !joinedRoomIds.has(chatId) &&
      room.getMyMembership() !== KnownMembership.Invite
    ) {
      throw new Error(`MatrixDriver.getChat: room "${chatId}" is not joined.`);
    }
    return matrixRoomToLocalChat(room, mx.getUserId() ?? undefined);
  }

  /**
   * People available when composing a new chat, from the homeserver user
   * directory. The connected user and the already-selected participants
   * (`excludeIds`) are filtered out; an empty/whitespace term returns nothing
   * without hitting the network (the hook already gates on a non-empty query).
   */
  async getChatUsers(filters?: ChatUserFilters): Promise<ChatUser[]> {
    const mx = this.mx;
    const term = filters?.q?.trim() ?? "";
    if (!mx || term.length === 0) {
      return [];
    }
    const selfUserId = mx.getUserId() ?? undefined;
    const excluded = new Set(filters?.excludeIds ?? []);
    const { results } = await mx.searchUserDirectory({
      term,
      limit: PEOPLE_SEARCH_FETCH_LIMIT,
    });
    return results
      .filter(
        (user) => user.user_id !== selfUserId && !excluded.has(user.user_id),
      )
      .slice(0, PEOPLE_SEARCH_DISPLAY_LIMIT)
      .map(matrixDirectoryUserToChatUser);
  }

  /**
   * The existing conversation for exactly this participant set, or `null`. A
   * joined room matches when its members (excluding the connected user) equal
   * the requested Matrix ids — order- and duplicate-independent, the same
   * set-equality the mock honours. One rule serves both direct (one other
   * member) and group (several) conversations. `null` lets the UI keep the
   * placeholder for a genuinely new conversation.
   */
  async getChatForUsers(userIds: string[]): Promise<LocalChat | null> {
    const mx = this.mx;
    if (!mx || userIds.length === 0) {
      return null;
    }
    const selfUserId = mx.getUserId() ?? undefined;
    const wanted = participantSetKey(userIds);
    // Gate on the server-confirmed joined set (like getChats/getChat/
    // getChatMessages), not `getMyMembership()`: a stale room restored from
    // IndexedDB after a homeserver reset can still report membership "join"
    // locally, and must not resolve as an existing conversation (its getChat
    // would then throw "not joined" and block creating a fresh one).
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    const match = mx
      .getVisibleRooms()
      .filter((room) => joinedRoomIds.has(room.roomId))
      .find(
        (room) =>
          participantSetKey(
            roomOtherMembers(room, selfUserId).map((member) => member.userId),
          ) === wanted,
      );
    return match ? matrixRoomToLocalChat(match, selfUserId) : null;
  }

  /**
   * Starts a brand-new conversation for the given participants: a private room
   * with each one invited (a direct chat for a single participant, a group for
   * several). Idempotent — a joined room already matching the set is returned
   * instead of creating a duplicate. Waits until the SDK knows the new room so
   * the returned chat id is immediately usable for the first send and the
   * navigation that follows.
   */
  async createChatForUsers(userIds: string[]): Promise<LocalChat> {
    const mx = this.requireClient("createChatForUsers");
    const participantIds = [...new Set(userIds)].filter(Boolean);
    if (participantIds.length === 0) {
      throw new Error(
        "MatrixDriver.createChatForUsers: at least one participant is required.",
      );
    }
    const existing = await this.getChatForUsers(participantIds);
    if (existing) {
      return existing;
    }

    const selfUserId = mx.getUserId() ?? undefined;
    const isDirect = participantIds.length === 1;
    const { room_id: roomId } = await mx.createRoom({
      preset: Preset.PrivateChat,
      is_direct: isDirect,
      invite: participantIds,
    });

    const room = await this.waitForRoom(mx, roomId);
    if (room) {
      return matrixRoomToLocalChat(room, selfUserId);
    }
    // Fallback if the room has not surfaced through /sync within the timeout: a
    // minimal chat built from what we already know, so the UI can navigate; the
    // real name/kind firm up once `getChat` reads the synced room.
    return {
      id: roomId,
      name: participantIds[0],
      section: "all",
      kind: isDirect ? "direct" : "group",
      participantIds,
      visual: isDirect
        ? { kind: "initials" }
        : { kind: "icon", icon: "groups" },
    };
  }

  /**
   * Resolves once the client knows `roomId` (or after `timeoutMs`). `createRoom`
   * returns before the room necessarily appears in the client's room list, so
   * this bridges that gap before the first send / navigation reads the room.
   */
  private waitForRoom(
    mx: MatrixClient,
    roomId: string,
    timeoutMs = 5000,
  ): Promise<Room | null> {
    const existing = mx.getRoom(roomId);
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise<Room | null>((resolve) => {
      const cleanup = () => {
        mx.off(ClientEvent.Room, onRoom);
        clearTimeout(timer);
      };
      const onRoom = (room: Room) => {
        if (room.roomId === roomId) {
          cleanup();
          resolve(room);
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve(mx.getRoom(roomId));
      }, timeoutMs);
      mx.on(ClientEvent.Room, onRoom);
    });
  }

  // --- Incoming invitations -----------------------------------------------
  // Accept joins the room and maps it as a joined conversation; refuse leaves
  // it. Both drop the cached joined-room set and emit `chats:changed` so the
  // list reflects the change at once, alongside the `RoomEvent.MyMembership`
  // bridge (see {@link bootstrapClient}).

  /**
   * Accepts an incoming invitation by joining its room, then maps the result as
   * a joined conversation so the open route can switch from the invitation
   * detail view to the normal timeline. Mapped through
   * {@link matrixJoinedRoomToLocalChat} directly (not the membership-branching
   * mapper) so the returned chat is `membership: "join"` even before `/sync` has
   * flipped the local membership.
   */
  async acceptChatInvitation(chatId: string): Promise<LocalChat> {
    const mx = this.requireClient("acceptChatInvitation");
    await mx.joinRoom(chatId);
    // Drop the cached joined set so the conversation's first `getChatMessages`
    // re-reads `/joined_rooms` and sees the room as joined (it isn't in the
    // stale cache captured while the room was still an invite).
    this.joinedRoomIds = null;
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(
        `MatrixDriver.acceptChatInvitation: room "${chatId}" not found after join.`,
      );
    }
    this.emit({ type: "chats:changed" });
    return matrixJoinedRoomToLocalChat(room, mx.getUserId() ?? undefined);
  }

  /** Refuses an incoming invitation by leaving its room. */
  async refuseChatInvitation(chatId: string): Promise<void> {
    const mx = this.requireClient("refuseChatInvitation");
    await mx.leave(chatId);
    this.joinedRoomIds = null;
    this.emit({ type: "chats:changed" });
  }

  /**
   * Reads a page of timeline history for a room, oldest-message-first. Backed by
   * the Matrix live timeline rather than a raw `/messages` call so events are
   * decrypted and de-duplicated by the SDK. The cursor is the oldest message id
   * of the previous page (see `nextCursor` below); the live timeline is
   * paginated backwards until enough history is in memory to fill the page, or
   * the start of the room is reached.
   */
  async getChatMessages({
    chatId,
    cursor,
    limit = DEFAULT_CHAT_PAGE_SIZE,
  }: GetChatMessagesParams): Promise<ChatMessagesPage> {
    const mx = this.requireClient("getChatMessages");
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    if (!joinedRoomIds.has(chatId)) {
      throw new Error(
        `MatrixDriver.getChatMessages: room "${chatId}" is not joined.`,
      );
    }
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(
        `MatrixDriver.getChatMessages: room "${chatId}" not found.`,
      );
    }

    const timeline = room.getLiveTimeline();
    const loaded = () => timeline.getEvents().filter(isMessageEvent);

    // Number of message events strictly older than the cursor currently in
    // memory; without a cursor every loaded message counts (latest page).
    let events = loaded();
    const eventsBeforeCursor = () =>
      cursor
        ? events.findIndex((event) => event.getId() === cursor)
        : events.length;

    let reachedStart = false;
    while (eventsBeforeCursor() < limit) {
      let more: boolean;
      try {
        more = await mx.paginateEventTimeline(timeline, {
          backwards: true,
          limit,
        });
      } catch (error) {
        if (!isRecoverableMatrixPaginationError(error)) {
          throw error;
        }
        reachedStart = true;
        break;
      }
      events = loaded();
      if (!more) {
        reachedStart = true;
        break;
      }
    }

    let endIndex = events.length;
    if (cursor) {
      endIndex = events.findIndex((event) => event.getId() === cursor);
      if (endIndex < 0) {
        throw new Error(
          `MatrixDriver.getChatMessages: cursor "${cursor}" not found in room "${chatId}".`,
        );
      }
    }
    const startIndex = Math.max(0, endIndex - limit);
    const pageEvents = events.slice(startIndex, endIndex);

    // The connected Matrix user is folded onto the "me" sentinel so their
    // messages render as "sent" (see `toAuthorId`).
    const selfUserId = mx.getUserId() ?? undefined;
    const mappedMessages = pageEvents.map((event) =>
      matrixEventToChatMessage(event, room, selfUserId),
    );
    // Most messages have no reactions and need no extra request. For the few
    // which have a server aggregate or a locally-known relation, reconcile
    // against `/relations` so a stale IndexedDB local echo cannot reappear
    // after its redaction.
    const messages = await Promise.all(
      mappedMessages.map((message, index) =>
        reconcileMessageReactions(
          mx,
          room,
          pageEvents[index],
          message,
          selfUserId,
        ),
      ),
    );
    const authors = buildAuthors(room, pageEvents, selfUserId);
    const nextCursor =
      startIndex === 0 && reachedStart ? null : (messages[0]?.id ?? null);
    return { messages, authors, nextCursor };
  }

  /** Resolves a connected client for Matrix-only operations. */
  private requireClient(method: string): MatrixClient {
    const mx = this.mx;
    if (!mx) {
      throw new Error(`MatrixDriver.${method}: client is not connected.`);
    }
    return mx;
  }

  /** Resolves a connected client and a known room for Matrix-only operations. */
  private requireRoom(
    method: string,
    chatId: string,
  ): { mx: MatrixClient; room: Room } {
    const mx = this.requireClient(method);
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(`MatrixDriver.${method}: room "${chatId}" not found.`);
    }
    return { mx, room };
  }

  /** Adds or removes the current user's annotation on one Matrix message. */
  private async toggleReactionOnMessage(
    method: "toggleChatReaction" | "toggleChatThreadReaction",
    chatId: string,
    messageId: string,
    emoji: string,
    threadId?: string,
  ): Promise<ChatMessage> {
    const { mx, room } = this.requireRoom(method, chatId);
    const selfUserId = mx.getUserId();
    if (!selfUserId) {
      throw new Error(`MatrixDriver.${method}: connected user is not known.`);
    }

    const thread = threadId ? room.getThread(threadId) : undefined;
    if (threadId && !thread) {
      throw new Error(
        `MatrixDriver.${method}: thread "${threadId}" not found in room "${chatId}".`,
      );
    }
    const target = thread
      ? (thread.findEventById(messageId) ??
        (messageId === thread.id ? thread.rootEvent : undefined))
      : room.findEventById(messageId);
    const validTarget = threadId
      ? Boolean(target && isMessageEvent(target))
      : Boolean(target && isMainTimelineMessage(target));
    if (!target || !validTarget) {
      throw new Error(
        `MatrixDriver.${method}: message "${messageId}" not found${
          threadId ? ` in thread "${threadId}"` : " on the main timeline"
        }.`,
      );
    }

    const snapshot = await fetchReactionSnapshot(
      mx,
      chatId,
      messageId,
      selfUserId,
    );
    const previousReactions = snapshot.reactions;
    const ownReactions = ownReactionEvents(snapshot.events, emoji, selfUserId);

    if (ownReactions.length > 0) {
      const eventIds = [
        ...new Set(
          ownReactions
            .map((event) => event.getId())
            .filter((eventId): eventId is string => Boolean(eventId)),
        ),
      ];
      if (eventIds.length === 0) {
        throw new Error(
          "MatrixDriver.toggleChatReaction: own reaction has no event id.",
        );
      }
      await Promise.all(
        eventIds.map((eventId) =>
          threadId
            ? mx.redactEvent(chatId, threadId, eventId)
            : mx.redactEvent(chatId, eventId),
        ),
      );
    } else {
      const key = emojiToCodepoints(emoji);
      if (
        previousReactions.some(
          (reaction) =>
            reaction.reactedByMe && emojiToCodepoints(reaction.emoji) === key,
        )
      ) {
        throw new Error(
          "MatrixDriver.toggleChatReaction: own annotation is missing from the relation store.",
        );
      }
      // Annotated: an untyped literal widens `rel_type` to `RelationType`, which
      // no `sendEvent` overload accepts.
      const content: ReactionEventContent = {
        "m.relates_to": {
          rel_type: RelationType.Annotation,
          event_id: messageId,
          key: emoji,
        },
      };
      await (threadId
        ? mx.sendEvent(chatId, threadId, EventType.Reaction, content)
        : mx.sendEvent(chatId, EventType.Reaction, content));
    }

    return {
      ...matrixEventToChatMessage(target, room, selfUserId),
      reactions: toggleReaction(previousReactions, emoji),
    };
  }

  /** Toggles a reaction on a main-timeline message. */
  async toggleChatReaction({
    chatId,
    messageId,
    emoji,
  }: ToggleChatReactionParams): Promise<ChatMessage> {
    return this.toggleReactionOnMessage(
      "toggleChatReaction",
      chatId,
      messageId,
      emoji,
    );
  }

  /** Toggles a reaction on a root or reply inside a Matrix thread. */
  async toggleChatThreadReaction({
    chatId,
    threadId,
    messageId,
    emoji,
  }: ToggleChatThreadReactionParams): Promise<ChatMessage> {
    return this.toggleReactionOnMessage(
      "toggleChatThreadReaction",
      chatId,
      messageId,
      emoji,
      threadId,
    );
  }

  /** Back-paginates a thread so detail and first-unread use its full history. */
  private async loadAllThreadReplies(
    mx: MatrixClient,
    thread: Thread,
  ): Promise<void> {
    for (let page = 0; page < 20; page += 1) {
      const hasMore = await mx.paginateEventTimeline(thread.liveTimeline, {
        backwards: true,
        limit: DEFAULT_CHAT_PAGE_SIZE,
      });
      if (!hasMore) {
        return;
      }
    }
    throw new Error(
      `MatrixDriver.loadAllThreadReplies: thread "${thread.id}" exceeds the pagination safety limit.`,
    );
  }

  /** Loads every page of the server-side room thread list. */
  private async loadAllRoomThreads(
    mx: MatrixClient,
    room: Room,
  ): Promise<void> {
    await room.fetchRoomThreads();
    const allThreadsTimeline = room.threadsTimelineSets[0]?.getLiveTimeline();
    if (!allThreadsTimeline) {
      return;
    }
    for (let page = 0; page < 20; page += 1) {
      if (
        allThreadsTimeline.getPaginationToken(EventTimeline.BACKWARDS) === null
      ) {
        return;
      }
      const hasMore = await mx.paginateEventTimeline(allThreadsTimeline, {
        backwards: true,
        limit: DEFAULT_CHAT_PAGE_SIZE,
      });
      if (!hasMore) {
        return;
      }
    }
    throw new Error(
      `MatrixDriver.loadAllRoomThreads: room "${room.roomId}" exceeds the pagination safety limit.`,
    );
  }

  /** All known room threads, ordered by their latest reply. */
  async getChatThreads(chatId: string): Promise<ChatThread[]> {
    const { mx, room } = this.requireRoom("getChatThreads", chatId);
    // Idempotent in the SDK and required even when one thread arrived via sync:
    // otherwise `getThreads()` can be a partial list.
    await this.loadAllRoomThreads(mx, room);
    const selfUserId = mx.getUserId() ?? undefined;
    return room
      .getThreads()
      .map((thread) => threadToChatThread(room, thread, selfUserId))
      .sort((left, right) => right.lastReplyAt.localeCompare(left.lastReplyAt));
  }

  /** Root + every reply, with a receipt-derived first-unread boundary. */
  async getChatThread({
    chatId,
    threadId,
  }: GetChatThreadParams): Promise<ChatThreadDetail> {
    const { mx, room } = this.requireRoom("getChatThread", chatId);
    await this.loadAllRoomThreads(mx, room);
    const thread = room.getThread(threadId);
    if (!thread) {
      throw new Error(
        `MatrixDriver.getChatThread: thread "${threadId}" not found in room "${chatId}".`,
      );
    }
    await this.loadAllThreadReplies(mx, thread);
    const selfUserId = mx.getUserId() ?? undefined;
    const detail = threadToChatThreadDetail(room, thread, selfUserId);
    const replies = sortedThreadReplyEvents(thread);
    const events = thread.rootEvent ? [thread.rootEvent, ...replies] : replies;
    const messages = await Promise.all(
      detail.messages.map((message, index) =>
        reconcileMessageReactions(mx, room, events[index], message, selfUserId),
      ),
    );
    return { ...detail, messages };
  }

  /** Advances only this thread's receipt to its latest reply. */
  async markChatThreadRead({
    chatId,
    threadId,
  }: MarkChatThreadReadParams): Promise<void> {
    const { mx, room } = this.requireRoom("markChatThreadRead", chatId);
    const thread = room.getThread(threadId);
    const lastReply = thread?.replyToEvent;
    if (lastReply) {
      await mx.sendReadReceipt(lastReply);
    }
  }

  /** Advances each known thread receipt independently. */
  async markAllChatThreadsRead(chatId: string): Promise<void> {
    const { mx, room } = this.requireRoom("markAllChatThreadsRead", chatId);
    await this.loadAllRoomThreads(mx, room);
    await Promise.all(
      room.getThreads().map((thread) => {
        const lastReply = thread.replyToEvent;
        return lastReply ? mx.sendReadReceipt(lastReply) : Promise.resolve();
      }),
    );
  }

  /**
   * Marks only the main timeline read. The default SDK receipt adds
   * `thread_id: "main"`; deliberately do not pass `unthreaded=true`, which
   * would also clear unread threads.
   */
  async markChatRead(chatId: string): Promise<void> {
    const { mx, room } = this.requireRoom("markChatRead", chatId);
    if (!computeRoomUnread(room, mx.getUserId() ?? undefined)) {
      return;
    }
    const events = room
      .getLiveTimeline()
      .getEvents()
      .filter(isMainTimelineMessage);
    const latest = events[events.length - 1];
    if (latest) {
      await mx.sendReadReceipt(latest);
    }
  }

  /**
   * Sends a text message as an `m.room.message` / `m.text` and resolves with the
   * final `ChatMessage`. The id is the REAL server event id, so the composer
   * hook replaces its optimistic bubble with a `/sync`-consistent message (see
   * {@link sendResponseToChatMessage}); the `/sync` echo of this same event is
   * suppressed as our own (see {@link isOwnEcho}), so it never double-renders.
   * The conversation rises in the list for free once the hook invalidates it.
   */
  async sendChatMessage({
    chatId,
    content,
  }: SendChatMessageParams): Promise<ChatMessage> {
    const { mx } = this.requireRoom("sendChatMessage", chatId);
    const { event_id: eventId } = await mx.sendTextMessage(chatId, content);
    return sendResponseToChatMessage(eventId, content);
  }

  async sendChatThreadReply({
    chatId,
    threadId,
    content,
  }: SendChatThreadReplyParams): Promise<ChatThreadMutationResult> {
    const { mx, room } = this.requireRoom("sendChatThreadReply", chatId);
    if (!threadId.startsWith("$")) {
      throw new Error(
        `MatrixDriver.sendChatThreadReply: invalid Matrix thread id "${threadId}".`,
      );
    }
    const { event_id: eventId } = await mx.sendTextMessage(
      chatId,
      threadId,
      content,
    );
    this.sentThreadReplyEventIds.add(eventId);
    return this.buildThreadMutationResult(mx, room, threadId, eventId, content);
  }

  async startChatThread({
    chatId,
    rootMessageId,
    content,
  }: StartChatThreadParams): Promise<ChatThreadMutationResult> {
    const { mx, room } = this.requireRoom("startChatThread", chatId);
    if (!rootMessageId.startsWith("$")) {
      throw new Error(
        `MatrixDriver.startChatThread: invalid Matrix root message id "${rootMessageId}".`,
      );
    }
    if (!room.findEventById(rootMessageId)) {
      throw new Error(
        `MatrixDriver.startChatThread: root message "${rootMessageId}" not found in room "${chatId}".`,
      );
    }
    const { event_id: eventId } = await mx.sendTextMessage(
      chatId,
      rootMessageId,
      content,
    );
    this.sentThreadReplyEventIds.add(eventId);
    return this.buildThreadMutationResult(
      mx,
      room,
      rootMessageId,
      eventId,
      content,
    );
  }

  /** Builds the exact cache payload expected by the optimistic thread hooks. */
  private buildThreadMutationResult(
    mx: MatrixClient,
    room: Room,
    rootMessageId: string,
    replyEventId: string,
    content: string,
  ): ChatThreadMutationResult {
    const selfUserId = mx.getUserId() ?? undefined;
    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: replyEventId,
      authorId: SELF_AUTHOR_ID,
      content,
      timestamp: now,
      reactions: [],
    };
    const liveThread = room.getThread(rootMessageId);
    const rootEvent =
      liveThread?.rootEvent ?? room.findEventById(rootMessageId);
    if (!rootEvent) {
      throw new Error(
        `MatrixDriver.buildThreadMutationResult: root message "${rootMessageId}" not found.`,
      );
    }
    const previousReplyEvents = liveThread
      ? sortedThreadReplyEvents(liveThread).filter(
          (event) => event.status === null && event.getId() !== replyEventId,
        )
      : [];
    const replyCount = Math.max(
      liveThread ? threadReplyCount(liveThread) : 0,
      previousReplyEvents.length + 1,
    );
    if (liveThread) {
      rememberThreadReplyCount(liveThread, replyCount);
    }
    const rootMessage: ChatMessage = {
      ...matrixEventToChatMessage(rootEvent, room, selfUserId),
      thread: {
        id: rootMessageId,
        replyCount,
        unreadCount: 0,
      },
    };
    const previousReplies = previousReplyEvents.map((event) =>
      matrixEventToChatMessage(event, room, selfUserId),
    );
    const threadDetail: ChatThreadDetail = {
      id: rootMessageId,
      rootMessageId,
      messages: [rootMessage, ...previousReplies, message],
      authors: buildAuthors(
        room,
        [rootEvent, ...previousReplyEvents],
        selfUserId,
      ),
      firstUnreadIndex: null,
    };
    const thread: ChatThread = {
      id: rootMessageId,
      rootMessageId,
      author: authorForSender(room, mx.getUserId() ?? "", selfUserId),
      lastReplyAt: now,
      lastReplyPreview: content,
      replyCount,
      unreadCount: 0,
    };
    return { message, thread, threadDetail, rootMessage };
  }

  /**
   * Establishes the Matrix session and resolves with the connection state.
   * Called through `useChatConnection` (a React Query query), so retries,
   * caching and de-duplication are handled by React Query — no bespoke store.
   */
  async connect(user: User | null | undefined): Promise<ChatConnectionState> {
    // The whole flow touches window/localStorage/IndexedDB. Static export has
    // no server runtime, but guard regardless.
    if (typeof window === "undefined") {
      return { status: "connecting", chatUser: null };
    }
    this.setStorageOwner(user);

    // 1. Returning user — credentials already persisted.
    const stored = this.readStoredJson<MatrixUserInterface>(STORAGE.user);
    if (stored) {
      try {
        await this.bootstrapClient(stored);
        return { status: "connected", chatUser: toChatUser(stored) };
      } catch (error) {
        if (!isMatrixSessionInvalidError(error)) {
          throw error;
        }
        await this.clearStoredSession(stored);
        if (!user?.email) {
          return { status: "idle", chatUser: null };
        }
        const redirectTo = await this.startOidcFlow(user);
        return { status: "connecting", chatUser: null, redirectTo };
      }
    }

    // 2. Back from the identity provider — finish the OIDC code exchange.
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) {
      if (sessionStorage.getItem(this.key(STORAGE.oidcState)) !== state) {
        return { status: "idle", chatUser: null };
      }
      const matrixUser = await this.completeLogin(code, state);
      await this.bootstrapClient(matrixUser);
      this.clearCallbackParams();
      return { status: "connected", chatUser: toChatUser(matrixUser) };
    }

    // 3. Nothing to go on yet — wait until the Hub user is known before
    //    redirecting away, so an anonymous first render does not bounce.
    if (!user?.email) {
      return { status: "idle", chatUser: null };
    }

    const redirectTo = await this.startOidcFlow(user);
    return { status: "connecting", chatUser: null, redirectTo };
  }

  private async startOidcFlow(user: User | null | undefined): Promise<string> {
    const loginHint = this.resolveLoginHint(user);
    let homeserver = sessionStorage.getItem(this.key(OIDC_HS_KEY));
    if (!homeserver) {
      const discovered = await this.discoverHomeserver(loginHint);
      homeserver = discovered.base_url;
      sessionStorage.setItem(this.key(OIDC_HS_KEY), homeserver);
    }
    const authUrl = await getOIDCAuthUrl(
      homeserver,
      loginHint,
      this.settings.branding,
      this.settings.oidcClientId,
    );
    const state = new URL(authUrl).searchParams.get("state");
    if (state) {
      sessionStorage.setItem(this.key(STORAGE.oidcState), state);
    }
    return authUrl;
  }

  private async completeLogin(
    code: string,
    state: string,
  ): Promise<MatrixUserInterface> {
    const homeserver = sessionStorage.getItem(this.key(OIDC_HS_KEY));
    if (!homeserver) {
      throw new Error(
        "MatrixDriver: missing homeserver while completing the OIDC callback.",
      );
    }
    const oidc = await completeOidcLogin({ code, state });
    const {
      user_id: mxId,
      device_id: deviceId,
      is_guest: guest,
    } = await getUserIdFromAccessToken(oidc.accessToken, homeserver);

    const matrixUser: MatrixUserInterface = {
      homeserverUrl: homeserver,
      mxId,
      deviceId,
      accessToken: oidc.accessToken,
      refreshToken: oidc.refreshToken,
      guest,
    };
    this.writeStoredJson(STORAGE.user, matrixUser);
    this.writeStoredJson(STORAGE.oidc, {
      clientId: oidc.clientId,
      issuer: oidc.issuer,
      idToken: oidc.idToken,
      idTokenClaims: oidc.idTokenClaims,
      // The IdP redirected back to this exact URL, so origin + pathname is the
      // redirect URI registered for this client.
      redirectUri: new URL(window.location.origin + window.location.pathname)
        .href,
    } satisfies StoredOidc);
    sessionStorage.removeItem(this.key(STORAGE.oidcState));
    sessionStorage.removeItem(this.key(OIDC_HS_KEY));
    return matrixUser;
  }

  private async bootstrapClient(user: MatrixUserInterface): Promise<void> {
    if (this.mx && this.mx.getUserId() === user.mxId) {
      return;
    }
    const mx = await initClient(user, {
      syncStoreDbName: this.key(SYNC_STORE_DB_NAME),
      cryptoStoreDbName: this.cryptoStoreDbName(user),
      tokenRefreshFunction: this.buildTokenRefreshFunction(user),
    });
    this.mx = mx;
    await this.startClientOrFailOnLogout(mx);
    await this.refreshJoinedRoomIds(mx);

    // Bridge Matrix `/sync` onto the generic event stream, once, for the
    // client's lifetime. The handlers fan out to whatever subscribers exist at
    // the time (an empty set is a harmless no-op). Live timeline events become
    // fine-grained `message:new` / `message:updated` (see
    // {@link timelineEventToChatEvent}); reactions are reconciled against the
    // server before their targeted patch; list membership changes and
    // reconnects stay coarse (`chats:changed`, per-room `chat:changed`).
    this.detachSync();
    const selfUserId = mx.getUserId() ?? undefined;
    const emitUnread = (room: Room) =>
      this.emit({
        type: "unread:changed",
        chatId: room.roomId,
        unread: roomUnread(room, selfUserId),
      });
    /** Replaces the root bubble so its summary count / unread badge moves live. */
    const emitThreadRootUpdate = (thread: Thread) => {
      if (!thread.rootEvent) {
        return;
      }
      this.emit({
        type: "message:updated",
        chatId: thread.room.roomId,
        message: matrixEventToChatMessage(
          thread.rootEvent,
          thread.room,
          selfUserId,
        ),
      });
    };
    const emitThreadChanged = (thread: Thread, event?: MatrixEvent) => {
      // The optimistic mutation owns this session's local/remote echo.
      if (event && isOwnEcho(event)) {
        return;
      }
      this.emit({ type: "threads:changed", chatId: thread.room.roomId });
      emitThreadRootUpdate(thread);
      emitUnread(thread.room);
    };
    const emitThreadsRefresh = (room: Room) => {
      const threads = room.getThreads();
      if (threads.length === 0) {
        return;
      }
      this.emit({ type: "threads:changed", chatId: room.roomId });
      threads.forEach((thread) => emitThreadRootUpdate(thread));
    };
    const pendingLiveThreadReplies = new Set<string>();
    const scopedThreadReplyKey = (
      thread: Thread,
      event: MatrixEvent,
    ): string | undefined => {
      const eventKey = threadReplyEventKey(event);
      return eventKey
        ? `${thread.room.roomId}\u0000${thread.id}\u0000${eventKey}`
        : undefined;
    };
    /**
     * A thread reply this session sent: either still a local echo, or the remote
     * echo of an id the driver just wrote. Both are already on screen through the
     * optimistic mutation, so the bridge must stay silent.
     */
    const isOwnThreadEcho = (event: MatrixEvent): boolean => {
      const eventId = event.getId();
      return (
        isOwnEcho(event) ||
        (eventId !== undefined && this.sentThreadReplyEventIds.has(eventId))
      );
    };
    const onTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
      removed: boolean,
      data: IRoomTimelineData,
    ) => {
      // Backward-pagination history is served by `getChatMessages`, not the
      // live stream.
      if (!room || removed) {
        return;
      }
      // The Room re-emits its thread timeline. Remember only real live events
      // here (the SDK explicitly labels backfill in `data.liveEvent`), then
      // publish after ThreadEvent.NewReply has refreshed thread metadata.
      if (
        !event.isThreadRoot &&
        event.getRelation()?.rel_type === RelationType.Thread
      ) {
        if (isOwnThreadEcho(event)) {
          return;
        }
        const threadId = event.threadRootId;
        const thread = threadId ? room.getThread(threadId) : null;
        if (thread) {
          const isLive = data.liveEvent === true;
          const isNew = observeThreadReply(thread, event, isLive);
          const replyKey = scopedThreadReplyKey(thread, event);
          if (isLive && isNew && replyKey) {
            pendingLiveThreadReplies.add(replyKey);
          }
        }
        return;
      }
      if (toStartOfTimeline) {
        return;
      }
      if (event.getType() === EventType.Reaction) {
        // The optimistic mutation owns this session's local/remote echo. Other
        // devices are reconciled against the homeserver because the SDK's
        // IndexedDB relation container may still hold an older local echo.
        if (isOwnEcho(event)) {
          return;
        }
        const relation = event.getRelation();
        if (
          relation?.rel_type !== RelationType.Annotation ||
          !relation.event_id
        ) {
          return;
        }
        const targetId = relation.event_id;
        const threadIdHint = event.threadRootId;
        void fetchReactionSnapshot(mx, room.roomId, targetId, selfUserId)
          .then((snapshot) => {
            if (this.mx !== mx) {
              return;
            }
            for (const chatEvent of reactionUpdateEventsForTarget(
              room,
              targetId,
              snapshot.reactions,
              threadIdHint,
            )) {
              this.emit(chatEvent);
            }
          })
          .catch(() => {
            if (this.mx === mx) {
              this.emit({ type: "chat:changed", chatId: room.roomId });
              if (threadIdHint || room.getThread(targetId)) {
                this.emit({ type: "threads:changed", chatId: room.roomId });
              }
            }
          });
        return;
      }
      for (const chatEvent of timelineEventToChatEvent(
        event,
        room,
        selfUserId,
      )) {
        this.emit(chatEvent);
      }
      emitUnread(room);
    };
    const onReceipt = (event: MatrixEvent, room: Room | undefined) => {
      if (!room || !receiptMentionsUser(event, selfUserId)) {
        return;
      }
      emitUnread(room);
      emitThreadsRefresh(room);
    };
    const onThreadNew = (thread: Thread, toStartOfTimeline: boolean) => {
      const reply = thread.replyToEvent ?? undefined;
      if (toStartOfTimeline || !reply) {
        return;
      }
      if (isOwnThreadEcho(reply)) {
        return;
      }
      const replyKey = scopedThreadReplyKey(thread, reply);
      const wasPendingLive = Boolean(
        replyKey && pendingLiveThreadReplies.delete(replyKey),
      );
      if (wasPendingLive || observeThreadReply(thread, reply, true)) {
        emitThreadChanged(thread, reply);
      }
    };
    const onThreadReply = (thread: Thread, event: MatrixEvent) => {
      const replyKey = scopedThreadReplyKey(thread, event);
      if (replyKey && pendingLiveThreadReplies.delete(replyKey)) {
        emitThreadChanged(thread, event);
      }
    };
    const detachThreadListenersByRoomId = new Map<string, () => void>();
    const attachThreadListeners = (room: Room) => {
      if (detachThreadListenersByRoomId.has(room.roomId)) {
        return;
      }
      room.getThreads().forEach(getThreadReplyCounter);
      room.on(ThreadEvent.New, onThreadNew);
      room.on(ThreadEvent.NewReply, onThreadReply);
      detachThreadListenersByRoomId.set(room.roomId, () => {
        room.off(ThreadEvent.New, onThreadNew);
        room.off(ThreadEvent.NewReply, onThreadReply);
      });
    };
    // A joined / left / created room changes what the list shows; drop the
    // cached joined-room set so `getChats` re-reads it.
    const onRoom = (room: Room) => {
      attachThreadListeners(room);
      this.joinedRoomIds = null;
      emitUnread(room);
      this.emit({ type: "chats:changed" });
    };
    // Reconnect / first authentic network sync. A warm start resolves the
    // initial sync from IndexedDB (`fromCache`) before the network catches up,
    // and a dropped connection resumes at `Syncing` from a non-`Syncing` state;
    // both can leave the `staleTime: Infinity` caches behind, so force a coarse
    // re-read of the visible rooms. Steady-state `Syncing → Syncing` and the
    // cache-sourced state are skipped, so this fires rarely.
    const onSync = (
      state: SyncState,
      prevState: SyncState | null,
      data?: SyncStateData,
    ) => {
      if (
        state !== SyncState.Syncing ||
        prevState === SyncState.Syncing ||
        data?.fromCache === true
      ) {
        return;
      }
      this.joinedRoomIds = null;
      for (const room of mx.getVisibleRooms()) {
        this.emit({ type: "chat:changed", chatId: room.roomId });
        emitUnread(room);
        emitThreadsRefresh(room);
      }
      this.emit({ type: "chats:changed" });
    };
    // Our own membership changing (leaving, being kicked/banned, joining) alters
    // the conversation list, but a leave is an ordinary incremental sync: it
    // fires neither `ClientEvent.Room` (the room is not brand-new) nor `onSync`
    // (steady-state `Syncing`). Drop the cached joined set and refresh the list
    // here so a left room does not linger. `onRoom` handles brand-new joins.
    const onMyMembership = (room: Room) => {
      this.joinedRoomIds = null;
      emitUnread(room);
      this.emit({ type: "chats:changed" });
    };
    mx.getRooms().forEach(attachThreadListeners);
    mx.on(RoomEvent.Timeline, onTimeline);
    mx.on(RoomEvent.Receipt, onReceipt);
    mx.on(ClientEvent.Room, onRoom);
    mx.on(ClientEvent.Sync, onSync);
    mx.on(RoomEvent.MyMembership, onMyMembership);
    this.detachSync = () => {
      mx.off(RoomEvent.Timeline, onTimeline);
      mx.off(RoomEvent.Receipt, onReceipt);
      mx.off(ClientEvent.Room, onRoom);
      mx.off(ClientEvent.Sync, onSync);
      mx.off(RoomEvent.MyMembership, onMyMembership);
      detachThreadListenersByRoomId.forEach((detach) => detach());
      detachThreadListenersByRoomId.clear();
      pendingLiveThreadReplies.clear();
    };
  }

  private async startClientOrFailOnLogout(mx: MatrixClient): Promise<void> {
    let cleanup = () => {};
    const loggedOut = new Promise<never>((_, reject) => {
      const onLoggedOut = (error: MatrixError) => {
        cleanup();
        reject(error);
      };
      cleanup = () => mx.off(HttpApiEvent.SessionLoggedOut, onLoggedOut);
      mx.once(HttpApiEvent.SessionLoggedOut, onLoggedOut);
    });

    try {
      await Promise.race([startClient(mx), loggedOut]);
    } finally {
      cleanup();
    }
  }

  /**
   * Wires OIDC token refresh for this session. Returns `undefined` when the
   * pieces needed to refresh are missing (no refresh token, no persisted OIDC
   * session) — the client then behaves as before, just without auto-refresh.
   * On a successful refresh the rotated tokens are persisted so the next page
   * load starts from a valid access token instead of a dead one.
   */
  private buildTokenRefreshFunction(user: MatrixUserInterface) {
    const oidc = this.readStoredJson<StoredOidc>(STORAGE.oidc);
    if (!oidc || !user.refreshToken || !user.deviceId) {
      return undefined;
    }
    return buildOidcTokenRefreshFunction({
      issuer: oidc.issuer,
      clientId: oidc.clientId,
      redirectUri: oidc.redirectUri,
      deviceId: user.deviceId,
      idTokenClaims: oidc.idTokenClaims,
      onTokensRefreshed: ({ accessToken, refreshToken }) => {
        this.writeStoredJson(STORAGE.user, {
          ...user,
          accessToken,
          refreshToken: refreshToken ?? user.refreshToken,
        } satisfies MatrixUserInterface);
      },
    });
  }

  private clearCallbackParams(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());
  }

  /**
   * Detaches the `/sync` bridge and drops every client-scoped cache. Safe to run
   * with no client. Subscribers are left alone: `clearStoredSession` reconnects
   * afterwards, and only {@link destroy} ends the stream for good.
   */
  private teardownClient(): void {
    this.detachSync();
    this.detachSync = () => {};
    this.mx?.stopClient();
    this.mx = null;
    this.joinedRoomIds = null;
    this.sentThreadReplyEventIds.clear();
  }

  destroy(): void {
    this.teardownClient();
    this.eventListeners.clear();
  }

  /**
   * Single global real-time stream. Subscribers just join/leave the set; the
   * Matrix `/sync` bridge that feeds them is attached for the client's lifetime
   * in {@link bootstrapClient} (it may not exist yet when the UI subscribes).
   * Events for ALL conversations flow through here, so the UI mounts this once.
   */
  subscribeToEvents(listener: ChatEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private emit(event: ChatEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  // --- Token persistence (driver-owned, no separate store) ----------------

  /** Reads an account-scoped JSON blob, dropping it when it cannot be parsed. */
  private readStoredJson<T>(key: string): T | null {
    const storageKey = this.key(key);
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  private writeStoredJson(key: string, value: unknown): void {
    localStorage.setItem(this.key(key), JSON.stringify(value));
  }

  private async clearStoredSession(user?: MatrixUserInterface): Promise<void> {
    this.teardownClient();

    localStorage.removeItem(this.key(STORAGE.user));
    localStorage.removeItem(this.key(STORAGE.oidc));
    sessionStorage.removeItem(this.key(STORAGE.oidcState));
    sessionStorage.removeItem(this.key(OIDC_HS_KEY));

    await Promise.all([
      this.deleteIndexedDb(this.key(SYNC_STORE_DB_NAME)),
      this.deleteIndexedDb(this.key(CRYPTO_STORE_DB_NAME)),
      ...(user ? [this.deleteIndexedDb(this.cryptoStoreDbName(user))] : []),
    ]);
  }

  private deleteIndexedDb(dbName: string): Promise<void> {
    if (typeof indexedDB === "undefined") {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn("MatrixDriver: failed to delete IndexedDB", dbName);
        resolve();
      };
      request.onblocked = () => {
        console.warn("MatrixDriver: IndexedDB deletion blocked", dbName);
        resolve();
      };
    });
  }

  private setStorageOwner(user: User | null | undefined): void {
    const owner = this.resolveLoginHint(user).trim();
    this.storageOwner = owner || null;
  }

  private key(key: string): string {
    return storageKey(this.accountId, key, this.storageOwner);
  }

  private cryptoStoreDbName(user: MatrixUserInterface): string {
    return this.key(
      `${CRYPTO_STORE_DB_NAME}:${user.mxId}:${user.deviceId ?? "no-device"}`,
    );
  }

  private async getJoinedRoomIds(mx: MatrixClient): Promise<Set<string>> {
    return this.joinedRoomIds ?? this.refreshJoinedRoomIds(mx);
  }

  private async refreshJoinedRoomIds(mx: MatrixClient): Promise<Set<string>> {
    const { joined_rooms: joinedRooms } = await mx.getJoinedRooms();
    const joinedRoomIds = new Set(joinedRooms);
    this.joinedRoomIds = joinedRoomIds;
    return joinedRoomIds;
  }
}
