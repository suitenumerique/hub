// Per-account Matrix configuration: the settings shape the driver reads, the
// built-in presets, and a defensive parser. Everything Tchap-specific lives
// here as a *preset* so the shared driver path holds no hard-coded homeserver,
// identity server, branding value, or discovery choice.

/** Homeserver discovery strategy for a Matrix account. */
export type MatrixDiscovery = "fixed" | "tchap-email";

/** OIDC client branding shown on the login/consent screen. */
export type MatrixBranding = {
  clientName: string;
  logoUri: string;
};

/**
 * Per-account Matrix configuration, parsed from `ChatAccountConfig.settings`.
 * The driver reads ONLY this for discovery and OIDC — never a module constant.
 */
export type MatrixDriverSettings = {
  discovery: MatrixDiscovery;
  /** Homeserver base URL, used directly when `discovery === "fixed"`. */
  baseUrl: string;
  /** Homeserver name, paired with `baseUrl` for `fixed` discovery. */
  serverName: string;
  branding: MatrixBranding;
  /**
   * OIDC `login_hint`. For `tchap-email` it doubles as the discovery address;
   * when absent the driver falls back to the dev hint, then the Hub user email.
   */
  loginHint?: string;
  /**
   * Optional pre-registered OIDC client id. When absent, the driver dynamically
   * registers a client with the homeserver's delegated auth issuer.
   */
  oidcClientId?: string;
  /** Dev-only convenience: accept room invites automatically after sync. */
  autoJoinInvites: boolean;
};

/** Tchap homeservers consulted by the email-based identity-server lookup. */
export const TCHAP_HOMESERVER_LIST: ReadonlyArray<{
  base_url: string;
  server_name: string;
}> = [
  { base_url: "https://matrix.dev01.tchap.incubateur.net", server_name: "Agents 1" },
  { base_url: "https://matrix.dev02.tchap.incubateur.net", server_name: "Agents 2" },
  { base_url: "https://matrix.ext01.tchap.incubateur.net", server_name: "Externes" },
];

/**
 * Default preset: the Tchap behavior the driver shipped with. An account with no
 * `settings` (e.g. `matrix-dev`) parses to exactly this, so Tchap is unchanged.
 * `baseUrl`/`serverName` stay empty because Tchap resolves them per email.
 */
export const TCHAP_PRESET: MatrixDriverSettings = {
  discovery: "tchap-email",
  baseUrl: "",
  serverName: "",
  branding: {
    clientName: "Hub",
    logoUri: "https://www.tchap.incubateur.net/vector-icons/180.png",
  },
  autoJoinInvites: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readString = (
  raw: Record<string, unknown>,
  key: string,
): string | undefined => (typeof raw[key] === "string" ? raw[key] : undefined);

const readBoolean = (
  raw: Record<string, unknown>,
  key: string,
): boolean | undefined =>
  typeof raw[key] === "boolean" ? raw[key] : undefined;

const readDiscovery = (raw: Record<string, unknown>): MatrixDiscovery =>
  raw.discovery === "fixed" || raw.discovery === "tchap-email"
    ? raw.discovery
    : TCHAP_PRESET.discovery;

const readBranding = (raw: Record<string, unknown>): MatrixBranding => {
  const branding = isRecord(raw.branding) ? raw.branding : {};
  return {
    clientName:
      readString(branding, "clientName") ?? TCHAP_PRESET.branding.clientName,
    logoUri: readString(branding, "logoUri") ?? TCHAP_PRESET.branding.logoUri,
  };
};

/**
 * Parses raw `ChatAccountConfig.settings` into a `MatrixDriverSettings`. Total
 * by design: missing, malformed, or unknown fields fall back to the Tchap
 * preset, so an account with no settings still constructs without throwing.
 */
export const parseMatrixDriverSettings = (
  raw: Record<string, unknown> = {},
): MatrixDriverSettings => ({
  discovery: readDiscovery(raw),
  baseUrl: readString(raw, "baseUrl") ?? TCHAP_PRESET.baseUrl,
  serverName: readString(raw, "serverName") ?? TCHAP_PRESET.serverName,
  branding: readBranding(raw),
  loginHint: readString(raw, "loginHint"),
  oidcClientId: readString(raw, "oidcClientId"),
  autoJoinInvites:
    readBoolean(raw, "autoJoinInvites") ?? TCHAP_PRESET.autoJoinInvites,
});
