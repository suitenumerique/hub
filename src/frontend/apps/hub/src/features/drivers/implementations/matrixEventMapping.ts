/**
 * Translates Matrix timeline events into the driver-neutral chat shapes: message
 * bubbles, thread summaries and details, aggregated reactions, unread state, and
 * the fine-grained `ChatEvent`s the `/sync` bridge broadcasts.
 *
 * Deliberately ONE module. Messages, threads and reactions form a single cycle —
 * a message carries its thread summary and its reactions, a thread detail is a
 * list of messages — and the monotonic thread-reply counters below are keyed on
 * a module-private `WeakMap`. Splitting on those seams would cycle.
 *
 * Everything here is pure: no `MatrixClient` state, no driver instance. Only
 * `fetchReactionSnapshot` and `reconcileMessageReactions` touch the network, and
 * they take the client as an argument.
 */
import {
  Direction,
  EventType,
  type MatrixClient,
  type MatrixEvent,
  NotificationCountType,
  RelationType,
  type Room,
  type Thread,
} from "matrix-js-sdk/lib/matrix";

import { emojiToCodepoints } from "@/features/chat/fluentEmoji";
import { hashAvatarColor } from "@/features/ui/components/avatar/palette";

import { ChatEvent } from "../Driver";
import {
  ChatMessage,
  ChatMessageAuthor,
  ChatReaction,
  ChatThread,
  ChatThreadDetail,
  ChatUnread,
} from "../types";
import { initialsFor } from "./matrixIdentity";

type ReactionRelations = NonNullable<
  ReturnType<Room["relations"]["getChildEventsForEvent"]>
>;

/**
 * The chat UI marks a message as "sent by me" when its `authorId` is the
 * literal `"me"` (see `ChatVirtualList`). Matrix has no notion of the Hub user,
 * and the two identities are not linked yet, so the driver simply folds the
 * connected Matrix user onto that sentinel: whoever is logged into Matrix *is*
 * "me" for display purposes. Everyone else keeps their raw `mxId`.
 */
export const SELF_AUTHOR_ID = "me";

const toAuthorId = (
  sender: string | undefined,
  selfUserId: string | undefined,
): string =>
  sender && sender === selfUserId ? SELF_AUTHOR_ID : (sender ?? "");

/** Timeline entries the chat UI renders as message bubbles. */
export const isMessageEvent = (event: MatrixEvent): boolean =>
  event.getType() === EventType.RoomMessage &&
  event.getRelation()?.rel_type !== RelationType.Replace;

/** A user-visible message on the room's main timeline (not a reply or edit). */
export const isMainTimelineMessage = (event: MatrixEvent): boolean =>
  isMessageEvent(event) &&
  (!event.threadRootId || event.isThreadRoot) &&
  event.getRelation()?.rel_type !== RelationType.Replace;

/**
 * Receipt-backed unread state for the main timeline. Notification counts cover
 * messages outside the limited sync window; loaded events make muted/default
 * push-rule cases deterministic.
 */
export const computeRoomUnread = (
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
      if (event.isRedacted()) {
        return false;
      }
      const eventId = event.getId();
      return (
        Boolean(eventId) &&
        event.getSender() !== selfUserId &&
        !room.hasUserReadEvent(selfUserId, eventId!)
      );
    });
};

