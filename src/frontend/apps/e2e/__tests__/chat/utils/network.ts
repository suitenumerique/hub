import { Page } from "@playwright/test";

/** Room history requests (`/rooms/{roomId}/messages`) of the client API. */
export const ROOM_HISTORY_REQUESTS =
  /\/_matrix\/client\/v3\/rooms\/[^/]+\/messages/;

/** Event sends (`/rooms/{roomId}/send/…`) of the client API. */
export const SEND_REQUESTS = /\/_matrix\/client\/v3\/rooms\/[^/]+\/send\//;

/** The `/sync` long-poll of the client API. */
export const SYNC_REQUESTS = /\/_matrix\/client\/v3\/sync\b/;

/** Settles once `markHeld` is called, for "a request is being held" signals. */
const heldSignal = () => {
  let markHeld: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    markHeld = resolve;
  });
  return { held, markHeld };
};

export type DelayedRequests = {
  /** Settles once the first matching request is being held. */
  held: Promise<void>;
  /** Stops delaying the next requests. */
  stop: () => Promise<void>;
};

/**
 * Holds the matching requests of a page for `delayMs` before sending them, to
 * widen a loading window.
 */
export const delayRequests = async (
  page: Page,
  url: RegExp,
  delayMs: number,
): Promise<DelayedRequests> => {
  const { held, markHeld } = heldSignal();
  await page.route(url, async (route) => {
    markHeld();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
  return { held, stop: () => page.unroute(url) };
};

export type HeldRequests = {
  /** Settles once the first matching request is being held. */
  held: Promise<void>;
  /** Sends the held requests, and the next ones normally. */
  release: () => Promise<void>;
};

/**
 * Holds the matching requests of a page until `release`. Holding `/sync` while
 * someone else writes makes the next sync return more events than its limit:
 * a "limited" sync with a gap, as after a frozen tab or a slow homeserver.
 */
export const holdRequests = async (
  page: Page,
  url: RegExp,
): Promise<HeldRequests> => {
  const { held, markHeld } = heldSignal();
  let releaseAll: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    releaseAll = resolve;
  });
  const pending = new Set<Promise<void>>();
  await page.route(url, (route) => {
    markHeld();
    const handled = released.then(() => route.continue());
    pending.add(handled);
    return handled.finally(() => pending.delete(handled));
  });
  return {
    held,
    release: async () => {
      releaseAll();
      // Let the held requests go before removing the route, which would
      // otherwise resume them first.
      await Promise.allSettled(Array.from(pending));
      await page.unroute(url);
    },
  };
};

type SyncBody = { to_device?: { events?: unknown[] } };

export type StashedToDevice = {
  /**
   * Settles once a sync is intercepted. The sync already in flight is not:
   * end it with any event first.
   */
  intercepting: Promise<void>;
  /** Delivers the stashed to-device messages with the next sync response. */
  deliver: () => void;
};

/**
 * Keeps the to-device messages of the page's sync responses, such as room keys,
 * until `deliver`: an encrypted message then arrives before its key, as when
 * the key is delayed between homeservers.
 */
export const stashToDeviceMessages = async (
  page: Page,
): Promise<StashedToDevice> => {
  const { held: intercepting, markHeld } = heldSignal();
  const stashed: unknown[] = [];
  let delivering = false;
  await page.route(SYNC_REQUESTS, async (route) => {
    markHeld();
    const response = await route.fetch();
    const body = (await response.json()) as SyncBody;
    if (!delivering) {
      stashed.push(...(body.to_device?.events ?? []));
      await route.fulfill({
        response,
        json: { ...body, to_device: { events: [] } },
      });
      return;
    }
    const events = [...stashed.splice(0), ...(body.to_device?.events ?? [])];
    await route.fulfill({ response, json: { ...body, to_device: { events } } });
    await page.unroute(SYNC_REQUESTS);
  });
  return {
    intercepting,
    deliver: () => {
      delivering = true;
    },
  };
};
