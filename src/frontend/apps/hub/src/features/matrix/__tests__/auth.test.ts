import {
  createClient,
  generateOidcAuthorizationUrl,
} from "matrix-js-sdk/lib/matrix";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getOIDCAuthUrl } from "../utils/auth";

vi.mock("matrix-js-sdk/lib/randomstring", () => ({
  secureRandomString: () => "nonce",
}));

vi.mock("matrix-js-sdk/lib/matrix", () => {
  class MatrixError extends Error {
    httpStatus?: number;
    errcode?: string;
  }

  class OidcTokenRefresher {
    async doRefreshAccessToken() {
      return undefined;
    }
  }

  return {
    completeAuthorizationCodeGrant: vi.fn(),
    createClient: vi.fn(),
    generateOidcAuthorizationUrl: vi.fn(),
    MatrixError,
    OidcTokenRefresher,
  };
});

const HOMESERVER = "http://localhost:9808";
const OIDC_CLIENT_ID = "01J00000000000000000000000";
const OIDC_METADATA = {
  issuer: "http://localhost:9810/",
  authorization_endpoint: "http://localhost:9810/authorize",
  token_endpoint: "http://localhost:9810/token",
};

describe("getOIDCAuthUrl", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the pre-registered local MAS client", async () => {
    vi.stubGlobal("window", {
      location: {
        origin: "http://localhost:9800",
        pathname: "/chat",
      },
    });
    vi.mocked(createClient).mockReturnValue({
      getAuthMetadata: vi.fn(async () => OIDC_METADATA),
    } as never);
    vi.mocked(generateOidcAuthorizationUrl).mockReturnValue(
      "http://localhost:9810/authorize",
    );

    await getOIDCAuthUrl(HOMESERVER, "hub@example.com", OIDC_CLIENT_ID);

    expect(generateOidcAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: OIDC_CLIENT_ID,
        homeserverUrl: HOMESERVER,
        loginHint: "hub@example.com",
        redirectUri: "http://localhost:9800/chat",
      }),
    );
  });
});
