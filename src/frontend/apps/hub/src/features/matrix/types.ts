// In future implementation we could merge both types ?
// import { User } from '@/features/auth/types';
import { type OidcClientConfig } from "matrix-js-sdk/lib/matrix";
import { IdTokenClaims } from "oidc-client-ts";

// response from login with matrix client
export type MatrixUserInterface = {
  homeserverUrl: string;
  identityServerUrl?: string;
  mxId: string;
  deviceId?: string;
  accessToken: string;
  refreshToken?: string;
  guest?: boolean;
  pickleKey?: string;
  freshLogin?: boolean;
};

export interface ValidatedServerConfig {
  hsUrl: string;
  hsName: string;
  hsNameIsDifferent: boolean;
  isUrl: string;
  isDefault: boolean;
  // when the server config is based on static URLs the hsName is not resolvable and things may wish to use hsUrl
  isNameResolvable: boolean;
  /**
   * Config related to delegated authentication
   * Included when delegated auth is configured and valid, otherwise undefined.
   * From issuer's .well-known/openid-configuration.
   * Used for OIDC native flow authentication.
   */
  delegatedAuthentication?: OidcClientConfig;
}

export type CompleteOidcLoginResponse = {
  // url of the homeserver selected during login
  homeserverUrl: string;
  // identity server url as discovered during login
  identityServerUrl?: string;
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
