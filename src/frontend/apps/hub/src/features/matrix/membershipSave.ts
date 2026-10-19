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
 * Each save rewrites the whole sync cache (about 10 MB on Tchap) before the
 * next /sync, while member events are frequent: lazy-loaded members of new
 * senders, display name and avatar changes in every shared room.
 */
const MIN_MEMBERSHIP_SAVE_INTERVAL_MS = 30_000;

/**
 * The SDK saves its sync store every five minutes and a reload resumes /sync
 * from the last save. Tchap's Synapse does not resend member events it already
 * sent to this device (element-hq/synapse#19978, #20278), so a member event
 * received after the last save can be lost for good, leaving a conversation
 * named by a user id. Save soon after one, at most every 30 seconds.
 */
export const saveOnMembershipChange = (store: IndexedDBStore): void => {
  let membershipChanged = false;
  let lastMembershipSave = 0;
  const setSyncData = store.setSyncData.bind(store);
  const wantsSave = store.wantsSave.bind(store);
  const save = store.save.bind(store);
  const membershipSaveDue = () =>
    membershipChanged &&
    Date.now() - lastMembershipSave >= MIN_MEMBERSHIP_SAVE_INTERVAL_MS;

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
  store.wantsSave = () => membershipSaveDue() || wantsSave();
  store.save = async (force = false) => {
    // The SDK's own save() asks wantsSave() again: force it past the delay.
    const due = membershipSaveDue();
    // Any save, including the SDK's periodic one, stores the member events.
    const saving = force || due || wantsSave();
    const pending = membershipChanged;
    if (saving) {
      membershipChanged = false;
      lastMembershipSave = Date.now();
    }
    try {
      await save(force || due);
    } catch (error) {
      if (saving) membershipChanged ||= pending;
      throw error;
    }
  };
};
