import { RoomLike, RoomListEntriesUpdate, RoomListEntriesUpdate_Tags, RoomMember } from "@/index.web";

export const updatedRooms = (updates: RoomListEntriesUpdate[]): RoomLike[] => {
  const allRooms: RoomLike[] = [];
  for (const update of updates) {
    switch (update.tag) {
      case RoomListEntriesUpdate_Tags.Insert:
      case RoomListEntriesUpdate_Tags.PushFront:
      case RoomListEntriesUpdate_Tags.PushBack:
      case RoomListEntriesUpdate_Tags.Set:
        allRooms.push(update.inner.value);
        break;
      case RoomListEntriesUpdate_Tags.Reset:
        allRooms.push(...update.inner.values);
        break;
    }
  }

  return allRooms;
}

export const loadMembers = async (room: RoomLike): Promise<RoomMember[]> => {
  const members = await room.members();
  const allMembers: RoomMember[] = [];

  if (members.len()) {
    let chunk = members.nextChunk(100);
    while (chunk) {
      allMembers.push(...chunk);
      chunk = members.nextChunk(100);
    }
  }

  return allMembers;
}
