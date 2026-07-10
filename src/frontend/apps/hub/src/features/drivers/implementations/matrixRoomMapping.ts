/**
 * Maps a Matrix `Room` onto the driver-neutral `LocalChat` row the conversation
 * list and header render, branching on the connected user's membership: an
 * invited room becomes an invitation row, every other room a joined
 * conversation. Pure — no client, no driver state.
 */
import {
  EventType,
  KnownMembership,
  type MatrixEvent,
  type Room,
} from "matrix-js-sdk/lib/matrix";

import { ChatInvitation, LocalChat } from "../types";

/**
 * The members that make up a conversation: everyone except the connected user
 * whose membership is `join` or `invite`. Left/banned members are excluded so
 * they neither inflate a group nor linger in its name; invited members are kept
 * so a just-created conversation already shows its counterpart(s) before they
 * accept. Single source for `kind`/`name` in `matrixRoomToLocalChat` and the set
 * `getChatForUsers` matches against, so the two can never disagree.
 */
export const roomOtherMembers = (
  room: Room,
  currentUserId: string | undefined,
) =>
  room
    .getMembers()
    .filter(
      (member) =>
        member.userId !== currentUserId &&
        (member.membership === KnownMembership.Join ||
          member.membership === KnownMembership.Invite),
    );

/** Order- and duplicate-independent key for comparing two participant sets. */
export const participantSetKey = (userIds: string[]): string =>
  [...new Set(userIds)].sort().join(" ");

/** The room's explicit `m.room.name`, when set to a non-empty value. */
const explicitRoomName = (room: Room): string | undefined => {
  const name = room.currentState
    ?.getStateEvents(EventType.RoomName, "")
    ?.getContent<{ name?: string }>()?.name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
};

/** Maps a joined room to a normal conversation row. */
export const matrixJoinedRoomToLocalChat = (
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
export const matrixRoomToLocalChat = (
  room: Room,
  currentUserId: string | undefined,
): LocalChat =>
  room.getMyMembership() === KnownMembership.Invite
    ? matrixInviteRoomToLocalChat(room, currentUserId)
    : matrixJoinedRoomToLocalChat(room, currentUserId);
