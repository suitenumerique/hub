import { IdTokenClaims } from "oidc-client-ts";

export type MatrixUserInterface = {
  homeserverUrl: string;
  mxId: string;
  deviceId?: string;
  accessToken: string;
  refreshToken?: string;
};

export type CompleteOidcLoginResponse = {
  // accessToken gained from OIDC token issuer
  accessToken: string;
  // refreshToken gained from OIDC token issuer, when falsy token cannot be refreshed
  refreshToken?: string;
  // idToken gained from OIDC token issuer
  idToken: string;
  // this client's id as registered with the OIDC issuer
  clientId: string;
  // issuer used during authentication
  issuer: string;
  // claims of the given access token; used during token refresh to validate new tokens
  idTokenClaims: IdTokenClaims;
};
