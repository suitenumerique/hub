import {
  type MatrixClient,
  type MatrixEvent,
  type User,
  UserEvent,
} from "matrix-js-sdk/lib/matrix";
import { describe, expect, it, vi } from "vitest";

import { subscribeToIncomingMatrixEvents } from "../matrixIncomingEvents";

type MatrixListener = (...args: unknown[]) => void;

describe("subscribeToIncomingMatrixEvents presence", () => {
  it("forwards one SDK presence event and detaches the global listener", () => {
    const listeners = new Map<string, MatrixListener>();
    const on = vi.fn((event: string, listener: MatrixListener) => {
      listeners.set(event, listener);
    });
    const off = vi.fn((event: string, listener: MatrixListener) => {
      if (listeners.get(event) === listener) listeners.delete(event);
    });
    const mx = {
      getUserId: () => "@me:localhost",
      getRooms: () => [],
      on,
      off,
    } as unknown as MatrixClient;
    const emit = vi.fn();

    const unsubscribe = subscribeToIncomingMatrixEvents(mx, emit);
    const presenceListener = listeners.get(UserEvent.LastPresenceTs);
    expect(presenceListener).toBeDefined();

    presenceListener?.(
      undefined as unknown as MatrixEvent,
      {
        userId: "@alice:localhost",
        events: {
          presence: {
            getContent: () => ({ presence: "unavailable" }),
          },
        },
      } as User,
    );

    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith({
      type: "user:presence-changed",
      presence: {
        userId: "@alice:localhost",
        state: "unavailable",
      },
    });

    unsubscribe();
    expect(off).toHaveBeenCalledWith(
      UserEvent.LastPresenceTs,
      presenceListener,
    );
    expect(listeners.has(UserEvent.LastPresenceTs)).toBe(false);
  });

  it("deduplicates multiple SDK signals carrying the same presence", () => {
    const listeners = new Map<string, MatrixListener>();
    const mx = {
      getUserId: () => "@me:localhost",
      getRooms: () => [],
      on: (event: string, listener: MatrixListener) =>
        listeners.set(event, listener),
      off: vi.fn(),
    } as unknown as MatrixClient;
    const emit = vi.fn();
    const unsubscribe = subscribeToIncomingMatrixEvents(mx, emit);
    const listener = listeners.get(UserEvent.LastPresenceTs);
    const user = {
      userId: "@alice:localhost",
      events: {
        presence: {
          getContent: () => ({ presence: "offline" }),
        },
      },
    } as User;

    listener?.(undefined, user);
    listener?.(undefined, user);

    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith({
      type: "user:presence-changed",
      presence: { userId: "@alice:localhost", state: "offline" },
    });
    unsubscribe();
  });

  it("forwards every effective online/offline/unavailable transition", () => {
    const listeners = new Map<string, MatrixListener>();
    const mx = {
      getUserId: () => "@me:localhost",
      getRooms: () => [],
      on: (event: string, listener: MatrixListener) =>
        listeners.set(event, listener),
      off: vi.fn(),
    } as unknown as MatrixClient;
    const emit = vi.fn();
    const unsubscribe = subscribeToIncomingMatrixEvents(mx, emit);
    const listener = listeners.get(UserEvent.LastPresenceTs);
    let state = "online";
    const user = {
      userId: "@alice:localhost",
      events: { presence: { getContent: () => ({ presence: state }) } },
    } as User;

    for (state of ["online", "offline", "online", "unavailable", "online"]) {
      listener?.(undefined, user);
    }

    expect(emit.mock.calls.map(([event]) => event.presence.state)).toEqual([
      "online",
      "offline",
      "online",
      "unavailable",
      "online",
    ]);
    unsubscribe();
  });
});
