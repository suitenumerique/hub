import { Chat, ChatMessage } from '@/features/drivers/types';
import { Room, MatrixEvent as Event } from 'matrix-js-sdk/lib/matrix';

export const matrixRoomToHub = (
  room: Room,
  kind: 'group' | 'direct' = 'group',
): Chat => {
  return {
    id: room.roomId,
    name: room.name,
    section: 'all',
    kind,
    visual: { kind: 'initials' },
  };
};

export const matrixEventToMessage = (event: Event): ChatMessage => {
  let content = event.getOriginalContent();
  if (event.isDecryptionFailure()) {
    content = { body: '🔐 Failed to decrypt', url: undefined };
  }

  return {
    id: event.getId() || '',
    authorId: event.getSender() || '',
    content: content.body,
    timestamp: event.getDate()?.toISOString() || '',
  };
};
