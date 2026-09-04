import {
  KnownMembership,
  type Room,
  type RoomMember,
} from "matrix-js-sdk/lib/matrix";

import { chatSearchMatchRank } from "@/features/chat/chatSearchMatching";
import type {
  ChatMember,
  LocalChatSearchResult,
} from "@/features/drivers/types";
import {
  explicitRoomName,
  matrixJoinedRoomToLocalChat,
  matrixRoomToLocalChat,
} from "@/features/drivers/implementations/matrixRoomMapping";

/** New joined rooms above this size are indexed by explicit name only. */
export const MEMBER_INDEX_MAX_JOINED_MEMBERS = 50;

/** Existing full records demote only above this higher hysteresis bound. */
export const MEMBER_INDEX_DOWNGRADE_JOINED_MEMBERS = 70;

/** Minimal member data persisted and matched by the local search index. */
export type MatrixConversationSearchMemberRecord = {
  userId: string;
  displayName: string;
};

/** Whether joined member names are indexed or only the room name is kept. */
export type MatrixConversationSearchMemberIndexMode = "full" | "name-only";

/** Complete persisted search projection for one joined or invited room. */
export type MatrixConversationSearchRoomRecord = {
  roomId: string;
  /** Explicit `m.room.name`; SDK-computed direct-message names are excluded. */
  explicitName?: string;
  currentUserMembership: "join" | "invite";
  memberIndexMode: MatrixConversationSearchMemberIndexMode;
  /** Current counterparts split by membership; the current user is omitted. */
  joinedMembers: MatrixConversationSearchMemberRecord[];
  invitedMembers: MatrixConversationSearchMemberRecord[];
};

/** Convert untrusted profile state into a stable searchable member record. */
export const memberRecord = (
  userId: string,
  displayName: unknown,
): MatrixConversationSearchMemberRecord => ({
  userId,
  displayName:
    typeof displayName === "string" && displayName.trim()
      ? displayName.trim()
      : userId,
});

/** Convert a live SDK member into the stable persisted member shape. */
export const roomMemberRecord = (
  member: RoomMember,
): MatrixConversationSearchMemberRecord =>
  memberRecord(member.userId, member.name);

/** Stable ordering makes semantic comparisons independent of SDK order. */
export const sortMemberRecords = (
  members: Iterable<MatrixConversationSearchMemberRecord>,
): MatrixConversationSearchMemberRecord[] =>
  [...members].sort((left, right) => left.userId.localeCompare(right.userId));

/** Compare two already-sorted member lists by searchable fields. */
const sameMembers = (
  left: MatrixConversationSearchMemberRecord[],
  right: MatrixConversationSearchMemberRecord[],
): boolean =>
  left.length === right.length &&
  left.every((member, index) => {
    const other = right[index];
    return (
      other?.userId === member.userId &&
      other.displayName === member.displayName
    );
  });

/** Compare only the fields that affect search results. */
export const sameRoomRecord = (
  left: MatrixConversationSearchRoomRecord,
  right: MatrixConversationSearchRoomRecord,
): boolean =>
  left.explicitName === right.explicitName &&
  left.currentUserMembership === right.currentUserMembership &&
  left.memberIndexMode === right.memberIndexMode &&
  sameMembers(left.joinedMembers, right.joinedMembers) &&
  sameMembers(left.invitedMembers, right.invitedMembers);

/** Whether a joined room's membership is small enough to index. */
export const shouldIndexMembers = (room: Room): boolean =>
  room.getJoinedMemberCount() <= MEMBER_INDEX_MAX_JOINED_MEMBERS;

/**
 * Enforce the invariant between indexing mode and stored member payloads.
 * Joined members are removed in `name-only` mode; invite records stay `full`.
 */
export const normalizeMemberIndexMode = (
  record: MatrixConversationSearchRoomRecord,
): MatrixConversationSearchRoomRecord => {
  const nameOnly =
    record.currentUserMembership === "join" &&
    (record.memberIndexMode === "name-only" ||
      // The summary includes the current user; this array does not.
      record.joinedMembers.length >= MEMBER_INDEX_DOWNGRADE_JOINED_MEMBERS);
  if (!nameOnly) {
    return record.memberIndexMode === "full"
      ? record
      : { ...record, memberIndexMode: "full" };
  }
  return record.memberIndexMode === "name-only" &&
    record.joinedMembers.length === 0
    ? record
    : { ...record, memberIndexMode: "name-only", joinedMembers: [] };
};

/** Apply one live membership event to an existing durable projection. */
export const applyMember = (
  record: MatrixConversationSearchRoomRecord,
  member: RoomMember,
): MatrixConversationSearchRoomRecord => {
  const joinedMembers = new Map(
    record.joinedMembers.map((item) => [item.userId, item]),
  );
  const invitedMembers = new Map(
    record.invitedMembers.map((item) => [item.userId, item]),
  );
  if (member.membership === KnownMembership.Join) {
    joinedMembers.set(member.userId, roomMemberRecord(member));
    invitedMembers.delete(member.userId);
  } else if (member.membership === KnownMembership.Invite) {
    invitedMembers.set(member.userId, roomMemberRecord(member));
    joinedMembers.delete(member.userId);
  } else {
    joinedMembers.delete(member.userId);
    invitedMembers.delete(member.userId);
  }
  return normalizeMemberIndexMode({
    ...record,
    joinedMembers: sortMemberRecords(joinedMembers.values()),
    invitedMembers: sortMemberRecords(invitedMembers.values()),
  });
};

