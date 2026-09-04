import {
  KnownMembership,
  MatrixError,
  type MatrixClient,
  type Room,
} from "matrix-js-sdk/lib/matrix";
import { safeGetRetryAfterMs } from "matrix-js-sdk/lib/http-api/errors";

import { explicitRoomName } from "@/features/drivers/implementations/matrixRoomMapping";

import {
  MEMBER_INDEX_DOWNGRADE_JOINED_MEMBERS,
  MEMBER_INDEX_MAX_JOINED_MEMBERS,
  memberRecord,
  normalizeMemberIndexMode,
  roomMemberRecord,
  sortMemberRecords,
  type MatrixConversationSearchMemberIndexMode,
  type MatrixConversationSearchMemberRecord,
  type MatrixConversationSearchRoomRecord,
} from "./MatrixConversationSearchProjection";

const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RATE_LIMIT_DELAY_MS = 30_000;

type HydrateRoomOptions = {
  /** Live SDK client used only when a full member snapshot is required. */
  client: MatrixClient;
  /** Room whose current search projection is being rebuilt. */
  room: Room;
  /** Previous projection, used for hysteresis and retained invitations. */
  currentRecord: MatrixConversationSearchRoomRecord | undefined;
  /** False when teardown made another retry or result irrelevant. */
  isCurrent: () => boolean;
};

/**
 * Build one complete, immutable search projection for a room.
 *
 * Member data comes from the cheapest reliable source:
 * 1. large joined rooms become `name-only` and skip `/members`;
 * 2. loaded SDK rooms and incoming invites use their in-memory state;
 * 3. other small joined rooms request the current `/members` snapshot.
 *
 * This function never writes to IndexedDB. Its caller rechecks room revision
 * and membership before persisting the returned record.
 */
export const hydrateRoom = async ({
  client,
  room,
  currentRecord,
  isCurrent,
}: HydrateRoomOptions): Promise<MatrixConversationSearchRoomRecord | null> => {
  const currentUserId = client.getUserId();
  const currentUserMembership =
    room.getMyMembership() === KnownMembership.Invite ? "invite" : "join";
  let joinedMembers: MatrixConversationSearchMemberRecord[];
  let invitedMembers: MatrixConversationSearchMemberRecord[];
  let memberIndexMode: MatrixConversationSearchMemberIndexMode = "full";

  // Existing joined full records receive the higher hysteresis threshold.
  // Records inherited from an invite use the fresh-room threshold.
  const memberCap =
    currentRecord?.memberIndexMode === "full" &&
    currentRecord.currentUserMembership === "join"
      ? MEMBER_INDEX_DOWNGRADE_JOINED_MEMBERS
      : MEMBER_INDEX_MAX_JOINED_MEMBERS;

  // Strategy 1: do not download every member of a large joined room. Keep only
  // its explicit name and any pending invitations already known locally.
  if (
    currentUserMembership === "join" &&
    room.getJoinedMemberCount() > memberCap
  ) {
    // Large rooms skip `/members`, but retain searchable pending invitations.
    const invited = new Map(
      (currentRecord?.invitedMembers ?? []).map((member) => [
        member.userId,
        member,
      ]),
    );
    room.getMembers().forEach((member) => {
      if (member.userId === currentUserId) {
        return;
      }
      if (member.membership === KnownMembership.Invite) {
        invited.set(member.userId, roomMemberRecord(member));
      } else {
        invited.delete(member.userId);
      }
    });
    joinedMembers = [];
    invitedMembers = [...invited.values()];
    memberIndexMode = "name-only";
  } else if (room.membersLoaded() || currentUserMembership === "invite") {
    // Strategy 2: reuse complete SDK members, or the intentionally sparse state
    // available for an incoming invitation, without another network request.
    joinedMembers = room
      .getMembersWithMembership(KnownMembership.Join)
      .filter((member) => member.userId !== currentUserId)
      .map(roomMemberRecord);
    invitedMembers = room
      .getMembersWithMembership(KnownMembership.Invite)
      .filter((member) => member.userId !== currentUserId)
      .map(roomMemberRecord);
  } else {
    // Strategy 3: fetch one authoritative current snapshot for a small joined
    // room whose full members have not already been loaded by the SDK.
    let response: Awaited<ReturnType<MatrixClient["members"]>> | null = null;
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
      try {
        response = await client.members(
          room.roomId,
          undefined,
          KnownMembership.Leave,
        );
        break;
      } catch (error) {
        if (
          !(error instanceof MatrixError) ||
          !error.isRateLimitError() ||
          attempt === MAX_RATE_LIMIT_RETRIES
        ) {
          throw error;
        }
        const delay = Math.min(
          Math.max(safeGetRetryAfterMs(error, 1000 * 2 ** attempt), 0),
          MAX_RATE_LIMIT_DELAY_MS,
        );
        await new Promise((resolve) => window.setTimeout(resolve, delay));
        // The delay cannot be cancelled. If the owning index was stopped while
        // waiting, do not spend another `/members` request on an obsolete room.
        if (!isCurrent()) {
          return null;
        }
      }
    }
    if (!response) {
      return null;
    }

    joinedMembers = [];
    invitedMembers = [];
    response.chunk.forEach((event) => {
      const userId = event.state_key;
      if (!userId || userId === currentUserId) {
        return;
      }
      const content = event.content as {
        displayname?: unknown;
        membership?: unknown;
      };
      if (content.membership === KnownMembership.Join) {
        joinedMembers.push(memberRecord(userId, content.displayname));
      } else if (content.membership === KnownMembership.Invite) {
        invitedMembers.push(memberRecord(userId, content.displayname));
      }
    });
  }

  // Defensive post-fetch cap: the earlier SDK summary may have been missing or
  // stale. The response excludes the current user while the summary includes it.
  if (
    memberIndexMode === "full" &&
    currentUserMembership === "join" &&
    joinedMembers.length >= memberCap
  ) {
    joinedMembers = [];
    memberIndexMode = "name-only";
  }
  return normalizeMemberIndexMode({
    roomId: room.roomId,
    explicitName: explicitRoomName(room),
    currentUserMembership,
    memberIndexMode,
    joinedMembers: sortMemberRecords(joinedMembers),
    invitedMembers: sortMemberRecords(invitedMembers),
  });
};
