import {
  type AccessTokens,
  completeAuthorizationCodeGrant,
  createClient,
  generateOidcAuthorizationUrl,
  MatrixClient,
  MatrixError,
  OidcClientConfig,
  OidcTokenRefresher,
  registerOidcClient,
  type TokenRefreshFunction,
} from "matrix-js-sdk/lib/matrix";
import { secureRandomString } from "matrix-js-sdk/lib/randomstring";
import { type IdTokenClaims } from "oidc-client-ts";

import { type MatrixBranding } from "../config";
import { CompleteOidcLoginResponse } from "../types";

// OIDC response mode used for the authorization request.
const RESPONSE_MODE = "query";
// Nonce length, in characters. OIDC recommends a high-entropy value.
const NONCE_LENGTH = 32;
// localStorage prefix for the dynamically-registered client id. The cache is
// scoped by homeserver and redirect URI because a dynamic client is registered
// with the exact redirect URI it is allowed to use.
const REGISTERED_CLIENT_PREFIX = "oidc_dyn_client:";

/**
 * Builds the OIDC authorization URL to redirect the user to. Registers a
 * dynamic client with the homeserver's issuer (cached per homeserver) and
 * returns the URL that starts the authorization-code flow.
 */
export const getOIDCAuthUrl = async (
  homeserverUrl: string,
  email: string,
  branding: MatrixBranding,
  oidcClientId?: string,
): Promise<string> => {
  const delegatedAuthConfig = await fetchDelegatedAuthMetadata(homeserverUrl);
  if (!delegatedAuthConfig) {
    throw new Error("OIDC metadata not available for this server");
  }

  const redirectUri = new URL(window.location.origin + window.location.pathname)
    .href;
  const clientUri = window.location.origin;

  const clientId =
    oidcClientId ??
    (await getOrRegisterClientId(
      homeserverUrl,
      redirectUri,
      delegatedAuthConfig,
      {
        clientName: branding.clientName,
        clientUri,
        redirectUris: [redirectUri],
        logoUri: branding.logoUri,
        applicationType: "web",
        contacts: [],
        tosUri: "",
        policyUri: "",
      },
    ));

  return generateOidcAuthorizationUrl({
    metadata: delegatedAuthConfig,
    redirectUri,
    clientId,
    homeserverUrl,
    identityServerUrl: homeserverUrl,
    nonce: secureRandomString(NONCE_LENGTH),
    urlState: "",
    loginHint: email,
    responseMode: RESPONSE_MODE,
  });
};

const getOrRegisterClientId = async (
  homeserverUrl: string,
  redirectUri: string,
  metadata: OidcClientConfig,
  registration: Parameters<typeof registerOidcClient>[1],
): Promise<string> => {
  const cacheKey = `${REGISTERED_CLIENT_PREFIX}${homeserverUrl}:${redirectUri}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    return cached;
  }
  const clientId = await registerOidcClient(metadata, registration);
  localStorage.setItem(cacheKey, clientId);
  return clientId;
};

const fetchDelegatedAuthMetadata = async (
  homeserverUrl: string,
): Promise<OidcClientConfig | undefined> => {
  try {
    const tempClient = createClient({ baseUrl: homeserverUrl });
    return await tempClient.getAuthMetadata();
  } catch (error) {
    if (
      error instanceof MatrixError &&
      error.httpStatus === 404 &&
      error.errcode === "M_UNRECOGNIZED"
    ) {
      // 404 M_UNRECOGNIZED means the server does not support OIDC.
      console.error("Homeserver does not support OIDC", homeserverUrl);
    } else {
      console.error("Failed to fetch OIDC metadata", error);
    }
    return undefined;
  }
};

/**
 * Completes the authorization-code flow with the parameters returned on the
 * redirect back, resolving with a {@link CompleteOidcLoginResponse}.
 * @throws when a valid access token cannot be obtained.
 */
export const completeOidcLogin = async (params: {
  code: string;
  state: string;
}): Promise<CompleteOidcLoginResponse> => {
  const { code, state } = params;
  const {
    homeserverUrl,
    tokenResponse,
    idTokenClaims,
    identityServerUrl,
    oidcClientSettings,
  } = await completeAuthorizationCodeGrant(code, state, RESPONSE_MODE);

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

type RefreshedTokens = Pick<AccessTokens, "accessToken" | "refreshToken">;

/**
 * OIDC token refresher whose only addition over the SDK base class is handing
 * the freshly minted tokens back to the caller, so token *persistence* stays
 * owned by the driver instead of leaking into this util.
 */
class HubOidcTokenRefresher extends OidcTokenRefresher {
  public constructor(
    issuer: string,
    clientId: string,
    redirectUri: string,
    deviceId: string,
    idTokenClaims: IdTokenClaims,
    private readonly onTokensRefreshed: (tokens: RefreshedTokens) => void,
  ) {
    super(issuer, clientId, redirectUri, deviceId, idTokenClaims);
  }

  protected async persistTokens(tokens: RefreshedTokens): Promise<void> {
    this.onTokensRefreshed(tokens);
  }
}

/**
 * Builds the `tokenRefreshFunction` the Matrix client calls when it hits an
 * expired access token. Tchap issues short-lived OIDC tokens, so without this
 * the SDK 401s on every request after the token lapses and self-logs-out.
 * `onTokensRefreshed` lets the caller persist the rotated tokens for the next
 * page load.
 */
export const buildOidcTokenRefreshFunction = (params: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  deviceId: string;
  idTokenClaims: IdTokenClaims;
  onTokensRefreshed: (tokens: RefreshedTokens) => void;
}): TokenRefreshFunction => {
  const refresher = new HubOidcTokenRefresher(
    params.issuer,
    params.clientId,
    params.redirectUri,
    params.deviceId,
    params.idTokenClaims,
    params.onTokensRefreshed,
  );
  return (refreshToken) => refresher.doRefreshAccessToken(refreshToken);
};

/**
 * Resolves the owner of an access token via `whoami`.
 * @throws when the request fails.
 */
export const getUserIdFromAccessToken = async (
  accessToken: string,
  homeserverUrl: string,
  identityServerUrl?: string,
): Promise<ReturnType<MatrixClient["whoami"]>> => {
  try {
    const client = createClient({
      baseUrl: homeserverUrl,
      accessToken,
      idBaseUrl: identityServerUrl,
    });
    return await client.whoami();
  } catch (error) {
    console.error("Failed to retrieve userId using accessToken", error);
    throw new Error("Failed to retrieve userId using accessToken");
  }
};
