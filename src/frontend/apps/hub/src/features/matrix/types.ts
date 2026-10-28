export type MatrixUserInterface = {
  homeserverUrl: string;
  mxId: string;
  deviceId?: string;
  accessToken: string;
  refreshToken?: string;
};

export type CompleteOidcLoginResponse = {
  // homeserver the authorization was started for, kept in the OIDC state
  homeserverUrl: string;
  // accessToken gained from OIDC token issuer
  accessToken: string;
  // refreshToken gained from OIDC token issuer, when falsy token cannot be refreshed
  refreshToken?: string;
  // this client's id as registered with the OIDC issuer
  clientId: string;
  // issuer used during authentication
  issuer: string;
};
