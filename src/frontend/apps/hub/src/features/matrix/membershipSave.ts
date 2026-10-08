import { EventType, type IndexedDBStore } from "matrix-js-sdk/lib/matrix";

type SyncData = Parameters<IndexedDBStore["setSyncData"]>[0];
type RawSection = { events?: { type?: unknown }[] } | undefined;
type RawRoom = Record<string, RawSection>;

/** Room sections that can carry `m.room.member` events in a /sync response. */
const MEMBERSHIP_SECTIONS = [
  "state",
  "org.matrix.msc4222.state_after",
  "timeline",
  "invite_state",
];

const carriesMembership = (rooms: object | undefined): boolean =>
  Object.values((rooms ?? {}) as Record<string, RawRoom>).some((room) =>
    MEMBERSHIP_SECTIONS.some((section) =>
      room[section]?.events?.some(
        (event) => event.type === EventType.RoomMember,
      ),
    ),
  );

/**
 * The SDK saves its sync store every five minutes and a reload resumes /sync
 * from the last save. Tchap's Synapse does not resend member events it already
 * sent to this device (element-hq/synapse#19978, #20278), so a membership
 * received after the last save can be lost for good, leaving a conversation
 * named by a user id. Membership changes are rare: save right after them.
 */
export const saveOnMembershipChange = (store: IndexedDBStore): void => {
  let membershipChanged = false;
  const setSyncData = store.setSyncData.bind(store);
  const wantsSave = store.wantsSave.bind(store);
  const save = store.save.bind(store);

  store.setSyncData = async (data: SyncData) => {
    await setSyncData(data);
    const rooms = data.rooms;
    if (
      carriesMembership(rooms?.join) ||
      carriesMembership(rooms?.invite) ||
      carriesMembership(rooms?.leave)
    )
      membershipChanged = true;
  };
  store.wantsSave = () => membershipChanged || wantsSave();
  store.save = async (force = false) => {
    // The SDK's own save() asks wantsSave() again: force it past the delay.
    const pending = membershipChanged;
    membershipChanged = false;
    try {
      await save(force || pending);
    } catch (error) {
      membershipChanged ||= pending;
      throw error;
    }
  };
};
