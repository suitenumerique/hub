import { Driver } from "../drivers/Driver";
import { LazyMatrixDriver } from "../drivers/implementations/LazyMatrixDriver";
import type { AccountId, ChatAccountConfig } from "../drivers/types";
import {
  MATRIX_LOCAL_SETTINGS,
  TCHAP_PREPROD_SETTINGS,
  TCHAP_PROD_SETTINGS,
} from "../matrix/config";

export const MATRIX_LOCAL_ACCOUNT_ID = "matrix-local";

export const MATRIX_LOCAL_ACCOUNT: ChatAccountConfig = {
  accountId: MATRIX_LOCAL_ACCOUNT_ID,
  label: "Matrix local",
  criticality: "required",
  enabled: true,
  settings: MATRIX_LOCAL_SETTINGS,
};

/**
 * Tchap development login hint. Local Keycloak users have no Tchap account, so
 * discovery and sign-in use this email instead of the Hub one.
 */
const tchapSettings = (
  settings: Record<string, unknown>,
): Record<string, unknown> => {
  const loginHint = process.env.NEXT_PUBLIC_MATRIX_LOGIN_HINT?.trim();
  return loginHint ? { ...settings, loginHint } : settings;
};

const MATRIX_ENVIRONMENTS = {
  local: MATRIX_LOCAL_ACCOUNT,
  "tchap-preprod": {
    accountId: "tchap-preprod",
    label: "Tchap (preprod)",
    criticality: "required",
    enabled: true,
    settings: tchapSettings(TCHAP_PREPROD_SETTINGS),
  },
  "tchap-prod": {
    accountId: "tchap-prod",
    label: "Tchap",
    criticality: "required",
    enabled: true,
    settings: tchapSettings(TCHAP_PROD_SETTINGS),
  },
} satisfies Record<string, ChatAccountConfig>;

type MatrixEnvironment = keyof typeof MATRIX_ENVIRONMENTS;

const isMatrixEnvironment = (value: string): value is MatrixEnvironment =>
  Object.hasOwn(MATRIX_ENVIRONMENTS, value);

/**
 * Build-time Matrix environment. Next inlines `NEXT_PUBLIC_*` variables in the
 * static export, so the variable must be read with this literal name.
 */
const readMatrixEnvironment = (): MatrixEnvironment => {
  const value = process.env.NEXT_PUBLIC_MATRIX_ENVIRONMENT?.trim() || "local";
  if (!isMatrixEnvironment(value)) {
    throw new Error(`Unknown Matrix environment "${value}".`);
  }
  return value;
};

/**
 * Runtime manifest. It intentionally remains an array: the registry, routes,
 * and caches stay ready for several explicitly configured Matrix accounts.
 * Each environment has its own account id, so its sessions, caches and crypto
 * stores never mix with another environment's.
 */
export const MATRIX_ACCOUNTS: ChatAccountConfig[] = [
  MATRIX_ENVIRONMENTS[readMatrixEnvironment()],
];

export const createDriver = (
  accountId: AccountId,
  settings: Record<string, unknown>,
): Driver => new LazyMatrixDriver(accountId, settings);
