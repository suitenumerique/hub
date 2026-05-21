import { createClient } from 'matrix-js-sdk/lib/matrix';
import { MatrixUserInterface } from '../types';
import { matrixConfig } from '../config';

/**
 * Send a login request to the given server, and format the response
 * as a MatrixClientCreds
 *
 * @param {string} username
 * @param {string} password
 *
 * @returns {Promise<MatrixUserInterface>}
 */
export async function sendLoginRequest(
  username: string,
  password: string,
): Promise<MatrixUserInterface> {
  const hsUrl = matrixConfig.default_server_config['m.homeserver'].base_url;
  const isUrl =
    matrixConfig.default_server_config['m.identity_server'].base_url;
  // create temp client for login request only
  const client = createClient({
    baseUrl: hsUrl,
    idBaseUrl: isUrl,
  });
  const loginParams = {
    type: 'm.login.password',
    password,
    identifier: {
      type: 'm.id.user',
      user: username,
    },
  };

  const data = await client.loginRequest(loginParams);

  // const wellknown = data.well_known;
  // if (wellknown) {
  //   if (wellknown['m.homeserver']?.['base_url']) {
  //     hsUrl = wellknown['m.homeserver']['base_url'];
  //     logger.log(
  //       `Overrode homeserver setting with ${hsUrl} from login response`,
  //     );
  //   }
  //   if (wellknown['m.identity_server']?.['base_url']) {
  //     // TODO: should we prompt here?
  //     isUrl = wellknown['m.identity_server']['base_url'];
  //   }
  // }

  const creds: MatrixUserInterface = {
    homeserverUrl: hsUrl,
    identityServerUrl: isUrl,
    mxId: data.user_id,
    deviceId: data.device_id,
    accessToken: data.access_token,
  };

  return creds;
}
