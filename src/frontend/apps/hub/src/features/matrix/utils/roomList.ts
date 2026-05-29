import { AccountDataEvents, MatrixClient, Room } from "matrix-js-sdk/lib/matrix";
import { roomToChat } from "./convertTypes";

/**
 * Update the internal snapshot from the Matrix client
 */
export const  getRoomLists = (mx: MatrixClient) =>{
  // when a new sync is up, we fetch the new visiblerooms of the user
  const matrixRooms = mx.getVisibleRooms();
  const dmIds = getDMList(mx);
  const newList = matrixRooms.map((room: Room) => {
    const kind = dmIds.has(room.roomId) ? 'direct' : 'group';
    return roomToChat(room, kind);
  });

  return newList;
}


export const getDMList = (mx: MatrixClient) => {
  const mDirectEvent = mx.getAccountData(
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

  return roomIds;
}
