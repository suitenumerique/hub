import { afterEach, describe, expect, it, vi } from "vitest";

import type { Driver } from "../Driver";
import { DriverRegistry } from "../DriverRegistry";

const destroy = vi.fn();
const initialize = vi.fn();

vi.mock("@/features/config/Config", () => ({
  createDriver: (kind: string, accountId: string) =>
    ({
      accountId,
      kind,
      destroy,
      initialize,
    }) as unknown as Driver,
  resolveDriverKind: () => "mock",
}));

describe("DriverRegistry", () => {
  afterEach(() => {
    destroy.mockClear();
    initialize.mockClear();
  });

  it("rejects duplicate account ids", () => {
    const registry = new DriverRegistry();

    expect(() =>
      registry.reconcile([
        {
          accountId: "same",
          kind: "mock",
          label: "A",
          criticality: "required",
          enabled: true,
        },
        {
          accountId: "same",
          kind: "mock",
          label: "B",
          criticality: "optional",
          enabled: true,
        },
      ]),
    ).toThrow("Duplicate chat account id: same");
  });

  it("creates one driver per enabled account and keeps snapshot order", () => {
    const registry = new DriverRegistry();

    registry.reconcile([
      {
        accountId: "account-a",
        kind: "mock",
        label: "A",
        criticality: "required",
        enabled: true,
      },
      {
        accountId: "account-b",
        kind: "mock",
        label: "B",
        criticality: "optional",
        enabled: true,
      },
    ]);

    expect(registry.getSnapshot().map((entry) => entry.accountId)).toEqual([
      "account-a",
      "account-b",
    ]);
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it("destroys removed drivers", () => {
    const registry = new DriverRegistry();

    registry.reconcile([
      {
        accountId: "account-a",
        kind: "mock",
        label: "A",
        criticality: "required",
        enabled: true,
      },
    ]);
    registry.reconcile([
      {
        accountId: "account-a",
        kind: "mock",
        label: "A",
        criticality: "required",
        enabled: false,
      },
    ]);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(registry.getSnapshot()).toEqual([]);
  });
});
