import { tchapHomeserverUrl } from "../config";

/** One unresponsive homeserver must not block the whole login. */
const LOOKUP_TIMEOUT_MS = 5_000;
const CACHE_KEY_PREFIX = "tchap_homeserver";

export type DiscoveredHomeserver = {
  serverName: string;
  baseUrl: string;
};

/**
 * - `unavailable`: no configured homeserver answered the lookup;
 * - `rejected`: the request itself is invalid (HTTP 400), on every server;
 * - `unknown-homeserver`: the answer is outside the environment's list.
 */
export class TchapDiscoveryError extends Error {
  constructor(
    readonly reason: "unavailable" | "rejected" | "unknown-homeserver",
    message: string,
  ) {
    super(message);
  }
}

/** Fisher–Yates shuffle, so every server gets an even share of the lookups. */
const shuffled = <T>(items: readonly T[]): T[] => {
  const result = [...items];
  const random = new Uint32Array(result.length);
  crypto.getRandomValues(random);
  for (let index = result.length - 1; index > 0; index--) {
    const swap = random[index] % (index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

/**
 * Every failure but an invalid request (network error, timeout, 5xx, 429, a
 * blocked or missing endpoint, a malformed answer) tries the next server.
 */
const lookup = async (server: string, email: string): Promise<string> => {
  const url = new URL(
    "/_matrix/identity/api/v1/info",
    tchapHomeserverUrl(server),
  );
  url.searchParams.set("medium", "email");
  url.searchParams.set("address", email);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (response.status === 400) {
    throw new TchapDiscoveryError(
      "rejected",
      `Tchap lookup rejected with HTTP ${response.status}.`,
    );
  }
  if (!response.ok) {
    throw new Error(`Tchap lookup failed with HTTP ${response.status}.`);
  }
  const data: unknown = await response.json();
  const serverName = (data as { hs?: unknown } | null)?.hs;
  if (typeof serverName !== "string") {
    throw new Error("Tchap lookup returned a malformed answer.");
  }
  return serverName;
};

const cacheKey = (accountId: string, email: string): string =>
  `${CACHE_KEY_PREFIX}:${accountId}:${email.toLowerCase()}`;

/**
 * Resolves the Tchap homeserver of an email. Every homeserver of an environment
 * gives the same answer, so they are asked in random order to spread the load,
 * and an unavailable one is skipped for the next. The answer must belong to the
 * environment: tokens are never sent to another host.
 */
export const discoverTchapHomeserver = async (
  accountId: string,
  email: string,
  homeservers: readonly string[],
): Promise<DiscoveredHomeserver> => {
  const allowed = new Set(homeservers);
  const key = cacheKey(accountId, email);
  const cached = sessionStorage.getItem(key);
  if (cached && allowed.has(cached)) {
    return { serverName: cached, baseUrl: tchapHomeserverUrl(cached) };
  }

  for (const server of shuffled(homeservers)) {
    let serverName: string;
    try {
      serverName = await lookup(server, email);
    } catch (error) {
      if (error instanceof TchapDiscoveryError) throw error;
      console.warn(`Tchap lookup on ${server} failed, trying the next one.`);
      continue;
    }
    if (!allowed.has(serverName)) {
      throw new TchapDiscoveryError(
        "unknown-homeserver",
        `Tchap returned a homeserver outside this environment: ${serverName}.`,
      );
    }
    sessionStorage.setItem(key, serverName);
    return { serverName, baseUrl: tchapHomeserverUrl(serverName) };
  }
  throw new TchapDiscoveryError(
    "unavailable",
    "No Tchap homeserver answered the email lookup.",
  );
};

/** Server name of a Matrix user id, e.g. `i.tchap.gouv.fr`. */
export const serverNameOfUserId = (userId: string): string =>
  userId.slice(userId.indexOf(":") + 1);
