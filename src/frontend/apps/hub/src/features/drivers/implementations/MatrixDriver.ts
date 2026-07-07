import {
  ClientEvent,
  EventTimeline,
  EventType,
  type MatrixClient,
  type MatrixEvent,
  MatrixEventEvent,
  MsgType,
  NotificationCountType,
  Preset,
  RelationsEvent,
  RelationType,
  type Room,
  RoomEvent,
  SyncState,
  type SyncStateData,
  type Thread,
  ThreadEvent,
} from "matrix-js-sdk/lib/matrix";
import { KnownMembership } from "matrix-js-sdk/lib/@types/membership";

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
import {
  AVATAR_COLORS,
  AvatarColor,
} from "@/features/ui/components/avatar/palette";

import {
  ChatConnectionState,
  ChatEvent,
  ChatEventListener,
  ChatUserFilters,
  Driver,
  GetChatMessagesParams,
  GetChatThreadParams,
  MarkChatThreadReadParams,
  SendChatMessageParams,
  SendChatThreadReplyParams,
  StartChatThreadParams,
  ToggleChatReactionParams,
  ToggleChatThreadReactionParams,
} from "../Driver";
import { getMockChatDocuments } from "../mocks/mockDocuments";
import {
  AccountId,
  ChatDocumentsPage,
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

/** Matches `getChatMessages`'s default; the homeserver may clamp it lower. */
const DEFAULT_CHAT_PAGE_SIZE = 50;

/**
 * People search asks the homeserver for a few more results than it shows, so
 * filtering out the connected user and already-selected participants still
 * leaves a full dropdown.
 */
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

const storageKey = (accountId: AccountId, key: string): string =>
  accountId === "default" ? key : `${key}:${accountId}`;

const toChatUser = (user: MatrixUserInterface): ChatLocalUser => ({
  userId: user.mxId,
  accessToken: user.accessToken,
  refreshToken: user.refreshToken,
});

/**
 * The other members of a room — every member except the connected user. This is
 * the conversation's participant set: it drives `kind`/`name` in
 * `matrixRoomToLocalChat` and is the set `getChatForUsers` matches against, so
 * both derive it from one place and can never disagree.
 */
const roomParticipantIds = (
  room: Room,
  currentUserId: string | undefined,
): string[] =>
  room
    .getMembers()
    .map((member) => member.userId)
    .filter((userId) => userId !== currentUserId);

/** Order- and duplicate-independent key for comparing two participant sets. */
const participantSetKey = (userIds: string[]): string =>
  [...new Set(userIds)].sort().join("\\u0000");

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
 * plus the raw event timestamp the row uses for `lastActivityAt` and list
 * sorting. Best-effort: an invite room exposes only stripped state, so each
 * field is filled only when present.
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
      room.name || invitation.inviterName || invitation.inviterId || room.roomId,
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

/** The room's explicit `m.room.name`, when set to a non-empty value. */
const explicitRoomName = (room: Room): string | undefined => {
  const name = room.currentState
    ?.getStateEvents(EventType.RoomName, "")
    ?.getContent<{ name?: string }>()?.name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
};

/** Display names of the joined members other than the current user. */
const otherJoinedMemberNames = (
  room: Room,
  currentUserId: string | undefined,
): string[] =>
  room
    .getJoinedMembers()
    .filter((member) => member.userId !== currentUserId)
    .map((member) => member.name || member.userId);

/** Maps a joined room to a normal conversation row. */
const matrixJoinedRoomToLocalChat = (
  room: Room,
  currentUserId: string | undefined,
): LocalChat => {
  const participantIds = roomParticipantIds(room, currentUserId);
  const isDirect = room.getJoinedMemberCount() === 2;
  const otherNames = otherJoinedMemberNames(room, currentUserId);
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
    visual: isDirect
      ? { kind: "initials" }
      : { kind: "icon", icon: "groups" },
    membership: "join",
  };
};

/**
 * Maps a room to a `LocalChat`, branching on the current user's membership: an
 * invited room becomes an invitation row, every other room a joined
 * conversation. Both reads (`getChats`, `getChat`) and the accept flow go
 * through here so the two mappings can never drift.
 */
const matrixRoomToLocalChat = (
  room: Room,
  currentUserId: string | undefined,
): LocalChat =>
  room.getMyMembership() === KnownMembership.Invite
    ? matrixInviteRoomToLocalChat(room, currentUserId)
    : matrixJoinedRoomToLocalChat(room, currentUserId);

/**
 * Deterministic avatar identity for a Matrix sender, mirroring the `Avatar`
 * component's own hashing so a member keeps the same colour everywhere it is
 * rendered. The driver depends only on the palette, not on the React component.
 */
const hashString = (value: string): number => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
};

const colorFor = (seed: string): AvatarColor =>
  AVATAR_COLORS[hashString(seed) % AVATAR_COLORS.length];

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
    color: colorFor(user.user_id),
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

/**
 * Whether the connected user has unread activity in the room's main timeline:
 * any loaded message from another sender they have not read yet. Receipt-driven
 * (not push counters) like `computeThreadUnread`, so it is deterministic,
 * immediate, and catches every unread message (including ones that raise no push
 * notification); it clears once the user reads — or sends, since the SDK advances
 * their read receipt to their own message.
 */
const computeRoomUnread = (
  room: Room,
  selfUserId: string | undefined,
): boolean => {
  if (!selfUserId) {
    return false;
  }
  return room
    .getLiveTimeline()
    .getEvents()
    .filter(isMessageEvent)
    .some(
      (event) =>
        event.getSender() !== selfUserId &&
        !room.hasUserReadEvent(selfUserId, event.getId() ?? ""),
    );
};

/**
 * The room's `ChatUnread`: the dot is on when the main timeline has an unread
 * message OR any thread has an unread reply — both receipt-based
 * (`computeRoomUnread` / `hasUnreadThread`), so it is immediate and exhaustive.
 * The highlight comes from the homeserver-maintained notification count
 * (mentions, which receipts cannot distinguish). Counts are NOT used for the
 * dot: they lag the server rollup and ignore non-notifying messages (verified
 * against the local stack).
 */
const roomUnread = (room: Room, selfUserId: string | undefined): ChatUnread => ({
  unread:
    computeRoomUnread(room, selfUserId) || hasUnreadThread(room, selfUserId),
  highlight:
    room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) > 0,
});

/**
 * Whether a `RoomEvent.Receipt` event carries a read receipt for `userId` —
 * the only receipts that move the connected user's own unread dot.
 */
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
    return { id, name, initials: initialsFor(name), color: colorFor(id) };
  });
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

/**
 * Every `Relations` object that may hold an event's reactions. The SDK can put
 * thread-reply annotations in the thread timeline set while root/main messages
 * use `room.relations`; in practice partially-loaded clients can know about
 * both, so reads merge the containers instead of picking the first non-empty
 * one.
 */
