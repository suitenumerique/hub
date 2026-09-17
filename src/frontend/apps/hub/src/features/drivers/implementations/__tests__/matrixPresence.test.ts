import { MatrixEvent, User } from "matrix-js-sdk/lib/matrix";
import { describe, expect, it } from "vitest";

import { matrixUserToChatUserPresence } from "../matrixPresence";

const matrixUser = (presence?: string): User => {
  const user = new User("@alice:localhost");
  if (presence) {
    user.setPresenceEvent(
      new MatrixEvent({
        type: "m.presence",
        sender: user.userId,
        content: { presence },
      }),
    );
  }
  return user;
};

describe("matrixUserToChatUserPresence", () => {
  it("does not treat a new User's default offline value as known presence", () => {
    expect(matrixUserToChatUserPresence(matrixUser())).toBeNull();
  });

  it.each(["online", "unavailable", "offline"] as const)(
    "preserves the Matrix %s state",
    (state) => {
      expect(matrixUserToChatUserPresence(matrixUser(state))).toEqual({
        userId: "@alice:localhost",
        state,
      });
    },
  );

  it("does not invent a state for an unknown Matrix value", () => {
    expect(matrixUserToChatUserPresence(matrixUser("busy"))).toBeNull();
    expect(matrixUserToChatUserPresence(null)).toBeNull();
  });
});
