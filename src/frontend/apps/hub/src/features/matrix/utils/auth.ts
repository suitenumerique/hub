import {
  type AccessTokens,
  createClient,
  MatrixClient,
  MatrixError,
  OAuth2,
  OAuth2Error,
  TokenRefresher,
  type TokenRefreshFunction,
  type ValidatedAuthMetadata,
} from "matrix-js-sdk/lib/matrix";
import { secureRandomString } from "matrix-js-sdk/lib/randomstring";

import { CompleteOidcLoginResponse } from "../types";

// OAuth response mode used for the authorization request.
const RESPONSE_MODE = "query";
// Length of the authorization `state`, in characters.
const STATE_LENGTH = 32;
// Session storage prefix of the context needed to finish a login, per state.
const AUTH_CONTEXT_STORAGE_PREFIX = "matrixOAuthContext:";

// Use one registered callback even when login starts from a deep link. A
// pathname such as /home is not necessarily registered with the OIDC issuer.
export const getOidcRedirectUri = (): string =>
  new URL("/", window.location.origin).href;

/**
 * OAuth client used to sign in: either registered in advance on the issuer, or
 * registered dynamically under this name.
 */
export type OidcClient = { clientId: string } | { clientName: string };

/**
 * What the authorization redirect needs to finish the login, saved in session
 * storage under its `state` like Element (persistOAuthSettings.ts).
 */
type StoredAuthContext = {
  homeserverUrl: string;
  metadata: ValidatedAuthMetadata;
  authContext: OAuth2["context"];
};

/**
 * Dynamic registration (MSC2966). MAS returns the same client id when the
 * registration body is identical, so registering again at each login is cheap
 * and recovers by itself if the issuer forgets the client.
 */
const registerClient = (
  metadata: ValidatedAuthMetadata,
  clientName: string,
  redirectUri: string,
): Promise<string> =>
  OAuth2.registerClient(metadata, {
    client_name: clientName,
    client_uri: window.location.origin,
    redirect_uris: [redirectUri],
    application_type: "web",
  });

/**
 * Builds the OAuth authorization URL on the homeserver's delegated-auth issuer.
 * The homeserver URL travels with the authorization state and comes back from
 * {@link completeOidcLogin}.
 */
export const getOIDCAuthUrl = async (
  homeserverUrl: string,
  email: string,
  client: OidcClient,
): Promise<string> => {
  const metadata = await fetchDelegatedAuthMetadata(homeserverUrl);
  if (!metadata) {
    throw new Error("OIDC metadata not available for this server");
  }

  const redirectUri = getOidcRedirectUri();
  const clientId =
    "clientId" in client
      ? client.clientId
      : await registerClient(metadata, client.clientName, redirectUri);
  const auth = new OAuth2(metadata, { clientId, redirectUri });
  const state = secureRandomString(STATE_LENGTH);
  sessionStorage.setItem(
    AUTH_CONTEXT_STORAGE_PREFIX + state,
    JSON.stringify({
      homeserverUrl,
      metadata,
      authContext: auth.context,
    } satisfies StoredAuthContext),
  );
  const url = new URL(
    await auth.generateAuthorizationCodeGrantUrl(state, RESPONSE_MODE),
  );
  url.searchParams.set("login_hint", email);
  return url.toString();
};

const fetchDelegatedAuthMetadata = async (
  homeserverUrl: string,
): Promise<ValidatedAuthMetadata | undefined> => {
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

/** Reads, then forgets, the context saved when the authorization started. */
const takeStoredAuthContext = (state: string): StoredAuthContext => {
  const key = AUTH_CONTEXT_STORAGE_PREFIX + state;
  const raw = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  if (!raw) {
    throw new Error(OAuth2Error.MissingOrInvalidStoredState);
  }
  return JSON.parse(raw) as StoredAuthContext;
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
  const { homeserverUrl, metadata, authContext } =
    takeStoredAuthContext(state);
  const tokenResponse = await new OAuth2(
    metadata,
    authContext,
  ).completeAuthorizationCodeGrant(code);

  return {
    homeserverUrl,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    clientId: authContext.clientId,
    issuer: metadata.issuer,
  };
};

type RefreshedTokens = Pick<AccessTokens, "accessToken" | "refreshToken">;

/**
 * Builds the `tokenRefreshFunction` the Matrix client calls when it hits an
 * expired access token. Without this, the SDK treats a 401 after token expiry
 * as a hard logout.
 * The issuer endpoints are read from the homeserver at the first refresh, so a
 * page load with a valid token makes no extra request.
 * `onTokensRefreshed` lets the caller persist the rotated tokens for the next
 * page load, so token persistence stays owned by the driver.
 */
export const buildOidcTokenRefreshFunction = (params: {
  homeserverUrl: string;
  clientId: string;
  redirectUri: string;
  deviceId: string;
  onTokensRefreshed: (tokens: RefreshedTokens) => void;
}): TokenRefreshFunction => {
  let refresher: Promise<TokenRefresher> | undefined;
  const getRefresher = (): Promise<TokenRefresher> => {
    refresher ??= createClient({ baseUrl: params.homeserverUrl })
      .getAuthMetadata()
      .then(
        (metadata) =>
          new TokenRefresher(
            new OAuth2(metadata, {
              clientId: params.clientId,
              redirectUri: params.redirectUri,
              deviceId: params.deviceId,
            }),
            async (tokens) => params.onTokensRefreshed(tokens),
          ),
      )
      .catch((error: unknown) => {
        // Let the next refresh read the metadata again. The SDK logs out on a
        // MatrixError, so a homeserver error here (a 5xx while its auth
        // service restarts, a 429) must stay a failure it retries, as with the
        // OIDC refresher of matrix-js-sdk 41.
        refresher = undefined;
        throw new Error("Failed to read the OAuth metadata.", { cause: error });
      });
    return refresher;
  };
  return async (refreshToken) =>
    (await getRefresher()).tokenRefreshFunction(refreshToken);
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
    // Keep Matrix errors: their errcode (e.g. an expired account) matters.
    if (error instanceof MatrixError) throw error;
    throw new Error("Failed to retrieve userId using accessToken");
  }
};
