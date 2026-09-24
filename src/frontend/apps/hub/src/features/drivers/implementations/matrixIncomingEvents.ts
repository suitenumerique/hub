import {
  ClientEvent,
  EventType,
  KnownMembership,
  type MatrixClient,
  type MatrixEvent,
  MatrixEventEvent,
  RelationType,
  type Room,
  RoomEvent,
  SyncState,
  type SyncStateData,
} from "matrix-js-sdk/lib/matrix";

import type { ChatEventListener } from "../Driver";

import { isOwnEcho } from "./matrixEventMapping";
import { matrixRoomToLocalChat } from "./matrixRoomMapping";

/** Attach only AFTER the initial network sync; cache/history is never delivery. */
export const subscribeToIncomingMatrixEvents = (
  mx: MatrixClient,
  emit: ChatEventListener,
): (() => void) => {
  const self = mx.getUserId();
  let active = true;
  let acceptingLive = true;
  const currentBatch = new Map<string, MatrixEvent>();
  const joined = new Set(
    mx
      .getRooms()
      .filter((room) => room.getMyMembership() === KnownMembership.Join)
      .map((room) => room.roomId),
  );
  const seen = new Set<string>();
  const pendingJoined = new Set<string>();
  const pendingInvitations = new Map<string, Room>();
  const pendingEncrypted = new Map<
    string,
    { event: MatrixEvent; at: number }
  >();

  const publishMessage = (event: MatrixEvent) => {
    const id = event.getId();
    const roomId = event.getRoomId();
    const room = roomId ? mx.getRoom(roomId) : null;
    const sender = event.getSender();
    if (
      !active ||
      !id ||
      !room ||
      !sender ||
      sender === self ||
      seen.has(id) ||
      event.isState() ||
      event.isRedacted() ||
      event.isDecryptionFailure() ||
      isOwnEcho(event) ||
      event.getType() !== EventType.RoomMessage ||
      event.getRelation()?.rel_type === RelationType.Replace ||
      room.getMyMembership() !== KnownMembership.Join
    )
      return;
    seen.add(id);
    if (seen.size > 2048) seen.delete(seen.values().next().value!);
    const content = event.getContent<{ body?: string }>();
    emit({
      type: "message:received",
      chatId: room.roomId,
      chatName: matrixRoomToLocalChat(room, self ?? undefined).name,
      content: typeof content.body === "string" ? content.body : "",
    });
  };

  const onEvent = (event: MatrixEvent) => {
    const id = event.getId();
    const roomId = event.getRoomId();
    if (
      !id ||
      !acceptingLive ||
      !roomId ||
      !joined.has(roomId) ||
      event.isState() ||
      event.isRedacted() ||
      event.getSender() === self ||
      isOwnEcho(event)
    )
      return;
    currentBatch.set(id, event);
    if (currentBatch.size > 512)
      currentBatch.delete(currentBatch.keys().next().value!);
  };
  const queueLiveMessage = (event: MatrixEvent) => {
    const id = event.getId()!;
    if (
      event.isEncrypted() &&
      (event.isBeingDecrypted() ||
        event.isDecryptionFailure() ||
        event.getType() === EventType.RoomMessageEncrypted)
    ) {
      pendingEncrypted.set(id, { event, at: Date.now() });
      if (pendingEncrypted.size > 512)
        pendingEncrypted.delete(pendingEncrypted.keys().next().value!);
      void mx.decryptEventIfNeeded(event).catch(() => {});
      return;
    }
    publishMessage(event);
  };
  const onDecrypted = (event: MatrixEvent, error?: Error) => {
    const id = event.getId();
    const pending = id ? pendingEncrypted.get(id) : undefined;
    if (!id || !pending || error || event.isDecryptionFailure()) return;
    pendingEncrypted.delete(id);
    if (acceptingLive && Date.now() - pending.at < 60_000)
      publishMessage(event);
  };
  const onMembership = (room: Room, membership: string, previous?: string) => {
    if (membership === previous) return;
    // A later membership change cancels the invitation queued for this room.
    pendingInvitations.delete(room.roomId);
    joined.delete(room.roomId);
    if (membership === KnownMembership.Join) pendingJoined.add(room.roomId);
    else pendingJoined.delete(room.roomId);
    if (membership !== KnownMembership.Invite) return;
    if (!acceptingLive) return;
    // Wait for the completed sync batch: the final name and delivery provenance
    // are not known yet when MyMembership fires during recalculate().
    pendingInvitations.set(room.roomId, room);
  };
  const onSync = (
    state: SyncState,
    _previous: SyncState | null,
    data?: SyncStateData,
  ) => {
    if (state !== SyncState.Syncing) {
      acceptingLive = false;
      currentBatch.clear();
      pendingInvitations.clear();
      pendingEncrypted.clear();
      return;
    }
    // Timeline callbacks arrive before the batch's sync metadata. Only notify
    // after that metadata confirms these are live events, not cache/catch-up.
    const live =
      acceptingLive && data?.fromCache !== true && data?.catchingUp !== true;
    if (live) currentBatch.forEach(queueLiveMessage);
    currentBatch.clear();
    if (live) {
      pendingInvitations.forEach((room) => {
        if (room.getMyMembership() !== KnownMembership.Invite) return;
        const chat = matrixRoomToLocalChat(room, self ?? undefined);
        emit({
          type: "invitation:received",
          chatId: room.roomId,
          chatName: chat.name,
          inviterName:
            chat.invitation?.inviterName || chat.invitation?.inviterId,
        });
      });
    }
    pendingInvitations.clear();
    // A successful catch-up resumes delivery only for the *following* batch.
    acceptingLive = data?.fromCache !== true && data?.catchingUp !== true;
    // The first batch of a newly joined room is history, including on acceptance.
    pendingJoined.forEach((roomId) => {
      if (mx.getRoom(roomId)?.getMyMembership() === KnownMembership.Join)
        joined.add(roomId);
    });
    pendingJoined.clear();
    pendingEncrypted.forEach((pending, id) => {
      if (Date.now() - pending.at >= 60_000) pendingEncrypted.delete(id);
    });
  };
  // ClientEvent.Event is emitted by /sync for both room and thread messages.
  // Unlike RoomEvent.Timeline it is NOT emitted by forward/backward pagination.
  mx.on(ClientEvent.Event, onEvent);
  mx.on(MatrixEventEvent.Decrypted, onDecrypted);
  mx.on(RoomEvent.MyMembership, onMembership);
  mx.on(ClientEvent.Sync, onSync);
  return () => {
    active = false;
    mx.off(ClientEvent.Event, onEvent);
    mx.off(MatrixEventEvent.Decrypted, onDecrypted);
    mx.off(RoomEvent.MyMembership, onMembership);
    mx.off(ClientEvent.Sync, onSync);
    pendingInvitations.clear();
    pendingEncrypted.clear();
    currentBatch.clear();
  };
};
