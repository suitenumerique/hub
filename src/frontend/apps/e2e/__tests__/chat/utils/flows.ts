import { expect } from "@playwright/test";

import type { CryptoDevice } from "./crypto-device";
import type { Person } from "./fixtures";
import { signInToHubBackend } from "./hub-session";
import { holdRequests, SYNC_REQUESTS } from "./network";
import type { ChatPage } from "./pages/chat-page";

/**
 * Room without end-to-end encryption (no `m.room.encryption` state), created
 * through the API with every member joined. The Hub encrypts every room it
 * creates and blocks sending there until its device is verified: starting from
 * an unencrypted room lets a test send right away. Two people make a direct
 * conversation, named after the other person in the Hub.
 */
export const createUnencryptedRoom = async (
  owner: Person,
  members: Person[],
  { name }: { name?: string } = {},
): Promise<string> => {
  const roomId = await owner.api.createRoom({
    name,
    invite: members.map((member) => member.userId),
    isDirect: members.length === 1,
  });
  for (const member of members) await member.api.join(roomId);
  return roomId;
};

/** Someone who can join a room: an API device or a headless device. */
type Joiner = { userId: string; join: (roomId: string) => Promise<void> };

/** Encrypted room created by a headless device, with every member joined. */
export const createEncryptedRoom = async (
  owner: CryptoDevice,
  members: Joiner[],
  { name }: { name?: string } = {},
): Promise<string> => {
  const roomId = await owner.createEncryptedRoom({
    name,
    invite: members.map((member) => member.userId),
    isDirect: members.length === 1,
  });
  for (const member of members) {
    await member.join(roomId);
    await owner.waitForMember(roomId, member.userId);
  }
  return roomId;
};

/**
 * Verifies the Hub device with the person's other device, comparing the same
 * 7 emojis on both sides, until the Hub can send encrypted messages.
 */
export const verifyHubDevice = async (
  chat: ChatPage,
  otherDevice: CryptoDevice,
): Promise<void> => {
  await chat.accountMenu.choose("Encryption");
  await chat.encryption.startVerification();
  const sas = await otherDevice.acceptVerification();
  expect(await chat.encryption.shownEmojis()).toEqual(sas.emojis);
  await chat.encryption.theyMatch();
  await sas.confirm();
  await chat.encryption.expectDeviceStatus("Verified");
  await chat.encryption.expectBackupStatus("Active");
  await chat.encryption.close();
};

/** Signs the same person in to the Hub again, in the same browser. */
export const signInAgain = async (chat: ChatPage): Promise<void> => {
  await signInToHubBackend(chat.page.context(), chat.person);
  await chat.goto();
};

/** The Device ID shown under "Technical details" of the Encryption dialog. */
export const shownDeviceId = async (chat: ChatPage): Promise<string> => {
  await chat.accountMenu.choose("Encryption");
  const deviceId = await chat.encryption.deviceId();
  await chat.encryption.close();
  return deviceId;
};

/**
 * Marks everything read from the person's other device, as when they already
 * read the conversation elsewhere: it gives the Hub a read marker to start
 * from.
 */
export const markRoomRead = async (
  person: Person,
  roomId: string,
): Promise<void> => {
  const [latest] = await person.api.messages(roomId, 1);
  await person.api.markRead(roomId, latest.event_id);
};

/**
 * Makes the Hub's next sync skip events, as after a frozen tab or a slow
 * homeserver: its sync is held while `write` adds more events than one sync
 * returns, then released. `wake` must produce an event, to end the sync
 * already in flight so that the next one is held. Resolves once the Hub got
 * the "limited" sync of `roomId`.
 */
export const withSyncGap = async (
  chat: ChatPage,
  roomId: string,
  {
    wake,
    write,
  }: { wake: () => Promise<unknown>; write: () => Promise<unknown> },
): Promise<void> => {
  const sync = await holdRequests(chat.page, SYNC_REQUESTS);
  await wake();
  await sync.held;
  await write();
  const limited = chat.page.waitForResponse(async (response) => {
    if (!SYNC_REQUESTS.test(response.url())) return false;
    const body = (await response.json().catch(() => null)) as {
      rooms?: { join?: Record<string, { timeline?: { limited?: boolean } }> };
    } | null;
    return body?.rooms?.join?.[roomId]?.timeline?.limited === true;
  });
  await sync.release();
  await limited;
};
