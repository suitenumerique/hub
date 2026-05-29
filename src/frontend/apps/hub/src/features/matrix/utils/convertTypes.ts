import { Chat } from "@/features/drivers/types";
import { Room } from "matrix-js-sdk/lib/matrix";

export const roomToChat = (
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
