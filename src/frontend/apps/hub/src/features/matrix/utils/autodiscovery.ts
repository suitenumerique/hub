type HomeServer = { base_url: string; server_name: string };

/**
 * Resolves the Matrix homeserver hosting the given email address, via the
 * identity-server lookup of the primary (first) homeserver in `homeServerList`.
 * The list is passed in (from the account's preset) rather than imported, so
 * this util carries no hard-coded Tchap configuration.
 *
 * Note: the upstream identity endpoint never errors on an unknown address — it
 * falls back to the "externe" server — so an invalid email still resolves to a
 * (default) homeserver rather than throwing. See the Tchap autodiscovery spec.
 */
export const fetchHomeserverForEmail = async (
  email: string,
  homeServerList: ReadonlyArray<HomeServer>,
): Promise<HomeServer> => {
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
    server_name: findHomeServerNameFromUrl(serverUrl, homeServerList),
  };
};

const findHomeServerNameFromUrl = (
  url: string,
  homeServerList: ReadonlyArray<HomeServer>,
): string => {
  const homeserver = homeServerList.find(
    (homeServer) => homeServer.base_url === url,
  );
  return homeserver?.server_name ?? "";
};
