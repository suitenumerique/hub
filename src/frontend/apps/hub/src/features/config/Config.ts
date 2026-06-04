import { Driver } from "../drivers/Driver";
import { MatrixDriver } from "../drivers/implementations/MatrixDriver";
import { MockDriver } from "../drivers/implementations/MockDriver";
import type { AccountId, DriverKind } from "../drivers/types";

/**
 * Selects the default chat driver. Precedence: a `?driver=` query param (handy
 * for QA/demos) → the `NEXT_PUBLIC_CHAT_DRIVER` build env → mock by default.
 * Account manifests can override this per account.
 */
export const resolveDriverKind = (): DriverKind => {
  console.log("resolveDriverKind");
  if (typeof window !== "undefined") {
    const param = new URLSearchParams(window.location.search).get("driver");
    if (param === "matrix" || param === "mock") {
      const driver = param;
      console.log("driver A", driver);
      return driver;
    }
  }
  const driver =
    process.env.NEXT_PUBLIC_CHAT_DRIVER === "matrix" ? "matrix" : "mock";
  console.log("driver B", driver);
  return driver;
};

export const createDriver = (
  kind: DriverKind,
  accountId: AccountId,
  settings: Record<string, unknown> = {},
): Driver => {
  console.log("createDriver", kind);
  if (kind === "matrix") {
    return new MatrixDriver(accountId, settings);
  }
  return new MockDriver(accountId, settings);
};
