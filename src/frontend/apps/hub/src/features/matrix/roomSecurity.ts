import {
  ClientEvent,
  EventType,
  type MatrixClient,
  type Room,
} from "matrix-js-sdk/lib/matrix";

export type RoomSecurity = "encrypted" | "plaintext" | "unknown";
// Missing cached state does not prove a room is plaintext. Only a completed
// server check can resolve "unknown"; the UI blocks sending until then.
const prepared = new WeakMap<Room, RoomSecurity>();
const preparations = new WeakMap<Room, Promise<RoomSecurity>>();

export const roomSecurity = (room: Room): RoomSecurity =>
  room.hasEncryptionStateEvent()
    ? "encrypted"
    : (prepared.get(room) ?? "unknown");

/** The server response establishes policy; only SDK sync configures Rust. */
export const prepareRoomSecurity = async (
  mx: MatrixClient,
  room: Room,
  signal: AbortSignal,
  assertCurrent: () => void,
): Promise<RoomSecurity> => {
  let work = preparations.get(room);
  if (!work) {
    work = prepareKnownRoom(mx, room, signal, assertCurrent).finally(() => {
      if (preparations.get(room) === work) preparations.delete(room);
    });
    preparations.set(room, work);
  }
  const result = await work;
  assertCurrent();
  signal.throwIfAborted();
  return result;
};

const prepareKnownRoom = async (
  mx: MatrixClient,
  room: Room,
  signal: AbortSignal,
  assertCurrent: () => void,
): Promise<RoomSecurity> => {
  assertCurrent();
  signal.throwIfAborted();
  let encryption = room.currentState
    .getStateEvents(EventType.RoomEncryption, "")
    ?.getContent();
  // Fetch full state only while unknown. Afterwards /sync updates the Room;
  // re-check Rust on every send so a plaintext room can still become encrypted.
  if (roomSecurity(room) === "unknown") {
    const state = await mx.roomState(room.roomId);
    assertCurrent();
    signal.throwIfAborted();
    encryption = state.find(
      (event) =>
        event.type === EventType.RoomEncryption && event.state_key === "",
    )?.content;
  }
  assertCurrent();
  signal.throwIfAborted();
  // Encryption is sticky for this room instance. An incomplete/stale state
  // response must not downgrade a room already known to require encryption.
  const encrypted =
    !!encryption ||
    room.hasEncryptionStateEvent() ||
    prepared.get(room) === "encrypted" ||
    (await mx.getCrypto()!.isEncryptionEnabledInRoom(room.roomId));
  assertCurrent();
  signal.throwIfAborted();
  if (!encrypted) {
    prepared.set(room, "plaintext");
    return "plaintext";
  }
  prepared.set(room, "encrypted");
  if (encryption && encryption.algorithm !== "m.megolm.v1.aes-sha2")
    throw new Error("Unsupported room encryption.");
  // Reading room state establishes policy but does not configure Rust Crypto.
  // Wait for both the SDK room and crypto engine before allowing a send.
  await new Promise<void>((resolve, reject) => {
    let checking = false;
    const cleanup = () => {
      clearTimeout(timeout);
      mx.off(ClientEvent.Sync, check);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Room preparation stopped."));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Waiting for encrypted room state. Please retry."));
    }, 15_000);
    const check = () => {
      if (checking) return;
      checking = true;
      void mx
        .getCrypto()!
        .isEncryptionEnabledInRoom(room.roomId)
        .then((ready) => {
          assertCurrent();
          signal.throwIfAborted();
          if (ready && room.hasEncryptionStateEvent()) {
            cleanup();
            resolve();
          }
        })
        .catch((error: unknown) => {
          cleanup();
          reject(error);
        })
        .finally(() => {
          checking = false;
        });
    };
    mx.on(ClientEvent.Sync, check);
    signal.addEventListener("abort", abort, { once: true });
    check();
  });
  assertCurrent();
  return "encrypted";
};
