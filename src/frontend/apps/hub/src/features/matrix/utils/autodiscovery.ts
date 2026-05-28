import { matrixConfig } from "../config";
const homeServerList = matrixConfig["homeserver_list"];

/**
 *
 * Find the homeserver corresponding to the given email.
 * @param email Note : if email is invalid, this function still works and returns the externs server. (todo : fix)
 * @returns
 */
export const fetchHomeserverForEmail = async (
  email: string,
): Promise<void | { base_url: string; server_name: string }> => {
  try {
    const randomHomeServer = homeServerList[0];
    const infoUrl = "/_matrix/identity/api/v1/info?medium=email&address=";

    const response = await fetch(randomHomeServer.base_url + infoUrl + encodeURIComponent(email));
    if (!response.ok) {
      throw new Error('Could not find homeserver for this email');
    }
    const data = await response.json();
    // Never returns error : anything that doesn't match a homeserver (even invalid email) returns "externe".
    const serverUrl = 'https://matrix.' + data.hs;

    return {
      base_url: serverUrl,
      server_name: findHomeServerNameFromUrl(serverUrl),
    };
  } catch (err) {
    console.error('Could not find homeserver for this email', err);
  }
};

const findHomeServerNameFromUrl = (url: string): string => {
  const homeserver = homeServerList.find(
    (homeServer) => homeServer.base_url === url,
  );
  return homeserver?.server_name || '';
};

// const makeValidatedServerConfig = async (serverConfig: Record<string, unknown>): Promise<ValidatedServerConfig> => {
//     const discoveryResult: ClientConfig = {
//         "m.homeserver": {
//             state: "SUCCESS",
//             error: null,
//             base_url: serverConfig.base_url,
//             server_name: serverConfig.server_name,
//         },
//         "m.identity_server": {
//             state: "SUCCESS",discovery
//             error: null,
//             base_url: serverConfig.base_url, // On Tchap our Identity server urls and home server urls are the same
//             server_name: serverConfig.server_name,
//         },
//     } as ClientConfig;
//     const validatedServerConf = await AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(
//         discoveryResult["m.homeserver"].server_name,
//         discoveryResult,
//     );
//     return validatedServerConf;
// };
