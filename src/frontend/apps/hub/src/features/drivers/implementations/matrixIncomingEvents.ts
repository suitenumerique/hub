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
  const joined = new Set(
    mx
      .getRooms()
      .filter((room) => room.getMyMembership() === KnownMembership.Join)
      .map((room) => room.roomId),
  );
  const seen = new Set<string>();
  const pendingJoined = new Set<string>();
  const pendingInvitations = new Map<string, symbol>();
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
      !roomId ||
      !joined.has(roomId) ||
      event.isState() ||
      event.isRedacted() ||
      event.getSender() === self ||
      isOwnEcho(event)
    )
      return;
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
    if (Date.now() - pending.at < 60_000) publishMessage(event);
  };
  const onMembership = (room: Room, membership: string, previous?: string) => {
    if (membership === previous) return;
    // A later membership change cancels the invitation queued for this room.
    pendingInvitations.delete(room.roomId);
    joined.delete(room.roomId);
    if (membership === KnownMembership.Join) pendingJoined.add(room.roomId);
    else pendingJoined.delete(room.roomId);
    if (membership !== KnownMembership.Invite) return;
    const invitation = Symbol();
    pendingInvitations.set(room.roomId, invitation);
    // MyMembership fires during recalculate(), before the final room name.
    queueMicrotask(() => {
      if (!active || pendingInvitations.get(room.roomId) !== invitation) return;
      pendingInvitations.delete(room.roomId);
      if (room.getMyMembership() !== KnownMembership.Invite) return;
      const chat = matrixRoomToLocalChat(room, self ?? undefined);
      emit({
        type: "invitation:received",
        chatId: room.roomId,
        chatName: chat.name,
        inviterName: chat.invitation?.inviterName || chat.invitation?.inviterId,
      });
    });
  };
  const onSync = (
    state: SyncState,
    _previous: SyncState | null,
    data?: SyncStateData,
  ) => {
    if (state !== SyncState.Syncing || data?.fromCache) return;
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
  };
};