const reactionRelationContainersFor = (
  room: Room,
  eventId: string,
  threadRootId?: string,
) => {
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
    [target?.threadRootId, threadRootId, room.getThread(eventId)?.id].filter(
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

  if (containers.length === 0) {
    for (const thread of room.getThreads()) {
      addReactionRelations(
        containers,
        seen,
        thread.timelineSet.relations.getChildEventsForEvent(
          eventId,
          RelationType.Annotation,
          EventType.Reaction,
        ),
      );
    }
  }

  return containers;
};

/**
 * Aggregates the `m.annotation` reactions of a single message into the UI shape:
 * one `ChatReaction` per emoji with the non-redacted, sender-deduplicated count
 * and whether the connected user is part of it. Pure over the SDK relation
 * store, so the same mapping serves reads (`getChatMessages`) and the live
 * bridge.
 */
const aggregateReactions = (
  room: Room,
  eventId: string,
  selfUserId: string | undefined,
  threadRootId?: string,
): ChatReaction[] => {
  const grouped = new Map<
    string,
    { emoji: string; activeBySender: Map<string, MatrixEvent> }
  >();
  const seenEventIds = new Set<string>();

  for (const relations of reactionRelationContainersFor(
    room,
    eventId,
    threadRootId,
  )) {
    for (const event of relations.getRelations()) {
      const id = event.getId();
      if ((id && seenEventIds.has(id)) || event.isRedacted()) {
        continue;
      }
      if (id) {
        seenEventIds.add(id);
      }
      const emoji = event.getRelation()?.key;
      if (!emoji) {
        continue;
      }
      const key = emojiToCodepoints(emoji);
      const group =
        grouped.get(key) ??
        (() => {
          const created = {
            emoji,
            activeBySender: new Map<string, MatrixEvent>(),
          };
          grouped.set(key, created);
          return created;
        })();
      const sender = event.getSender() ?? id ?? "";
      if (!group.activeBySender.has(sender)) {
        group.activeBySender.set(sender, event);
      }
    }
  }

  const reactions: ChatReaction[] = [];
  for (const { emoji, activeBySender } of grouped.values()) {
    const active = [...activeBySender.values()];
    if (active.length === 0) {
      continue;
    }
    reactions.push({
      emoji,
      count: active.length,
      reactedByMe:
        selfUserId !== undefined &&
        active.some((event) => event.getSender() === selfUserId),
    });
  }
  return reactions;
};

/** The connected user's own non-redacted annotations with `emoji`, if any. */
const findOwnAnnotations = (
  room: Room,
  messageId: string,
  emoji: string,
  selfUserId: string | undefined,
  threadRootId?: string,
): MatrixEvent[] => {
  const key = emojiToCodepoints(emoji);
  const seenEventIds = new Set<string>();
  const annotations: MatrixEvent[] = [];
  for (const relations of reactionRelationContainersFor(
    room,
    messageId,
    threadRootId,
  )) {
    for (const event of relations.getRelations()) {
      const id = event.getId();
      if (id && seenEventIds.has(id)) {
        continue;
      }
      if (id) {
        seenEventIds.add(id);
      }
      if (
        !event.isRedacted() &&
        event.getSender() === selfUserId &&
        emojiToCodepoints(event.getRelation()?.key ?? "") === key
      ) {
        annotations.push(event);
      }
    }
  }
  return annotations;
};

const reactionUpdateEventsForTarget = (
  room: Room,
  targetId: string,
  selfUserId: string | undefined,
  threadRootId?: string,
): ChatEvent[] => {
  const target = room.findEventById(targetId);
  const detailThreadRootId = target?.threadRootId ?? threadRootId;
  const reactions = aggregateReactions(
    room,
    targetId,
    selfUserId,
    detailThreadRootId,
  );
  const events: ChatEvent[] = [
    {
      type: "reaction:updated",
      chatId: room.roomId,
      messageId: targetId,
      reactions,
    },
  ];

  const rootThreadId = room.getThread(targetId)?.id;
  const detailThreadId = detailThreadRootId ?? rootThreadId;
  if (detailThreadId) {
    events.push({
      type: "reaction:updated",
      chatId: room.roomId,
      messageId: targetId,
      reactions,
      threadId: detailThreadId,
    });
  }

  return events;
};

/**
 * Maps a synced reaction event to the cache patches it should drive. Reactions
 * to thread replies patch the open thread detail; reactions to thread roots patch
 * both the main message and the thread detail root copy.
 */
const reactionEventToChatEvents = (
  event: MatrixEvent,
  room: Room,
  selfUserId: string | undefined,
): ChatEvent[] => {
  const targetId = event.getRelation()?.event_id;
  if (!targetId) {
    return [{ type: "chat:changed", chatId: room.roomId }];
  }
  return reactionUpdateEventsForTarget(
    room,
    targetId,
    selfUserId,
    event.threadRootId,
  );
};

/** Thread reply message events (the root event excluded), in timeline order. */
const threadReplyEvents = (thread: Thread): MatrixEvent[] =>
  thread.events.filter(
    (event) => isMessageEvent(event) && event.getId() !== thread.id,
  );

const sortedThreadReplyEvents = (thread: Thread): MatrixEvent[] =>
  [...threadReplyEvents(thread)].sort((a, b) => a.getTs() - b.getTs());

/**
 * Replies the connected user has not read yet, scoped to threads that concern
 * them: direct conversations subscribe both people implicitly; group threads
 * subscribe the root author immediately, then any other user from their first
 * reply onward. Own replies never count as unread. Computed from receipts (not
 * push counters) so it is deterministic and reflected across sessions.
 */
const threadUnreadReplyEvents = (
  room: Room,
  thread: Thread,
  selfUserId: string | undefined,
): MatrixEvent[] => {
  if (!selfUserId) {
    return [];
  }
  let isSubscribed =
    room.getJoinedMemberCount() === 2 ||
    thread.rootEvent?.getSender() === selfUserId;
  const unread: MatrixEvent[] = [];

  for (const event of sortedThreadReplyEvents(thread)) {
    if (event.getSender() === selfUserId) {
      isSubscribed = true;
      continue;
    }
    if (
      isSubscribed &&
      !thread.hasUserReadEvent(selfUserId, event.getId() ?? "")
    ) {
      unread.push(event);
    }
  }

  return unread;
};

const computeThreadUnread = (
  room: Room,
  thread: Thread,
  selfUserId: string | undefined,
): number => threadUnreadReplyEvents(room, thread, selfUserId).length;

/** Whether any of the room's loaded threads has an unread reply for the user. */
const hasUnreadThread = (room: Room, selfUserId: string | undefined): boolean =>
  room
    .getThreads()
    .some((thread) => computeThreadUnread(room, thread, selfUserId) > 0);

/**
 * A `ChatMessageAuthor` for a single sender, folding the connected user onto the
 * `"me"` sentinel (their bubbles render as "sent" and never look an author up,
 * but the thread detail still lists `authors` for the others).
 */
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
    color: colorFor(userId),
  };
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
    reactions: aggregateReactions(room, eventId, selfUserId, event.threadRootId),
  };
  // A message that opened a thread carries the live thread summary so the UI
  // renders its "N replies" button (see `ChatThreadSummary`).
  const thread = room.getThread(eventId);
  if (thread) {
    message.thread = {
      id: thread.id,
      replyCount: thread.length,
      unreadCount: computeThreadUnread(room, thread, selfUserId),
    };
  }
  return message;
};

