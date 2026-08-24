import { Driver } from "../drivers/Driver";
import { LazyMatrixDriver } from "../drivers/implementations/LazyMatrixDriver";
import type { AccountId, ChatAccountConfig } from "../drivers/types";
import { MATRIX_LOCAL_SETTINGS } from "../matrix/config";

export const MATRIX_LOCAL_ACCOUNT_ID = "matrix-local";

export const MATRIX_LOCAL_ACCOUNT: ChatAccountConfig = {
  accountId: MATRIX_LOCAL_ACCOUNT_ID,
  label: "Matrix local",
  criticality: "required",
  enabled: true,
  settings: MATRIX_LOCAL_SETTINGS,
};

/**
 * Runtime manifest. It intentionally remains an array: the registry, routes,
 * and caches stay ready for several explicitly configured Matrix accounts.
 */
export const MATRIX_LOCAL_ACCOUNTS: ChatAccountConfig[] = [
  MATRIX_LOCAL_ACCOUNT,
];

export const createDriver = (
  accountId: AccountId,
  settings: Record<string, unknown>,
): Driver => new LazyMatrixDriver(accountId, settings);