/** Whether an ephemeral receipt event advances this connected user's marker. */
export const receiptMentionsUser = (
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

export const threadReplyEventKey = (event: MatrixEvent): string | undefined => {
  const transactionId = event.getTxnId() ?? event.getUnsigned()?.transaction_id;
  if (transactionId) {
    return `txn:${transactionId}`;
  }
  const eventId = event.getId();
  return eventId ? `event:${eventId}` : undefined;
};

const threadReplySnapshot = (thread: Thread): number =>
  Math.max(thread.length, threadReplyEvents(thread).length);

export const getThreadReplyCounter = (thread: Thread): ThreadReplyCounter => {
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
export const threadReplyCount = (thread: Thread): number =>
  getThreadReplyCounter(thread).count;

/** Records one newly-delivered direct reply and returns false for duplicates. */
export const observeThreadReply = (
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

/**
 * Drops one confirmed reply before the SDK strips its `m.thread` relation.
 * The custom counter is normally monotonic to survive stale root aggregates,
 * so redaction is the one explicit operation allowed to decrement it.
 */
export const forgetThreadReply = (
  thread: Thread,
  event: MatrixEvent,
): boolean => {
  if (!isDirectThreadReply(event, thread.id)) {
    return false;
  }
  const eventKey = threadReplyEventKey(event);
  const counter = getThreadReplyCounter(thread);
  if (!eventKey || !counter.observedEventKeys.delete(eventKey)) {
    return false;
  }
  counter.count = Math.max(0, counter.count - 1);
  return true;
};

export const rememberThreadReplyCount = (
  thread: Thread,
  count: number,
): void => {
  const counter = getThreadReplyCounter(thread);
  counter.count = Math.max(counter.count, count);
};

export const sortedThreadReplyEvents = (thread: Thread): MatrixEvent[] =>
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

export const roomUnread = (
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

export const authorForSender = (
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

export type ReactionSnapshot = {
  events: MatrixEvent[];
  reactions: ChatReaction[];
};

/**
 * Reads the homeserver's active annotations instead of trusting the SDK's
 * relation container, which can temporarily retain a sent-then-redacted local
 * echo across IndexedDB reloads. Pages are followed so counts stay exact.
 */
export const fetchReactionSnapshot = async (
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
export const reconcileMessageReactions = async (
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
export const ownReactionEvents = (
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
export const reactionUpdateEventsForTarget = (
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

export const matrixEventToChatMessage = (
  event: MatrixEvent,
  room: Room,
  selfUserId: string | undefined,
): ChatMessage => {
  const isDeleted = event.isRedacted();
  const content = event.getContent<{ body?: string; msgtype?: string }>();
  const body = content.body;
  const eventId = event.getId() ?? "";
  const canEdit = Boolean(
    !isDeleted &&
    selfUserId &&
    event.getSender() === selfUserId &&
    content.msgtype === "m.text",
  );
  const canDelete = Boolean(
    !isDeleted &&
    selfUserId &&
    room.currentState.maySendRedactionForEvent(event, selfUserId),
  );
  const message: ChatMessage = {
    id: eventId,
    authorId: toAuthorId(event.getSender(), selfUserId),
    content: !isDeleted && typeof body === "string" ? body : "",
    timestamp: new Date(event.getTs()).toISOString(),
    reactions: isDeleted
      ? []
      : aggregateReactions(room, eventId, selfUserId, event.threadRootId),
    isDeleted,
    isEdited: !isDeleted && Boolean(event.replacingEventId()),
    canEdit,
    canDelete,
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

export const threadToChatThread = (
  room: Room,
  thread: Thread,
  selfUserId: string | undefined,
): ChatThread => {
  const lastReply = thread.replyToEvent ?? thread.rootEvent;
  const sender = lastReply?.getSender() ?? "";
  const body = lastReply?.getContent<{ body?: string }>().body;
  const lastReplyDeleted = lastReply?.isRedacted() ?? false;
  return {
    id: thread.id,
    rootMessageId: thread.id,
    author: authorForSender(room, sender, selfUserId),
    lastReplyAt: new Date(lastReply?.getTs() ?? 0).toISOString(),
    lastReplyPreview: !lastReplyDeleted && typeof body === "string" ? body : "",
    lastReplyDeleted,
    replyCount: threadReplyCount(thread),
    unreadCount: computeThreadUnread(room, thread, selfUserId),
  };
};

export const threadToChatThreadDetail = (
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
export const buildAuthors = (
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
export const sendResponseToChatMessage = (
  eventId: string,
  content: string,
): ChatMessage => ({
  id: eventId,
  authorId: SELF_AUTHOR_ID,
  content,
  timestamp: new Date().toISOString(),
  reactions: [],
  isDeleted: false,
  isEdited: false,
  canEdit: true,
  canDelete: true,
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
export const isOwnEcho = (event: MatrixEvent): boolean =>
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

  const relation = event.getRelation();

  // An edit (`m.replace`) updates the original bubble in place. Handle it
  // before the generic message predicate because replacement events are not
  // standalone timeline bubbles.
  if (
    event.getType() === EventType.RoomMessage &&
    relation?.rel_type === RelationType.Replace &&
    relation.event_id
  ) {
    if (isOwnEcho(event)) {
      return [];
    }
    // Keep the ORIGINAL send time. `matrixEventToChatMessage` (history reads)
    // dates an edited message from its original event, so using the edit event's
    // ts here would make the bubble's time jump live, then revert on refetch.
    const original = room.findEventById(relation.event_id);
    const newBody = event.getContent<{
      "m.new_content"?: { body?: string };
    }>()["m.new_content"]?.body;
    // Matrix servers accept relation events from any joined member. The SDK's
    // Relations collection filters replacements to the original sender before
    // applying them; this direct live bridge must enforce the same rule instead
    // of briefly rendering somebody else's forged edit from the raw timeline.
    if (
      !original ||
      !isMessageEvent(original) ||
      original.isRedacted() ||
      original.getSender() !== event.getSender() ||
      typeof newBody !== "string"
    ) {
      return [];
    }
    const originalMessage = matrixEventToChatMessage(
      original,
      room,
      selfUserId,
    );
    const threadId = original.isThreadRoot
      ? original.getId()
      : original.threadRootId;
    return [
      {
        type: "message:updated",
        chatId: room.roomId,
        ...(threadId ? { threadId } : {}),
        message: {
          ...originalMessage,
          id: relation.event_id,
          authorId: toAuthorId(original.getSender(), selfUserId),
          content: newBody,
          timestamp: new Date(original.getTs()).toISOString(),
          reactions: aggregateReactions(room, relation.event_id, selfUserId),
          isDeleted: false,
          isEdited: true,
          canEdit: originalMessage.canEdit,
          canDelete: originalMessage.canDelete,
        },
      },
      ...(threadId
        ? [{ type: "threads:changed" as const, chatId: room.roomId }]
        : []),
    ];
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
