import type { User as MatrixUser } from "matrix-js-sdk/lib/matrix";

import type { ChatUserPresence, ChatUserPresenceState } from "../types";

const MATRIX_PRESENCE_STATES = new Set<ChatUserPresenceState>([
  "online",
  "unavailable",
  "offline",
]);

/** Maps only standard Matrix presence values; product labels live elsewhere. */
export const matrixUserToChatUserPresence = (
  user: Pick<MatrixUser, "userId" | "events"> | null,
): ChatUserPresence | null => {
  const state = user?.events.presence?.getContent().presence;
  if (!user || !MATRIX_PRESENCE_STATES.has(state as ChatUserPresenceState)) {
    return null;
  }

  return {
    userId: user.userId,
    state: state as ChatUserPresenceState,
  };
};
