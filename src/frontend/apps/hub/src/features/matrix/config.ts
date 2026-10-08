type MatrixSharedSettings = {
  /** Explicit client used to prepare and recover this same Matrix account. */
  externalClientUrl: string;
  externalClientLabel: string;
  /** Optional OIDC login hint; defaults to the authenticated Hub email. */
  loginHint?: string;
  /**
   * Largest file, in bytes, users may attach. The homeserver's own limit
   * (`m.upload.size`) still applies when it is lower.
   */
  maxUploadSize?: number;
};

/** One known homeserver with an OAuth client registered on its issuer. */
export type MatrixFixedSettings = MatrixSharedSettings & {
  discovery: "fixed";
  /** Matrix client-server API base URL for this account. */
  baseUrl: string;
  /** Matrix server name retained as account metadata for future servers. */
  serverName: string;
  /** OAuth client registered on the account's delegated-auth issuer. */
  oidcClientId: string;
};

/**
 * Tchap federation: the user's homeserver is resolved from their email, and the
 * OAuth client is registered dynamically on that homeserver's issuer.
 */
export type MatrixTchapSettings = MatrixSharedSettings & {
  discovery: "tchap-email";
  /**
   * Server names of the environment. They answer the email lookup and are the
   * only homeservers the account may connect to.
   */
  homeservers: string[];
  /** Name shown by the authorization server for the registered client. */
  clientName: string;
};

export type MatrixDriverSettings = MatrixFixedSettings | MatrixTchapSettings;

export const MATRIX_LOCAL_SETTINGS = {
  discovery: "fixed",
  baseUrl: "http://localhost:9808",
  serverName: "localhost",
  oidcClientId: "01J00000000000000000000000",
  externalClientUrl: "http://localhost:9807",
  externalClientLabel: "Element local",
  maxUploadSize: 20 * 1024 * 1024,
} satisfies MatrixDriverSettings;

const TCHAP_CLIENT_NAME = "LaSuite Hub";

export const TCHAP_PREPROD_SETTINGS = {
  discovery: "tchap-email",
  homeservers: ["i.tchap.gouv.fr", "a.tchap.gouv.fr", "e.tchap.gouv.fr"],
  clientName: TCHAP_CLIENT_NAME,
  externalClientUrl: "https://www.beta.tchap.gouv.fr",
  externalClientLabel: "Tchap (preprod)",
} satisfies MatrixDriverSettings;

export const TCHAP_PROD_SETTINGS = {
  discovery: "tchap-email",
  homeservers: [
    "agent.tchap.gouv.fr",
    "agent.agriculture.tchap.gouv.fr",
    "agent.collectivites.tchap.gouv.fr",
    "agent.culture.tchap.gouv.fr",
    "agent.dev-durable.tchap.gouv.fr",
    "agent.diplomatie.tchap.gouv.fr",
    "agent.dinum.tchap.gouv.fr",
    "agent.education.tchap.gouv.fr",
    "agent.elysee.tchap.gouv.fr",
    "agent.externe.tchap.gouv.fr",
    "agent.finances.tchap.gouv.fr",
    "agent.interieur.tchap.gouv.fr",
    "agent.intradef.tchap.gouv.fr",
    "agent.justice.tchap.gouv.fr",
    "agent.pm.tchap.gouv.fr",
    "agent.social.tchap.gouv.fr",
    "agent.ssi.tchap.gouv.fr",
  ],
  clientName: TCHAP_CLIENT_NAME,
  externalClientUrl: "https://www.tchap.gouv.fr",
  externalClientLabel: "Tchap",
} satisfies MatrixDriverSettings;

/** Tchap homeservers are served by their `matrix.` host. */
export const tchapHomeserverUrl = (serverName: string): string =>
  `https://matrix.${serverName}`;

const readRequiredString = (
  raw: Record<string, unknown>,
  key: string,
): string => {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Matrix account setting "${key}" is required.`);
  }
  return value;
};

const readOptionalByteSize = (
  raw: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = raw[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Matrix account setting "${key}" must be a positive number of bytes.`,
    );
  }
  return value;
};

const readServerNames = (raw: Record<string, unknown>): string[] => {
  const value = raw.homeservers;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every(
      (name) =>
        typeof name === "string" && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name),
    )
  ) {
    throw new Error('Matrix account setting "homeservers" is invalid.');
  }
  return value as string[];
};

const readExternalClientUrl = (raw: Record<string, unknown>): string => {
  const url = new URL(readRequiredString(raw, "externalClientUrl"));
  if (
    !["https:", "http:"].includes(url.protocol) ||
    (url.protocol === "http:" && url.hostname !== "localhost") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Invalid external Matrix client URL.");
  }
  return url.href;
};

/**
 * Validates one Matrix account manifest. There is deliberately no fallback
 * preset: a malformed account must fail explicitly instead of connecting to a
 * different homeserver. Manifests without `discovery` are fixed accounts.
 */
const readSharedSettings = (
  raw: Record<string, unknown>,
): MatrixSharedSettings => {
  const maxUploadSize = readOptionalByteSize(raw, "maxUploadSize");
  return {
    externalClientUrl: readExternalClientUrl(raw),
    externalClientLabel: readRequiredString(raw, "externalClientLabel"),
    ...(typeof raw.loginHint === "string" && raw.loginHint.length > 0
      ? { loginHint: raw.loginHint }
      : {}),
    ...(maxUploadSize !== undefined ? { maxUploadSize } : {}),
  };
};

export const parseMatrixDriverSettings = (
  raw: Record<string, unknown>,
): MatrixDriverSettings => {
  const discovery = raw.discovery ?? "fixed";
  if (discovery === "tchap-email") {
    return {
      discovery,
      homeservers: readServerNames(raw),
      clientName: readRequiredString(raw, "clientName"),
      ...readSharedSettings(raw),
    };
  }
  if (discovery !== "fixed") {
    throw new Error('Matrix account setting "discovery" is invalid.');
  }
  return {
    discovery,
    baseUrl: readRequiredString(raw, "baseUrl"),
    serverName: readRequiredString(raw, "serverName"),
    oidcClientId: readRequiredString(raw, "oidcClientId"),
    ...readSharedSettings(raw),
  };
};
