import { matrixConfig } from "../config";

const homeServerList = matrixConfig["homeserver_list"];

/**
 * Resolves the Matrix homeserver hosting the given email address, via the
 * identity-server lookup of the primary (first) configured homeserver.
 *
 * Note: the upstream identity endpoint never errors on an unknown address — it
 * falls back to the "externe" server — so an invalid email still resolves to a
 * (default) homeserver rather than throwing. See the Tchap autodiscovery spec.
 */
export const fetchHomeserverForEmail = async (
  email: string,
): Promise<{ base_url: string; server_name: string }> => {
  const primaryHomeServer = homeServerList[0];
  const infoUrl = "/_matrix/identity/api/v1/info?medium=email&address=";

  const response = await fetch(
    primaryHomeServer.base_url + infoUrl + encodeURIComponent(email),
  );
  if (!response.ok) {
    throw new Error(`Could not resolve a homeserver for "${email}".`);
  }

  const data = (await response.json()) as { hs: string };
  const serverUrl = `https://matrix.${data.hs}`;

  return {
    base_url: serverUrl,
    server_name: findHomeServerNameFromUrl(serverUrl),
  };
};

const findHomeServerNameFromUrl = (url: string): string => {
  const homeserver = homeServerList.find(
    (homeServer) => homeServer.base_url === url,
  );
  return homeserver?.server_name ?? "";
};
