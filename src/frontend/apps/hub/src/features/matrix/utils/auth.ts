import {
  completeAuthorizationCodeGrant,
  createClient,
  generateOidcAuthorizationUrl,
  MatrixClient,
  MatrixError,
  OidcClientConfig,
  registerOidcClient,
} from "matrix-js-sdk/lib/matrix";
import { secureRandomString } from "matrix-js-sdk/lib/randomstring";
import { matrixConfig } from "../config";
import { CompleteOidcLoginResponse, MatrixUserInterface } from "../types";

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

/**
 * Start OIDC get correct auth url to navigate to
 * @param delegatedAuthConfig from discovery
 * @param clientId this client's id as registered with configured issuer
 * @param homeserverUrl target homeserver
 * @param identityServerUrl OPTIONAL target identity server
 * @param isRegistration if true will set the prompt to "create"
 * @returns Promise that resolves after getting the url
 */
export const getOIDCAuthUrl = async (
  hs: string,
  email: string,
): Promise<{
  authUrl: string;
  responseMode: 'fragment' | 'query';
}> => {
  const delegatedAuthConfig = await fetchDelegatedAuthMetadata(hs);
  console.log('*** delegatedAuthConfig', delegatedAuthConfig);
  if (!delegatedAuthConfig) {
    throw new Error("OIDC metadata not available for this server");
  }
  const urlCallback = new URL(
    window.location.origin + window.location.pathname,
  );
  const redirectUri = urlCallback.href;

  const defaultOidcClientUri = window.location.origin;

  const clientId = await registerOidcClient(delegatedAuthConfig!, {
    clientName: 'Hub',
    clientUri: defaultOidcClientUri,
    redirectUris: [redirectUri],
    logoUri: 'https://www.tchap.incubateur.net/vector-icons/180.png',
    applicationType: 'web',
    contacts: [''],
    tosUri: '',
    policyUri: '',
  });

  const nonce = secureRandomString(10);
  const responseMode = delegatedAuthConfig!.response_modes_supported?.includes(
    'fragment',
  )
    ? 'fragment'
    : 'query';

  const authorizationUrl = await generateOidcAuthorizationUrl({
    metadata: delegatedAuthConfig!,
    redirectUri,
    clientId,
    homeserverUrl: hs,
    identityServerUrl: hs,
    nonce,
    urlState: '',
    loginHint: email,
    responseMode
  });
  return { authUrl: authorizationUrl, responseMode };
};

const fetchDelegatedAuthMetadata = async (preferredHomeserverUrl: string) => {
  try {
    const tempClient = createClient({
      baseUrl: preferredHomeserverUrl
    })
    const delegatedAuthentication: OidcClientConfig =
      await tempClient.getAuthMetadata();
    return delegatedAuthentication;
  } catch (e) {
    if (
      e instanceof MatrixError &&
      e.httpStatus === 404 &&
      e.errcode === 'M_UNRECOGNIZED'
    ) {
      // 404 M_UNRECOGNIZED means the server does not support OIDC
      console.error('The server doesnt support OIDC');
    } else {
      console.error(e);
    }
  }
};

/**
 * Attempt to complete authorization code flow to get an access token
 * @param urlParams the parameters extracted from the app-load URI.
 * @param responseMode - the response_mode used in the auth request
 * @returns Promise that resolves with a CompleteOidcLoginResponse when login was successful
 * @throws When we failed to get a valid access token
 */
export const completeOidcLogin = async (
  params: { code: string; state: string },
  responseMode: 'fragment' | 'query',
): Promise<CompleteOidcLoginResponse> => {
  const { code, state } = params;
  const {
    homeserverUrl,
    tokenResponse,
    idTokenClaims,
    identityServerUrl,
    oidcClientSettings,
  } = await completeAuthorizationCodeGrant(code, state, responseMode);

  return {
    homeserverUrl,
    identityServerUrl,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    idToken: tokenResponse.id_token,
    clientId: oidcClientSettings.clientId,
    issuer: oidcClientSettings.issuer,
    idTokenClaims,
  };
};

/**
 * Gets information about the owner of a given access token.
 * @param accessToken
 * @param homeserverUrl
 * @param identityServerUrl
 * @returns Promise that resolves with whoami response
 * @throws when whoami request fails
 */
export const getUserIdFromAccessToken = async (
  accessToken: string,
  homeserverUrl: string,
  identityServerUrl?: string,
): Promise<ReturnType<MatrixClient['whoami']>> => {
  try {
    const client = createClient({
      baseUrl: homeserverUrl,
      accessToken: accessToken,
      idBaseUrl: identityServerUrl,
    });

    return await client.whoami();
  } catch (error) {
    console.error('Failed to retrieve userId using accessToken', error);
    throw new Error('Failed to retrieve userId using accessToken');
  }
};
