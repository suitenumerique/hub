/**
 * When a conversation was last active, which orders the conversation list. A
 * port of Element's and Tchap's `getLastTimestamp`
 * (`stores/room-list-v3/skip-list/sorters/utils/getLastTimestamp.ts`), so the
 * same events move a conversation up. Element asks its own timeline whether it
 * shows an event; the Hub shows fewer of them, so the types Element shows are
 * listed here, from its `EventTileFactory.tsx` and `TextForEvent.tsx`.
 */
import {
  EventType,
  M_BEACON,
  M_BEACON_INFO,
  M_POLL_END,
  M_POLL_START,
  type MatrixEvent,
  MsgType,
  RelationType,
  type Room,
} from "matrix-js-sdk/lib/matrix";

/**
 * Types that never count as unread (`Unread.ts`, `eventTriggersUnreadCount`),
 * with the power levels Tchap adds (`:TCHAP:
 * remove-notification-powerlevel-change`).
 */
const NEVER_UNREAD_TYPES = new Set<string>([
  EventType.RoomMember,
  EventType.RoomThirdPartyInvite,
  EventType.CallAnswer,
  EventType.CallHangup,
  EventType.RoomCanonicalAlias,
  EventType.RoomServerAcl,
  M_BEACON.name,
  M_BEACON.altName,
  EventType.RoomPowerLevels,
]);

/** Timeline events Element shows (`EVENT_TILE_TYPES`). */
const SHOWN_TYPES = new Set<string>([
  EventType.RoomMessage,
  EventType.Sticker,
  M_POLL_START.name,
  M_POLL_START.altName,
  M_POLL_END.name,
  M_POLL_END.altName,
  EventType.CallInvite,
  EventType.RTCNotification,
]);

/** Room state Element shows only with an empty state key. */
const SINGULAR_STATE_TYPES = new Set<string>([
  EventType.RoomEncryption,
  EventType.RoomCanonicalAlias,
  EventType.RoomCreate,
  EventType.RoomName,
  EventType.RoomAvatar,
  EventType.RoomHistoryVisibility,
  EventType.RoomTopic,
  EventType.RoomPowerLevels,
  EventType.RoomPinnedEvents,
  EventType.RoomServerAcl,
  "io.element.widgets.layout",
  EventType.RoomTombstone,
  EventType.RoomJoinRules,
  EventType.RoomGuestAccess,
]);

/**
 * Room state Element shows as a line of the timeline (`STATE_EVENT_TILE_TYPES`
 * whose `TextForEvent` handler always has a text), moderation rules included.
 */
const SHOWN_STATE_TYPES = new Set<string>([
  ...SINGULAR_STATE_TYPES,
  EventType.RoomMember,
  EventType.RoomThirdPartyInvite,
  "im.vector.modular.widgets",
  ...["user", "room", "server"].flatMap((entity) => [
    `m.policy.rule.${entity}`,
    `m.room.rule.${entity}`,
    `org.matrix.mjolnir.rule.${entity}`,
  ]),
]);

/** Element Call: only the start of a call that is not the room's own shows. */
const isShownCallStart = (event: MatrixEvent): boolean => {
  const intent = event.getContent()["m.intent"];
  return (
    Object.keys(event.getPrevContent()).length === 0 &&
    typeof intent === "string" &&
    intent !== "m.room"
  );
};

/**
 * Whether Element's timeline shows this event of someone else
 * (`haveRendererForEvent`, hidden events left out). An event still being
 * decrypted has no type yet: it counts once decrypted.
 */
const isShownByElement = (
  room: Room,
  event: MatrixEvent,
  currentUserId: string | undefined,
): boolean => {
  if (event.isRelation(RelationType.Replace)) {
    return false;
  }
  const type = event.getType();
  if (!event.isState()) {
    if (
      type === EventType.RoomMessage &&
      event.getContent().msgtype === MsgType.KeyVerificationRequest
    ) {
      return event.getContent().to === currentUserId;
    }
    return SHOWN_TYPES.has(type);
  }
  if (M_BEACON_INFO.matches(type)) {
    return Boolean(event.getContent().live);
  }
  if (SINGULAR_STATE_TYPES.has(type) && event.getStateKey() !== "") {
    return false;
  }
  if (type === EventType.RoomCreate) {
    return room.findPredecessor() !== null;
  }
  if (type === EventType.GroupCallPrefix) {
    return isShownCallStart(event);
  }
  return SHOWN_STATE_TYPES.has(type);
};

/** `eventTriggersUnreadCount`: an event of someone else that counts. */
const triggersUnreadCount = (
  room: Room,
  event: MatrixEvent,
  currentUserId: string | undefined,
): boolean =>
  event.getSender() !== currentUserId &&
  !NEVER_UNREAD_TYPES.has(event.getType()) &&
  !event.isRedacted() &&
  isShownByElement(room, event, currentUserId);

/**
 * `shouldCauseReorder`: an event of the current user moves the conversation,
 * unless it only changes their name or avatar.
 */
const shouldCauseReorder = (event: MatrixEvent): boolean => {
  if (event.getType() !== EventType.RoomMember) {
    return true;
  }
  const content = event.getContent();
  const prevContent = event.getPrevContent();
  if (prevContent.membership !== content.membership) {
    return true;
  }
  return (
    prevContent.displayname === content.displayname &&
    prevContent.avatar_url === content.avatar_url
  );
};

/** Whether an event moves its conversation up the list. */
export const isListActivity = (
  room: Room,
  event: MatrixEvent,
  currentUserId: string | undefined,
): boolean =>
  (event.getSender() === currentUserId && shouldCauseReorder(event)) ||
  triggersUnreadCount(room, event, currentUserId);

/**
 * The latest event that moves the conversation, or the latest reply of its
 * threads when more recent. Without any such event loaded, the oldest one is
 * better than none at all.
 */
export const lastActivityTimestamp = (
  room: Room,
  currentUserId: string | undefined,
): number => {
  const events = room.getLiveTimeline().getEvents();
  const mainTimelineTs =
    (
      events.findLast((event) => isListActivity(room, event, currentUserId)) ??
      events[0]
    )?.getTs() ?? 0;
  return room
    .getThreads()
    .reduce(
      (latest, thread) =>
        Math.max(
          latest,
          (thread.replyToEvent ?? thread.rootEvent)?.getTs() ?? 0,
        ),
      mainTimelineTs,
    );
};