/** Maps a room thread to the list-row shape, newest-reply metadata up front. */
const threadToChatThread = (
  room: Room,
  thread: Thread,
  selfUserId: string | undefined,
): ChatThread => {
  const lastReply = thread.replyToEvent;
  const lastSender = lastReply?.getSender() ?? thread.rootEvent?.getSender() ?? "";
  const lastBody = lastReply?.getContent<{ body?: string }>().body;
  const lastTs = lastReply?.getTs() ?? thread.rootEvent?.getTs() ?? 0;
  return {
    id: thread.id,
    rootMessageId: thread.id,
    author: authorForSender(room, lastSender, selfUserId),
    lastReplyAt: new Date(lastTs).toISOString(),
    lastReplyPreview: typeof lastBody === "string" ? lastBody : "",
    replyCount: thread.length,
    unreadCount: computeThreadUnread(room, thread, selfUserId),
  };
};

/** Maps a room thread to its detail: root message first, then replies. */
const threadToChatThreadDetail = (
  room: Room,
  thread: Thread,
  selfUserId: string | undefined,
): ChatThreadDetail => {
  const replies = sortedThreadReplyEvents(thread);
  const events = thread.rootEvent ? [thread.rootEvent, ...replies] : replies;
  const messages = events.map((event) =>
    matrixEventToChatMessage(event, room, selfUserId),
  );
  const unreadReplyIds = new Set(
    threadUnreadReplyEvents(room, thread, selfUserId)
      .map((event) => event.getId())
      .filter((id): id is string => Boolean(id)),
  );
  const firstUnread = replies.findIndex((event) =>
    unreadReplyIds.has(event.getId() ?? ""),
  );
  return {
    id: thread.id,
    rootMessageId: thread.id,
    messages,
    authors: buildAuthors(room, events, selfUserId),
    firstUnreadIndex:
      firstUnread === -1 ? null : firstUnread + (thread.rootEvent ? 1 : 0),
  };
};

/**
 * Maps a send response to the final `ChatMessage` the composer hook needs: the
 * REAL server event id (so the optimistic bubble is replaced by a stable,
 * `/sync`-consistent id), folded onto the `"me"` sentinel. Kept a pure function
 * so the send mapping is unit-testable without a live server.
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
 * sending device (`unsigned.transaction_id` / a local `txnId`). Such events are
 * reconciled by the composer hook's optimistic→replace flow, so the bridge must
 * not re-broadcast them (that would duplicate the bubble).
 *
 * This is deliberately NARROWER than "sent by the current user": a message the
 * same user sends from ANOTHER device (e.g. Element) carries no local txn id
 * here, so it is delivered live like any other incoming message.
 */
const isOwnEcho = (event: MatrixEvent): boolean =>
  event.status !== null ||
  Boolean(event.getUnsigned()?.transaction_id) ||
  Boolean(event.getTxnId());

/**
 * Redactions are emitted by the SDK on `RoomEvent.Redaction` rather than being
 * reliable plain timeline events. They often carry too little data to patch one
 * exact message (a redacted reaction loses its relation content), so keep the
 * update coarse but correctly scoped: main timeline redactions refresh the
 * conversation, thread redactions refresh thread caches and the root summary.
 */
export const redactionEventToChatEvent = (
  event: MatrixEvent,
  room: Room,
  selfUserId: string | undefined,
  threadRootId?: string,
): ChatEvent[] => {
  // Suppress only THIS session's own echo (the optimistic toggle already applied
  // it); a redaction from the same user on another device carries no local txn id
  // and must still refresh, like any other incoming change.
  if (isOwnEcho(event)) {
    return [];
  }
  if (!threadRootId) {
    return [{ type: "chat:changed", chatId: room.roomId }];
  }
  const events: ChatEvent[] = [{ type: "threads:changed", chatId: room.roomId }];
  const root = room.findEventById(threadRootId);
  if (root) {
    events.push({
      type: "message:updated",
      chatId: room.roomId,
      message: matrixEventToChatMessage(root, room, selfUserId),
    });
  }
  return events;
};

/**
 * Translates a single LIVE timeline event into the fine-grained `ChatEvent`s the
 * bridge should broadcast — an array, since one timeline event can drive several
 * cache operations (a thread reply refreshes both the thread list and its root
 * message). An empty array means "broadcast nothing".
 *
 * This session's own outgoing echoes return `[]` (see {@link isOwnEcho}): they
 * are reconciled by the optimistic→replace flow (messages) or the mutation
 * hooks (thread replies), so re-broadcasting would duplicate state.
 * Reactions are deliberately NOT handled here — the reaction bridge
 * (`ClientEvent.Event`, see {@link bootstrapClient}) owns them, because the SDK
 * updates `room.relations` through several paths and only the live-timeline one
 * fires `RoomEvent.Timeline`. From OTHER senders: a thread reply becomes
 * `threads:changed` plus a `message:updated` for its root (so the "N replies"
 * button updates); an un-reaction (redaction) and other non-message activity
 * stay coarse (`chat:changed`) so the affected caches refetch; an edit
 * (`m.replace`) becomes `message:updated`; a plain new message becomes
 * `message:new` (with `authors`).
 *
 * Pure (no client, no driver state) so the bridge mapping is unit-testable.
 */
