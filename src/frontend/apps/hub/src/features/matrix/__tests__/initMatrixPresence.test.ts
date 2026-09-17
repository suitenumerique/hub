// @vitest-environment jsdom
import { SyncState, type MatrixClient } from "matrix-js-sdk/lib/matrix";
import { describe, expect, it, vi } from "vitest";

import { startClient } from "../initMatrix";

describe("startClient presence bootstrap", () => {
  it("puts a persisted offline mode on the first sync", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const mx = {
      startClient: start,
      getSyncState: () => SyncState.Syncing,
      getSyncStateData: () => ({ fromCache: false, catchingUp: false }),
    } as unknown as MatrixClient;

    await startClient(mx, { disablePresence: true });

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ disablePresence: true }),
    );
  });
});
