import {
  Room as MatrixRoom,
  ClientEvent,
  MatrixClient,
  AccountDataEvents,
} from 'matrix-js-sdk/lib/matrix';
import { Chat } from '@/features/drivers/types';
import { Store } from '@/features/drivers/Store';
import { matrixRoomToHub } from '../utils/types/matrixTypesToHub';

export class ChatListStore extends Store<Chat[]> {
  private mx?: MatrixClient;

  constructor() {
    super([]);
  }

  setMatrixClient(mx: MatrixClient) {
    this.mx = mx;
    this.setupListeners();
    this.updateRoomSnapshot();
  }
  /**
   * Set up listeners for room events
   */
  private setupListeners() {
    if (!this.mx) return;

    // Listen for sync events which will update room information
    this.mx.on(ClientEvent.Sync, () => {
      console.log('**clienteven sync');
      this.updateRoomSnapshot();
    });
  }

  /**
   * Update the internal snapshot from the Matrix client
   */
  private updateRoomSnapshot() {
    console.log('*** [ChatListStore] updateRoomSnapshot');
    if (!this.mx) return;

    // when a new sync is up, we fetch the new visiblerooms of the user
    const matrixRooms = this.mx.getVisibleRooms();
    const dmIds = this.getDMList();
    const newSnapshot = matrixRooms.map((room: MatrixRoom) => {
      const kind = dmIds.has(room.roomId) ? 'direct' : 'group';
      return matrixRoomToHub(room, kind);
    });

    // find DM
    console.log('*** [ChatListStore] new snapshot', newSnapshot);
    // Only update if content actually changed
    const hasChanged =
      this.snapshot.length !== newSnapshot.length ||
      newSnapshot.some(
        (chat, index) =>
          !this.snapshot[index] ||
          chat.id !== this.snapshot[index].id ||
          chat.name !== this.snapshot[index].name,
      );

    console.log('*** [ChatListStore] new snapshot hasChanged', hasChanged);
    if (!hasChanged) return;
    this.updateSnapshot(newSnapshot);
  }

  getDMList() {
    const mDirectEvent = this.mx?.getAccountData(
      'm.direct' as keyof AccountDataEvents,
    );
    console.log('mDirectEvent', mDirectEvent);

    const roomIds = new Set<string>();
    const userIdToDirects = mDirectEvent?.getContent();

    if (userIdToDirects === undefined) return roomIds;

    Object.keys(userIdToDirects).forEach((userId) => {
      const directs = userIdToDirects[userId];
      if (Array.isArray(directs)) {
        directs.forEach((id) => {
          if (typeof id === 'string') roomIds.add(id);
        });
      }
    });

    console.log('[ChatListStore] get DMList roomIds', roomIds);
    return roomIds;
  }
  filterChatsBySection(allChat, dmChat) {}

  /**
   * Cleanup listeners
   */
  override destroy() {
    if (!this.mx) return;
    this.mx.removeAllListeners(ClientEvent.Sync);
    super.destroy();
  }
}
