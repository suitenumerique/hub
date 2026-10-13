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
    // Tchap accounts are not provisioned from the Hub's identity provider.
    identity: "account",
    settings: tchapSettings(TCHAP_PREPROD_SETTINGS),
  },
  "tchap-prod": {
    accountId: "tchap-prod",
    label: "Tchap",
    criticality: "required",
    enabled: true,
    // Tchap accounts are not provisioned from the Hub's identity provider.
    identity: "account",
    settings: tchapSettings(TCHAP_PROD_SETTINGS),
  },
} satisfies Record<string, ChatAccountConfig>;

type MatrixEnvironment = keyof typeof MATRIX_ENVIRONMENTS;

const isMatrixEnvironment = (value: string): value is MatrixEnvironment =>
  Object.hasOwn(MATRIX_ENVIRONMENTS, value);

/**
 * Chat accounts of the environment set by the backend configuration
 * (`FRONTEND_CHAT_ENVIRONMENT`), so one build serves every environment. `null`
 * when it is missing or unknown: the chat never falls back to another one.
 *
 * The manifest intentionally remains an array: the registry, routes, and
 * caches stay ready for several explicitly configured Matrix accounts. Each
 * environment has its own account id, so its sessions, caches and crypto
 * stores never mix with another environment's.
 */
export const chatAccountsFor = (
  environment: string | undefined,
): ChatAccountConfig[] | null => {
  const value = environment?.trim();
  return value && isMatrixEnvironment(value)
    ? [MATRIX_ENVIRONMENTS[value]]
    : null;
};

export const createDriver = (
  accountId: AccountId,
  settings: Record<string, unknown>,
): Driver => new LazyMatrixDriver(accountId, settings);