export const timelineEventToChatEvent = (
  event: MatrixEvent,
  room: Room,
  selfUserId: string | undefined,
): ChatEvent[] => {
  const type = event.getType();

  if (type === EventType.RoomRedaction) {
    return redactionEventToChatEvent(
      event,
      room,
      selfUserId,
      event.threadRootId,
    );
  }

  // Reactions are owned by the relation bridge (`onClientEvent`), not the
  // timeline: `RoomEvent.Timeline` only fires for the live-aggregation path,
  // missing thread/gappy/encrypted reactions. A no-op here avoids double work.
  if (type === EventType.Reaction) {
    return [];
  }

  if (!isMessageEvent(event)) {
    return [{ type: "chat:changed", chatId: room.roomId }];
  }

  // A thread reply does not live in the main timeline: refresh the thread list
  // and the root message's summary instead of appending a bubble.
  const threadRootId = event.threadRootId;
  if (threadRootId) {
    if (isOwnEcho(event)) {
      return [];
    }
    const events: ChatEvent[] = [
      { type: "threads:changed", chatId: room.roomId },
    ];
    const root = room.findEventById(threadRootId);
    if (root) {
      events.push({
        type: "message:updated",
        chatId: room.roomId,
        message: matrixEventToChatMessage(root, room, selfUserId),
      });
    }
    return events;
  }

  if (isOwnEcho(event)) {
    return [];
  }
  const relation = event.getRelation();
  if (relation?.rel_type === RelationType.Replace && relation.event_id) {
    const newBody = event.getContent<{ "m.new_content"?: { body?: string } }>()[
      "m.new_content"
    ]?.body;
    return [
      {
        type: "message:updated",
        chatId: room.roomId,
        message: {
          id: relation.event_id,
          authorId: toAuthorId(event.getSender(), selfUserId),
          content: typeof newBody === "string" ? newBody : "",
          timestamp: new Date(event.getTs()).toISOString(),
          reactions: aggregateReactions(room, relation.event_id, selfUserId),
        },
      },
    ];
  }
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
 * It extends the abstract `Driver` (not `MockDriver`): every contract method is
 * implemented explicitly here, so the compiler rejects any method that would
 * otherwise silently fall back to fabricated mock data. Reads and writes hit the
 * live client — conversations (`getChat`, `getChats`, `getChatMessages`), text
 * sending, threads (read, reply, start), `m.annotation` reactions,
 * read-receipt-driven unread counts, and the New Chat people search +
 * existing-conversation resolution (user directory + participant-set room
 * match). Documents are the only surface deliberately kept on the shared mock
 * helpers (their real behavior is undecided, handled in a later change).
 */
export class MatrixDriver extends Driver {
  override readonly supportsComposition: boolean = true;
  override readonly supportsConversationCreation: boolean = true;

  private mx: MatrixClient | null = null;
  /** Subscribers to the single global event stream. */
  private eventListeners = new Set<ChatEventListener>();
  /** Detaches the Matrix `/sync` listeners; set when the client is bootstrapped. */
  private detachSync: () => void = () => {};
  /** Parsed per-account config; the single source for discovery and OIDC. */
  private readonly settings: MatrixDriverSettings;
  /** Guards local-dev auto-join from racing duplicate invite events. */
  private readonly joiningInviteRoomIds = new Set<string>();
  /** Relation containers already watched for reaction redactions. */
  private readonly reactionRelationRedactionListeners = new Map<
    ReactionRelations,
    (event: MatrixEvent) => void
  >();
  /**
   * Storage namespace for the Hub/Matrix login context currently being
   * connected. `matrix-local` can be used by several seeded users in the same
   * browser, so credentials must not be keyed only by account id.
   */
  private storageOwner: string | null = null;

  constructor(
    accountId: AccountId = "default",
    settings: Record<string, unknown> = {},
  ) {
    super(accountId);
    this.settings = parseMatrixDriverSettings(settings);
  }

  private watchReactionRelations(
    room: Room,
    eventId: string,
    threadRootId?: string,
  ): void {
    for (const relations of reactionRelationContainersFor(
      room,
      eventId,
      threadRootId,
    )) {
      if (this.reactionRelationRedactionListeners.has(relations)) {
        continue;
      }
      const onRedactedReaction = (redactedReaction: MatrixEvent) => {
        const mx = this.mx;
        const currentRoom =
          mx?.getRoom(redactedReaction.getRoomId() ?? room.roomId) ?? room;
        for (const chatEvent of reactionEventToChatEvents(
          redactedReaction,
          currentRoom,
          mx?.getUserId() ?? undefined,
        )) {
          this.emit(chatEvent);
        }
      };
      relations.on(RelationsEvent.Redaction, onRedactedReaction);
      this.reactionRelationRedactionListeners.set(
        relations,
        onRedactedReaction,
      );
    }
  }

  private detachReactionRelationListeners(): void {
    for (const [
      relations,
      listener,
    ] of this.reactionRelationRedactionListeners) {
      relations.off(RelationsEvent.Redaction, listener);
    }
    this.reactionRelationRedactionListeners.clear();
  }

  /**
   * Resolves the OIDC `login_hint`. Preference order: the account's configured
   * `loginHint` (e.g. the local realm user), then the dev override
   * `NEXT_PUBLIC_MATRIX_DEV_LOGIN_HINT`, then the authenticated Hub user's email.
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
   * Resolves the homeserver for this account per its discovery strategy.
   * `fixed` uses the configured base URL directly with no network call;
   * `tchap-email` performs the identity-server lookup keyed by the login hint.
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
    // MOCK — replace this block with `fetchAPI('chats/')` when the backend
    // exposes a conversation-list endpoint. The driver returns account-local
    // chats; hooks decorate them with the global account identity.
    const currentUserId = this.mx?.getUserId() ?? undefined;
    // Only joined conversations and pending invitations belong in the list;
    // rooms the user has left or been banned from linger in the store but must
    // not appear (otherwise a refused invite would resurface as a joined row).
    const localChats = (this.mx?.getVisibleRooms() ?? [])
      .filter((room) => {
        const membership = room.getMyMembership();
        return (
          membership === KnownMembership.Join ||
          membership === KnownMembership.Invite
        );
      })
      .map((room) => matrixRoomToLocalChat(room, currentUserId));

    return {
      favourites: [],
      all: localChats,
    };
  }

  /**
   * Seeds the read-state slice from the live client: one `ChatUnread` per visible
   * room (see `roomUnread`). Updates after the seed flow through `unread:changed`.
   */
  async getUnread(): Promise<Record<string, ChatUnread>> {
    const selfUserId = this.mx?.getUserId() ?? undefined;
    const unread: Record<string, ChatUnread> = {};
    for (const room of this.mx?.getVisibleRooms() ?? []) {
      unread[room.roomId] = roomUnread(room, selfUserId);
    }
    return unread;
  }

  /**
   * Resolves a single conversation from the live client and maps it with the
   * same helper as `getChats`. Mirrors `getChatMessages`: throws "room not
   * found" for an id the client does not know, rather than fabricating a chat.
   * The mapped chat carries `section: "all"`; its `unread` flag is computed from
   * read receipts (see `matrixRoomToLocalChat`). Section/DM refinements stay
   * deferred to the list-metadata change.
   */
  async getChat(chatId: string): Promise<LocalChat> {
    const mx = this.mx;
    if (!mx) {
      throw new Error("MatrixDriver.getChat: client is not connected.");
    }
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(`MatrixDriver.getChat: room "${chatId}" not found.`);
    }
    return matrixRoomToLocalChat(room, mx.getUserId() ?? undefined);
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
    const mx = this.mx;
    if (!mx) {
      throw new Error("MatrixDriver.getChatMessages: client is not connected.");
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
      const more = await mx.paginateEventTimeline(timeline, {
        backwards: true,
        limit,
      });
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
    for (const event of pageEvents) {
      const eventId = event.getId();
      if (eventId) {
        this.watchReactionRelations(room, eventId, event.threadRootId);
      }
    }
    const messages = pageEvents.map((event) =>
      matrixEventToChatMessage(event, room, selfUserId),
    );
    const authors = buildAuthors(room, pageEvents, selfUserId);
    const nextCursor =
      startIndex === 0 && reachedStart ? null : (messages[0]?.id ?? null);
    return { messages, authors, nextCursor };
  }

  // --- People search and existing-conversation resolution -----------------
  // The New Chat flow reads people and resolves an existing conversation through
  // these two methods. Both hit the live client: search queries the homeserver
  // user directory; resolution matches a visible room by its participant set.
  // (Documents remain the lone deliberately mocked surface, below.)

  /** DELIBERATE MOCK — real document handling is undecided (own later change). */
  async getChatDocuments(): Promise<ChatDocumentsPage> {
    return getMockChatDocuments();
  }

  /**
   * People available when composing a new chat, from the homeserver user
   * directory. The connected user and the already-selected participants
   * (`excludeIds`) are filtered out; an empty/whitespace term returns nothing
   * without hitting the network (the hook already gates on a non-empty query).
   * A generous fetch limit is requested and the filtered list sliced to a small
   * display count, so removing self/excluded never starves the dropdown.
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
   * visible room matches when its members (excluding the connected user) equal
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
    const match = mx
      .getVisibleRooms()
      // Only joined rooms are sendable conversations; a pending invite must be
      // accepted first, so it never resolves as an existing conversation.
      .filter((room) => room.getMyMembership() === KnownMembership.Join)
      .find(
        (room) =>
          participantSetKey(roomParticipantIds(room, selfUserId)) === wanted,
      );
    return match ? matrixRoomToLocalChat(match, selfUserId) : null;
  }

  /**
   * Starts a brand-new conversation for the given participants: a plaintext room
   * with each one invited (a direct chat for a single participant, a group for
   * several). Idempotent — a visible room already matching the set is returned
   * instead of creating a duplicate. Waits until the SDK knows the new room so
   * the returned chat id is immediately usable for the first send and the
   * navigation that follows.
   */
  async createChatForUsers(userIds: string[]): Promise<LocalChat> {
    const mx = this.mx;
    if (!mx) {
      throw new Error("MatrixDriver.createChatForUsers: client is not connected.");
    }
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
      visual: isDirect ? { kind: "initials" } : { kind: "icon", icon: "groups" },
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
  // it. Both emit `chats:changed` so the list reflects the change immediately,
  // alongside the `RoomEvent.MyMembership` bridge (see {@link bootstrapClient}).

  /**
   * Accepts an incoming invitation by joining its room, then maps the result as
   * a joined conversation so the open route can switch from the invitation
   * detail view to the normal timeline. Mapped through
   * {@link matrixJoinedRoomToLocalChat} directly (not the membership-branching
   * mapper) so the returned chat is `membership: "join"` even before `/sync`
   * has flipped the local membership.
   */
  async acceptChatInvitation(chatId: string): Promise<LocalChat> {
    const mx = this.mx;
    if (!mx) {
      throw new Error(
        "MatrixDriver.acceptChatInvitation: client is not connected.",
      );
    }
    await mx.joinRoom(chatId);
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(
        `MatrixDriver.acceptChatInvitation: room "${chatId}" not found after join.`,
      );
    }
    // `joinRoom` resolves before `/sync` delivers the room's timeline, so the
    // conversation view's first `getChatMessages` would otherwise read an empty,
    // not-yet-paginated timeline and show no prior history. Wait for the timeline
    // to surface (or a short timeout) before the UI reads it.
    await this.waitForRoomTimeline(room);
    this.emit({ type: "chats:changed" });
    return matrixJoinedRoomToLocalChat(room, mx.getUserId() ?? undefined);
  }

  /**
   * Resolves once a just-joined room's live timeline has synced — it carries a
   * loaded message or a backward-pagination token — or after `timeoutMs`. A
   * genuinely empty room simply waits out the timeout (there is nothing to
   * load), which keeps the accept flow responsive without a per-room special case.
   */
  private waitForRoomTimeline(room: Room, timeoutMs = 8000): Promise<void> {
    const mx = this.mx;
    const isReady = () =>
      room.getLiveTimeline().getEvents().some(isMessageEvent) ||
      Boolean(
        room
          .getLiveTimeline()
          .getPaginationToken(EventTimeline.BACKWARDS),
      );
    if (!mx || isReady()) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const cleanup = () => {
        mx.off(RoomEvent.Timeline, onTimeline);
        clearTimeout(timer);
      };
      const onTimeline = (_event: MatrixEvent, eventRoom: Room | undefined) => {
        if (eventRoom?.roomId === room.roomId && isReady()) {
          cleanup();
          resolve();
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);
      mx.on(RoomEvent.Timeline, onTimeline);
    });
  }

  /** Refuses an incoming invitation by leaving its room. */
  async refuseChatInvitation(chatId: string): Promise<void> {
    const mx = this.mx;
    if (!mx) {
      throw new Error(
        "MatrixDriver.refuseChatInvitation: client is not connected.",
      );
    }
    await mx.leave(chatId);
    this.emit({ type: "chats:changed" });
  }

  // --- Threads, reactions and read receipts -------------------------------
  // Backed by the live client: the matrix-js-sdk threads API, `m.annotation`
  // reactions, and read receipts. Reads never throw while rendering a known
  // room; actions resolve with the same shapes the mock driver returns.

  /** Resolves the live client and a known room, or throws explicitly. */
  private requireRoom(method: string, chatId: string): { mx: MatrixClient; room: Room } {
    const mx = this.mx;
    if (!mx) {
      throw new Error(`MatrixDriver.${method}: client is not connected.`);
    }
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(`MatrixDriver.${method}: room "${chatId}" not found.`);
    }
    return { mx, room };
  }

  /** Back-paginates a thread's timeline until every reply is in memory. */
  private async loadAllThreadReplies(
    mx: MatrixClient,
    thread: Thread,
  ): Promise<void> {
    const timeline = thread.liveTimeline;
    // Bounded so a pathological thread cannot loop forever; seeded threads load
    // in one page.
    for (let guard = 0; guard < 20; guard += 1) {
      const more = await mx.paginateEventTimeline(timeline, {
        backwards: true,
        limit: DEFAULT_CHAT_PAGE_SIZE,
      });
      if (!more) {
        break;
      }
    }
  }

  /** Conversation threads from the room, most recent reply first. */
  async getChatThreads(chatId: string): Promise<ChatThread[]> {
    const { mx, room } = this.requireRoom("getChatThreads", chatId);
    let threads = room.getThreads();
    if (threads.length === 0) {
      // The SDK may not have eagerly created the thread models yet.
      await room.fetchRoomThreads().catch(() => undefined);
      threads = room.getThreads();
    }
    const selfUserId = mx.getUserId() ?? undefined;
    return threads
      .map((thread) => threadToChatThread(room, thread, selfUserId))
      .sort((a, b) => b.lastReplyAt.localeCompare(a.lastReplyAt));
  }

  /** Full content of a single thread: the root message followed by its replies. */
  async getChatThread({
    chatId,
    threadId,
  }: GetChatThreadParams): Promise<ChatThreadDetail> {
    const { mx, room } = this.requireRoom("getChatThread", chatId);
    let thread = room.getThread(threadId);
    if (!thread) {
      await room.fetchRoomThreads().catch(() => undefined);
      thread = room.getThread(threadId);
    }
    if (!thread) {
      throw new Error(
        `MatrixDriver.getChatThread: thread "${threadId}" not found in room "${chatId}".`,
      );
    }
    await this.loadAllThreadReplies(mx, thread);
    for (const event of [
      ...(thread.rootEvent ? [thread.rootEvent] : []),
      ...sortedThreadReplyEvents(thread),
    ]) {
      const eventId = event.getId();
      if (eventId) {
        this.watchReactionRelations(room, eventId, thread.id);
      }
    }
    return threadToChatThreadDetail(room, thread, mx.getUserId() ?? undefined);
  }

  /**
   * Toggles the connected user's `emoji` reaction on a message: sends an
   * `m.annotation` when absent, or redacts their own annotation when present.
   * Resolves with the updated message — its `reactions` computed with the shared
   * pure {@link toggleReaction} over the current aggregate, so the result is
   * correct immediately (the `/sync` echo later confirms the same value) and can
   * never drift from the optimistic hook update.
   */
  private async toggleReactionOnMessage(
    method: string,
    chatId: string,
    messageId: string,
    emoji: string,
    threadId?: string,
  ): Promise<ChatMessage> {
    const { mx, room } = this.requireRoom(method, chatId);
    const selfUserId = mx.getUserId() ?? undefined;
    const previousReactions = aggregateReactions(
      room,
      messageId,
      selfUserId,
      threadId,
    );
    this.watchReactionRelations(room, messageId, threadId);
    const ownAnnotations = findOwnAnnotations(
      room,
      messageId,
      emoji,
      selfUserId,
      threadId,
    );
    if (ownAnnotations.length > 0) {
      const ownAnnotationIds = [
        ...new Set(
          ownAnnotations
            .map((event) => event.getId())
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (ownAnnotationIds.length === 0) {
        throw new Error(
          `${method}: found own reaction annotations without event ids.`,
        );
      }
      await Promise.all(
        ownAnnotationIds.map((eventId) => mx.redactEvent(chatId, eventId)),
      );
    } else {
      const key = emojiToCodepoints(emoji);
      const expectedOwnReaction = previousReactions.some(
        (reaction) =>
          reaction.reactedByMe && emojiToCodepoints(reaction.emoji) === key,
      );
      if (expectedOwnReaction) {
        throw new Error(
          `${method}: unable to locate the user's own reaction annotation.`,
        );
      }
      await mx.sendEvent(chatId, EventType.Reaction, {
        "m.relates_to": {
          rel_type: RelationType.Annotation,
          event_id: messageId,
          key: emoji,
        },
      });
    }
    const target = room.findEventById(messageId);
    const reactions = toggleReaction(previousReactions, emoji);
    const base: ChatMessage = target
      ? matrixEventToChatMessage(target, room, selfUserId)
      : {
          id: messageId,
          authorId: "",
          content: "",
          timestamp: new Date().toISOString(),
          reactions: [],
        };
    return { ...base, reactions };
  }

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

  async toggleChatThreadReaction({
    chatId,
    threadId,
    messageId,
    emoji,
  }: ToggleChatThreadReactionParams): Promise<ChatMessage> {
    // A reaction relates to the message event id whether or not the message
    // lives in a thread, so the operation is identical.
    return this.toggleReactionOnMessage(
      "toggleChatThreadReaction",
      chatId,
      messageId,
      emoji,
      threadId,
    );
  }

  /** Sends a read receipt for the thread's latest reply, clearing its unread count. */
  async markChatThreadRead({
    chatId,
    threadId,
  }: MarkChatThreadReadParams): Promise<void> {
    const { mx, room } = this.requireRoom("markChatThreadRead", chatId);
    const thread = room.getThread(threadId);
    const last = thread?.replyToEvent ?? thread?.rootEvent;
    if (last) {
      await mx.sendReadReceipt(last);
    }
  }

  /** Sends a read receipt for every thread of the conversation. */
  async markAllChatThreadsRead(chatId: string): Promise<void> {
    const { mx, room } = this.requireRoom("markAllChatThreadsRead", chatId);
    for (const thread of room.getThreads()) {
      const last = thread.replyToEvent ?? thread.rootEvent;
      if (last) {
        await mx.sendReadReceipt(last);
      }
    }
  }

  /**
   * Marks the conversation read by sending an unthreaded read receipt for its
   * latest loaded message, clearing the conversation-list unread dot (see
   * `computeRoomUnread`). Unthreaded so a single receipt covers the whole room.
   * A no-op when no message has loaded yet.
   */
  async markChatRead(chatId: string): Promise<void> {
    const { mx, room } = this.requireRoom("markChatRead", chatId);
    // Skip the network round-trip when the conversation is already read.
    if (!computeRoomUnread(room, mx.getUserId() ?? undefined)) {
      return;
    }
    const messages = room.getLiveTimeline().getEvents().filter(isMessageEvent);
    const last = messages[messages.length - 1];
    if (last) {
      await mx.sendReadReceipt(last, undefined, true);
    }
  }

  /**
   * Sends a text message as an `m.room.message` / `m.text` event and resolves
   * with the final `ChatMessage`. The returned id is the REAL server event id,
   * so the composer hook can replace its optimistic bubble with a stable,
   * `/sync`-consistent message (see {@link sendResponseToChatMessage}). The
   * conversation rises in the list for free: `room.getLastActiveTimestamp()`
   * bumps and the hook invalidates the chat lists, which re-read it.
   */
  async sendChatMessage({
    chatId,
    content,
  }: SendChatMessageParams): Promise<ChatMessage> {
    const mx = this.mx;
    if (!mx) {
      throw new Error("MatrixDriver.sendChatMessage: client is not connected.");
    }
    if (!mx.getRoom(chatId)) {
      throw new Error(
        `MatrixDriver.sendChatMessage: room "${chatId}" not found.`,
      );
    }
    const { event_id: eventId } = await mx.sendTextMessage(chatId, content);
    return sendResponseToChatMessage(eventId, content);
  }

  /**
   * Replies in a thread. Sending through the SDK's thread overload attaches the
   * `m.thread` relation (`rel_type: m.thread`, the root as `event_id`, an
   * `m.in_reply_to` pointing at the latest reply, `is_falling_back: true`). The
   * full `ChatThreadMutationResult` is assembled from the live thread plus the
   * real event id, mirroring the mock's `syncThreadMetadata`.
   */
  async sendChatThreadReply({
    chatId,
    threadId,
    content,
  }: SendChatThreadReplyParams): Promise<ChatThreadMutationResult> {
    const { mx, room } = this.requireRoom("sendChatThreadReply", chatId);
    const { event_id: eventId } = await mx.sendEvent(chatId, threadId, EventType.RoomMessage, {
      msgtype: MsgType.Text,
      body: content,
    });
    return this.buildThreadMutationResult(mx, room, threadId, eventId, content);
  }

  /**
   * Starts a thread on a root message by sending its first `m.thread` reply (the
   * thread id in Matrix IS the root event id). The result's `rootMessage` gains a
   * thread summary and the thread row a `lastReplyAt`, as the hooks expect.
   */
  async startChatThread({
    chatId,
    rootMessageId,
    content,
  }: StartChatThreadParams): Promise<ChatThreadMutationResult> {
    const { mx, room } = this.requireRoom("startChatThread", chatId);
    const { event_id: eventId } = await mx.sendEvent(chatId, rootMessageId, EventType.RoomMessage, {
      msgtype: MsgType.Text,
      body: content,
    });
    return this.buildThreadMutationResult(mx, room, rootMessageId, eventId, content);
  }

  /**
   * Assembles the full `ChatThreadMutationResult` after a thread reply / start.
   *
   * The detail is rebuilt from the WHOLE thread (after paginating its history,
   * like `getChatThread`), not just the live-timeline window — otherwise a send
   * that shrinks the live window would drop other participants' replies and the
   * cache would collapse to only the current user's messages. The just-sent
   * reply is appended with its REAL event id, while its still-pending local echo
   * (temporary id) is excluded, so it appears exactly once and matches the
   * timeline once the `/sync` echo lands.
   */
  private async buildThreadMutationResult(
    mx: MatrixClient,
    room: Room,
    rootId: string,
    replyEventId: string,
    content: string,
  ): Promise<ChatThreadMutationResult> {
    const selfUserId = mx.getUserId() ?? undefined;
    const nowIso = new Date().toISOString();
    const message: ChatMessage = {
      id: replyEventId,
      authorId: SELF_AUTHOR_ID,
      content,
      timestamp: nowIso,
      reactions: [],
    };

    const liveThread = room.getThread(rootId);
    if (liveThread) {
      // Ensure the full thread history is in memory so the detail is complete.
      await this.loadAllThreadReplies(mx, liveThread);
    }

    const rootEvent = liveThread?.rootEvent ?? room.findEventById(rootId);
    // Sent replies only (exclude the in-flight local echo, whose id is temporary,
    // and any copy already carrying the real id), oldest first.
    const replyEvents = liveThread
      ? threadReplyEvents(liveThread)
          .filter(
            (event) =>
              event.status === null && event.getId() !== replyEventId,
          )
          .sort((a, b) => a.getTs() - b.getTs())
      : [];
    const replyCount = replyEvents.length + 1;

    const rootBase: ChatMessage = rootEvent
      ? matrixEventToChatMessage(rootEvent, room, selfUserId)
      : {
          id: rootId,
          authorId: "",
          content: "",
          timestamp: nowIso,
          reactions: [],
        };
    const rootMessage: ChatMessage = {
      ...rootBase,
      thread: { id: rootId, replyCount, unreadCount: 0 },
    };

    const replies = replyEvents.map((event) =>
      matrixEventToChatMessage(event, room, selfUserId),
    );
    const authorEvents = rootEvent ? [rootEvent, ...replyEvents] : replyEvents;
    const threadDetail: ChatThreadDetail = {
      id: rootId,
      rootMessageId: rootId,
      messages: [rootMessage, ...replies, message],
      authors: buildAuthors(room, authorEvents, selfUserId),
      firstUnreadIndex: null,
    };

    const thread: ChatThread = {
      id: rootId,
      rootMessageId: rootId,
      author: authorForSender(room, mx.getUserId() ?? "", selfUserId),
      lastReplyAt: nowIso,
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
    const stored = this.readStoredUser();
    if (stored) {
      await this.bootstrapClient(stored);
      return { status: "connected", chatUser: toChatUser(stored) };
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
    this.persistUser(matrixUser);
    this.persistOidc({
      clientId: oidc.clientId,
      issuer: oidc.issuer,
      idToken: oidc.idToken,
      idTokenClaims: oidc.idTokenClaims,
      // The IdP redirected back to this exact URL, so origin + pathname is the
      // redirect URI registered for this client.
      redirectUri: new URL(window.location.origin + window.location.pathname)
        .href,
    });
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
    await startClient(mx);
    this.mx = mx;

    // Bridge Matrix `/sync` onto the generic event stream, once, for the
    // client's lifetime. The handlers fan out to whatever subscribers exist at
    // the time (an empty set is a harmless no-op). Live events become
    // fine-grained `message:new` / `message:updated` / `reaction:updated` /
    // `threads:changed` (see {@link timelineEventToChatEvent}); read-state moves
    // emit `unread:changed` (from new messages and the user's own receipts);
    // other room activity stays coarse (`chat:changed`), and list membership
    // changes emit `chats:changed`.
    this.detachSync();
    const emitUnread = (room: Room) =>
      this.emit({
        type: "unread:changed",
        chatId: room.roomId,
        unread: roomUnread(room, mx.getUserId() ?? undefined),
      });
    const emitThreadChanged = (thread: Thread) => {
      const room = thread.room;
      const selfUserId = mx.getUserId() ?? undefined;
      this.emit({ type: "threads:changed", chatId: room.roomId });
      if (thread.rootEvent) {
        this.emit({
          type: "message:updated",
          chatId: room.roomId,
          message: matrixEventToChatMessage(thread.rootEvent, room, selfUserId),
        });
      }
      emitUnread(room);
    };
    // A read receipt advances thread read state, but the SDK fires no thread
    // event for it (only `RoomEvent.Receipt`). Re-emit the thread bundle so the
    // unread banner (threads cache) and the per-bubble thread buttons (messages
    // cache) recompute from the now-advanced read marker — the very caches a
    // live reply already refreshes. A no-op for thread-less conversations.
    const emitThreadsRefresh = (room: Room) => {
      const threads = room.getThreads();
      if (threads.length === 0) {
        return;
      }
      const selfUserId = mx.getUserId() ?? undefined;
      this.emit({ type: "threads:changed", chatId: room.roomId });
      for (const thread of threads) {
        if (thread.rootEvent) {
          this.emit({
            type: "message:updated",
            chatId: room.roomId,
            message: matrixEventToChatMessage(
              thread.rootEvent,
              room,
              selfUserId,
            ),
          });
        }
      }
    };
    const onTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
    ) => {
      // Backward-pagination history is served by `getChatMessages`, not the
      // live stream.
      if (!room || toStartOfTimeline) {
        return;
      }
      const chatEvents = timelineEventToChatEvent(
        event,
        room,
        mx.getUserId() ?? undefined,
      );
      for (const chatEvent of chatEvents) {
        this.emit(chatEvent);
      }
      // A new live event can change the room's unread state; the bridge consumer
      // de-dupes identical snapshots, so emitting per event is cheap.
      emitUnread(room);
    };
    // Receipts are ephemeral (never in the timeline), so unread changes from
    // reading are surfaced here. Only the connected user's own receipt matters.
    const onReceipt = (event: MatrixEvent, room: Room | undefined) => {
      if (room && receiptMentionsUser(event, mx.getUserId() ?? undefined)) {
        emitUnread(room);
        // The receipt may have cleared a thread's unread replies (e.g. read in
        // another session); without this the banner and thread buttons would
        // stay lit until an unrelated refetch (caches are `staleTime: Infinity`).
        emitThreadsRefresh(room);
      }
    };
    const onRedaction = (
      event: MatrixEvent,
      room: Room | undefined,
      threadRootId?: string,
    ) => {
      if (!room) {
        return;
      }
      const chatEvents = redactionEventToChatEvent(
        event,
        room,
        mx.getUserId() ?? undefined,
        threadRootId,
      );
      for (const chatEvent of chatEvents) {
        this.emit(chatEvent);
      }
      emitUnread(room);
    };
    // Reactions reach `room.relations` through several SDK paths and only the
    // live-timeline one fires `RoomEvent.Timeline`; the others (thread, gappy
    // sync, non-live relations, post-decryption) would never reach the UI and
    // the `staleTime: Infinity` cache would stay stale — the source of the
    // "reaction sometimes doesn't show" bug. `ClientEvent.Event` fires for every
    // synced event after live events have been processed, so it is the broad
    // signal that catches them all; we then re-read the authoritative relations
    // object, like Element's reaction row does.
    const onClientEvent = (event: MatrixEvent) => {
      // Encrypted reactions aggregate only after decryption (and arrive typed
      // `m.room.encrypted` until then); defer and re-enter once decrypted.
      if (event.isBeingDecrypted() || event.shouldAttemptDecryption()) {
        event.once(MatrixEventEvent.Decrypted, () => onClientEvent(event));
        return;
      }
      if (event.getType() !== EventType.Reaction) {
        return;
      }
      // This session's own optimistic toggle already patched the cache.
      if (isOwnEcho(event)) {
        return;
      }
      const room = mx.getRoom(event.getRoomId() ?? "");
      if (!room) {
        return;
      }
      const targetId = event.getRelation()?.event_id;
      if (targetId) {
        this.watchReactionRelations(room, targetId, event.threadRootId);
      }
      for (const chatEvent of reactionEventToChatEvents(
        event,
        room,
        mx.getUserId() ?? undefined,
      )) {
        this.emit(chatEvent);
      }
    };
    const onThreadNew = (thread: Thread, toStartOfTimeline: boolean) => {
      if (!toStartOfTimeline) {
        emitThreadChanged(thread);
      }
    };
    const onThreadUpdate = (thread: Thread) => emitThreadChanged(thread);
    const detachThreadListenersByRoomId = new Map<string, () => void>();
    const attachThreadListeners = (room: Room) => {
      if (detachThreadListenersByRoomId.has(room.roomId)) {
        return;
      }
      room.on(ThreadEvent.New, onThreadNew);
      room.on(ThreadEvent.Update, onThreadUpdate);
      detachThreadListenersByRoomId.set(room.roomId, () => {
        room.off(ThreadEvent.New, onThreadNew);
        room.off(ThreadEvent.Update, onThreadUpdate);
      });
    };
    const detachThreadListeners = () => {
      for (const detach of detachThreadListenersByRoomId.values()) {
        detach();
      }
      detachThreadListenersByRoomId.clear();
    };
    const onRoom = (room: Room) => {
      attachThreadListeners(room);
      this.emit({ type: "chats:changed" });
    };
    // Warm start resolves `waitForInitialSync` at `SyncState.Prepared` straight
    // from the IndexedDB cache, before any network `/sync` — so the first reads
    // can be stale (a just-sent message is suppressed live as the user's own
    // echo, and the query never refetches: `staleTime: Infinity`). When the
    // first authentic network sync lands — and again on every reconnect — force
    // a coarse re-read of the visible rooms so own/missed activity surfaces
    // without a manual refresh. Steady-state polling (`Syncing → Syncing`) and
    // the cache-sourced `Prepared` are skipped, so this fires rarely.
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
      for (const room of mx.getVisibleRooms()) {
        this.emit({ type: "chat:changed", chatId: room.roomId });
        emitUnread(room);
        emitThreadsRefresh(room);
      }
      this.emit({ type: "chats:changed" });
    };
    mx.getRooms().forEach(attachThreadListeners);
    mx.on(RoomEvent.Timeline, onTimeline);
    mx.on(RoomEvent.Receipt, onReceipt);
    mx.on(RoomEvent.Redaction, onRedaction);
    mx.on(ClientEvent.Event, onClientEvent);
    mx.on(ClientEvent.Room, onRoom);
    mx.on(ClientEvent.Sync, onSync);
    const onMyMembership = (
      room: Room,
      membership: string,
      prevMembership?: string,
    ) => {
      // Dev-only convenience: explicit dev accounts swallow invites by
      // auto-joining; the join itself emits `chats:changed` (see
      // {@link joinInvitedRoom}).
      if (
        this.settings.autoJoinInvites &&
        membership === KnownMembership.Invite
      ) {
        void this.joinInvitedRoom(mx, room);
        return;
      }
      // A membership moving into or out of invite/join changes what the chat
      // list shows (a new invite appears, an accepted/refused one changes or
      // disappears), so refresh the list. The single open chat is refreshed too:
      // accepting flips it from invite to a joined conversation, and this
      // membership event fires once the SDK has settled `getMyMembership`, so the
      // re-read lands on the final state (not a stale invite caught mid-join).
      const touchesList = [membership, prevMembership].some(
        (value) =>
          value === KnownMembership.Invite || value === KnownMembership.Join,
      );
      if (touchesList) {
        this.emit({ type: "chat:changed", chatId: room.roomId });
        this.emit({ type: "chats:changed" });
      }
    };
    mx.on(RoomEvent.MyMembership, onMyMembership);
    this.detachSync = () => {
      mx.off(RoomEvent.Timeline, onTimeline);
      mx.off(RoomEvent.Receipt, onReceipt);
      mx.off(RoomEvent.Redaction, onRedaction);
      mx.off(ClientEvent.Event, onClientEvent);
      mx.off(ClientEvent.Room, onRoom);
      mx.off(ClientEvent.Sync, onSync);
      mx.off(RoomEvent.MyMembership, onMyMembership);
      detachThreadListeners();
      this.detachReactionRelationListeners();
    };

    if (this.settings.autoJoinInvites) {
      await this.joinInvitedRooms(mx);
    }
  }

  private async joinInvitedRooms(mx: MatrixClient): Promise<void> {
    await Promise.all(
      mx
        .getRooms()
        .filter((room) => room.getMyMembership() === KnownMembership.Invite)
        .map((room) => this.joinInvitedRoom(mx, room)),
    );
  }

  private async joinInvitedRoom(mx: MatrixClient, room: Room): Promise<void> {
    if (
      room.getMyMembership() !== KnownMembership.Invite ||
      this.joiningInviteRoomIds.has(room.roomId)
    ) {
      return;
    }
    this.joiningInviteRoomIds.add(room.roomId);
    try {
      await mx.joinRoom(room.roomId);
      this.emit({ type: "chats:changed" });
    } catch (error) {
      console.warn("MatrixDriver: auto-join invite failed", room.roomId, error);
    } finally {
      this.joiningInviteRoomIds.delete(room.roomId);
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
    const oidc = this.readStoredOidc();
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
        this.persistUser({
          ...user,
          accessToken,
          refreshToken: refreshToken ?? user.refreshToken,
        });
      },
    });
  }

  private clearCallbackParams(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());
  }

  destroy(): void {
    this.detachSync();
    this.detachSync = () => {};
    this.eventListeners.clear();
    this.mx?.stopClient();
    this.mx = null;
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

  private readStoredUser(): MatrixUserInterface | null {
    const raw = localStorage.getItem(this.key(STORAGE.user));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as MatrixUserInterface;
    } catch {
      localStorage.removeItem(this.key(STORAGE.user));
      return null;
    }
  }

  private persistUser(user: MatrixUserInterface): void {
    localStorage.setItem(this.key(STORAGE.user), JSON.stringify(user));
  }

  private async clearStoredSession(): Promise<void> {
    this.detachSync();
    this.detachSync = () => {};
    this.mx?.stopClient();
    this.mx = null;
    this.joiningInviteRoomIds.clear();

    localStorage.removeItem(this.key(STORAGE.user));
    localStorage.removeItem(this.key(STORAGE.oidc));
    sessionStorage.removeItem(this.key(STORAGE.oidcState));
    sessionStorage.removeItem(this.key(OIDC_HS_KEY));
    await Promise.all([
      this.deleteIndexedDb(this.key(SYNC_STORE_DB_NAME)),
      this.deleteIndexedDb(this.key(CRYPTO_STORE_DB_NAME)),
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

  private readStoredOidc(): StoredOidc | null {
    const raw = localStorage.getItem(this.key(STORAGE.oidc));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as StoredOidc;
    } catch {
      localStorage.removeItem(this.key(STORAGE.oidc));
      return null;
    }
  }

  private persistOidc(oidc: StoredOidc): void {
    localStorage.setItem(this.key(STORAGE.oidc), JSON.stringify(oidc));
  }

  private setStorageOwner(user: User | null | undefined): void {
    const owner = this.resolveLoginHint(user).trim();
    this.storageOwner = owner || null;
  }

  private key(key: string): string {
    return storageKey(
      this.accountId,
      this.storageOwner ? `${key}:${this.storageOwner}` : key,
    );
  }

  private cryptoStoreDbName(user: MatrixUserInterface): string {
    return this.key(
      `${CRYPTO_STORE_DB_NAME}:${user.mxId}:${user.deviceId ?? "no-device"}`,
    );
  }
}
