export type MatrixDriverSettings = {
  /** Matrix client-server API base URL for this account. */
  baseUrl: string;
  /** Matrix server name retained as account metadata for future servers. */
  serverName: string;
  /** OAuth client registered on the account's delegated-auth issuer. */
  oidcClientId: string;
  /** Optional OIDC login hint; defaults to the authenticated Hub email. */
  loginHint?: string;
};

export const MATRIX_LOCAL_SETTINGS = {
  baseUrl: "http://localhost:9808",
  serverName: "localhost",
  oidcClientId: "01J00000000000000000000000",
} satisfies MatrixDriverSettings;

const readRequiredString = (
  raw: Record<string, unknown>,
  key: keyof MatrixDriverSettings,
): string => {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Matrix account setting "${key}" is required.`);
  }
  return value;
};

/**
 * Validates one fixed Matrix account manifest. There is deliberately no remote
 * preset or discovery fallback: a malformed account must fail explicitly
 * instead of connecting to a different homeserver.
 */
export const parseMatrixDriverSettings = (
  raw: Record<string, unknown>,
): MatrixDriverSettings => ({
  baseUrl: readRequiredString(raw, "baseUrl"),
  serverName: readRequiredString(raw, "serverName"),
  oidcClientId: readRequiredString(raw, "oidcClientId"),
  ...(typeof raw.loginHint === "string" && raw.loginHint.length > 0
    ? { loginHint: raw.loginHint }
    : {}),
});
