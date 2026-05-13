import { MockChat } from '@/features/chat/mockChats';
import { Room } from 'matrix-js-sdk/lib/matrix';

export const matrixRoomToHub = (
  room: Room,
  kind: 'group' | 'direct' = 'group',
): MockChat => {
  return {
    id: room.roomId,
    name: room.name,
    section: 'all',
    kind,
    visual: { kind: 'initials' },
  };
};
