type HomeServer = { base_url: string; server_name: string };

/**
 * Resolves the Matrix homeserver hosting the given email address, via the
 * identity-server lookup of the primary homeserver in `homeServerList`. The
 * list is passed in by the account preset so this util has no hard-coded Tchap
 * configuration.
 */
export const fetchHomeserverForEmail = async (
  email: string,
  homeServerList: ReadonlyArray<HomeServer>,
): Promise<HomeServer> => {
  const primaryHomeServer = homeServerList[0];
  if (!primaryHomeServer) {
    throw new Error("No homeserver configured for email discovery.");
  }

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
