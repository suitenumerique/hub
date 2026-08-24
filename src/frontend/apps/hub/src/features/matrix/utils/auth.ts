import {
  type AccessTokens,
  completeAuthorizationCodeGrant,
  createClient,
  generateOidcAuthorizationUrl,
  MatrixClient,
  MatrixError,
  OidcClientConfig,
  OidcTokenRefresher,
  type TokenRefreshFunction,
} from "matrix-js-sdk/lib/matrix";
import { secureRandomString } from "matrix-js-sdk/lib/randomstring";
import { type IdTokenClaims } from "oidc-client-ts";

import { CompleteOidcLoginResponse } from "../types";

// OIDC response mode used for the authorization request.
const RESPONSE_MODE = "query";
// Nonce length, in characters. OIDC recommends a high-entropy value.
const NONCE_LENGTH = 32;
/**
 * Builds the OIDC authorization URL for a client already registered on the
 * configured Matrix account's delegated-auth issuer.
 */
export const getOIDCAuthUrl = async (
  homeserverUrl: string,
  email: string,
  oidcClientId: string,
): Promise<string> => {
  const delegatedAuthConfig = await fetchDelegatedAuthMetadata(homeserverUrl);
  if (!delegatedAuthConfig) {
    throw new Error("OIDC metadata not available for this server");
  }

  const redirectUri = new URL(window.location.origin + window.location.pathname)
    .href;
  return generateOidcAuthorizationUrl({
    metadata: delegatedAuthConfig,
    redirectUri,
    clientId: oidcClientId,
    homeserverUrl,
    identityServerUrl: homeserverUrl,
    nonce: secureRandomString(NONCE_LENGTH),
    urlState: "",
    loginHint: email,
    responseMode: RESPONSE_MODE,
  });
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
  const { tokenResponse, idTokenClaims, oidcClientSettings } =
    await completeAuthorizationCodeGrant(code, state, RESPONSE_MODE);

  return {
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
 * expired access token. Without this, the SDK treats a 401 after token expiry
 * as a hard logout.
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
): Promise<ReturnType<MatrixClient["whoami"]>> => {
  try {
    const client = createClient({
      baseUrl: homeserverUrl,
      accessToken,
    });
    return await client.whoami();
  } catch (error) {
    console.error("Failed to retrieve userId using accessToken", error);
    throw new Error("Failed to retrieve userId using accessToken");
  }
};
