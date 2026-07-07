import { Driver } from "../drivers/Driver";
import { LazyMatrixDriver } from "../drivers/implementations/LazyMatrixDriver";
import { MockDriver } from "../drivers/implementations/MockDriver";
import type { AccountId, DriverKind } from "../drivers/types";

/**
 * Selects the default chat driver. Precedence: a `?driver=` query param (handy
 * for QA/demos) → the `NEXT_PUBLIC_CHAT_DRIVER` build env → mock by default.
 * Account manifests can override this per account.
 */
export const resolveDriverKind = (): DriverKind => {
  if (typeof window !== "undefined") {
    const param = new URLSearchParams(window.location.search).get("driver");
    if (param === "matrix" || param === "mock") {
      return param;
    }
  }
  return process.env.NEXT_PUBLIC_CHAT_DRIVER === "matrix" ? "matrix" : "mock";
};

export const createDriver = (
  kind: DriverKind,
  accountId: AccountId,
  settings: Record<string, unknown> = {},
): Driver => {
  if (kind === "matrix") {
    return new LazyMatrixDriver(accountId, settings);
  }
  return new MockDriver(accountId, settings);
};