/** Refresh only the explicit Matrix room name in an existing projection. */
export const applyRoomName = (
  record: MatrixConversationSearchRoomRecord,
  room: Room,
): MatrixConversationSearchRoomRecord => ({
  ...record,
  explicitName: explicitRoomName(room),
});

/**
 * Merge the SDK's possibly partial room state into a durable record.
 * Persisted members are preserved until the SDK confirms a complete list;
 * known live join/invite/leave events still update individual entries.
 * An invite accepted into a join stays stale so Hydrator rebuilds it with the
 * fresh-room size threshold instead of trusting sparse invite state.
 */
export const mergeCurrentSdkState = (
  record: MatrixConversationSearchRoomRecord,
  room: Room,
  currentUserId: string | null,
): MatrixConversationSearchRoomRecord => {
  const currentUserMembership =
    room.getMyMembership() === KnownMembership.Invite ? "invite" : "join";
  // Accepting an invitation must use fresh-join threshold rules in Hydrator.
  if (
    record.currentUserMembership === "invite" &&
    currentUserMembership === "join"
  ) {
    return record;
  }

  const joinedMembers = new Map(
    record.joinedMembers.map((member) => [member.userId, member]),
  );
  const invitedMembers = new Map(
    record.invitedMembers.map((member) => [member.userId, member]),
  );
  if (room.membersLoaded() || currentUserMembership === "invite") {
    joinedMembers.clear();
    invitedMembers.clear();
  }
  room.getMembers().forEach((member) => {
    if (member.userId === currentUserId) {
      return;
    }
    if (member.membership === KnownMembership.Join) {
      joinedMembers.set(member.userId, roomMemberRecord(member));
      invitedMembers.delete(member.userId);
    } else if (member.membership === KnownMembership.Invite) {
      invitedMembers.set(member.userId, roomMemberRecord(member));
      joinedMembers.delete(member.userId);
    } else {
      joinedMembers.delete(member.userId);
      invitedMembers.delete(member.userId);
    }
  });

  const demotedBySummary =
    currentUserMembership === "join" &&
    room.getJoinedMemberCount() > MEMBER_INDEX_DOWNGRADE_JOINED_MEMBERS;
  return normalizeMemberIndexMode({
    ...record,
    explicitName: explicitRoomName(room),
    currentUserMembership,
    memberIndexMode: demotedBySummary ? "name-only" : record.memberIndexMode,
    joinedMembers: sortMemberRecords(joinedMembers.values()),
    invitedMembers: sortMemberRecords(invitedMembers.values()),
  });
};

/**
 * Match a normalized query against one projection and rank the result.
 * Matrix room mapping is deferred until a searchable field actually matches.
 */
export const matchRoomRecord = (
  record: MatrixConversationSearchRoomRecord,
  room: Room,
  currentUserId: string,
  normalizedQuery: string,
): LocalChatSearchResult | null => {
  const explicitNameRank = record.explicitName
    ? chatSearchMatchRank(record.explicitName, normalizedQuery)
    : null;
  const joinedMemberRanks = record.joinedMembers
    .map((member) => chatSearchMatchRank(member.displayName, normalizedQuery))
    .filter((rank): rank is number => rank !== null);
  const invitedRanks = record.invitedMembers
    .map((member) => chatSearchMatchRank(member.displayName, normalizedQuery))
    .filter((rank): rank is number => rank !== null);
  if (
    explicitNameRank === null &&
    joinedMemberRanks.length === 0 &&
    invitedRanks.length === 0
  ) {
    return null;
  }

  const isIncomingInvitation = record.currentUserMembership === "invite";
  const chat = isIncomingInvitation
    ? matrixRoomToLocalChat(room, currentUserId)
    : matrixJoinedRoomToLocalChat(room, currentUserId);
  const joinedRanks = [
    ...(explicitNameRank !== null &&
    (chat.kind === "group" || record.memberIndexMode === "name-only")
      ? [explicitNameRank]
      : []),
    ...joinedMemberRanks,
  ];
  const searchSection =
    !isIncomingInvitation && joinedRanks.length > 0
      ? "joined"
      : invitedRanks.length > 0 ||
          (isIncomingInvitation && joinedRanks.length > 0)
        ? "invitation"
        : null;
  if (!searchSection) {
    return null;
  }

  const matchedRanks =
    searchSection === "joined"
      ? joinedRanks
      : [...joinedRanks, ...invitedRanks];
  const resultMembers =
    searchSection === "joined"
      ? record.joinedMembers
      : [...record.joinedMembers, ...record.invitedMembers];
  const members: ChatMember[] = resultMembers.map((member) => ({
    id: member.userId,
    name: member.displayName,
    secondaryText: member.userId,
  }));
  return {
    chat,
    members,
    matchRank: Math.min(...matchedRanks),
    searchSection,
    ...(searchSection === "invitation"
      ? { invitationDirection: isIncomingInvitation ? "incoming" : "outgoing" }
      : {}),
  };
};
