import {
  createClient,
  generateOidcAuthorizationUrl,
  registerOidcClient,
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
    registerOidcClient: vi.fn(),
  };
});

const HOMESERVER = "http://localhost:9808";
const BRANDING = {
  clientName: "Hub",
  logoUri: "http://localhost:9800/assets/logo-icon.svg",
};
const OIDC_METADATA = {
  issuer: "http://localhost:9810/",
  authorization_endpoint: "http://localhost:9810/authorize",
  token_endpoint: "http://localhost:9810/token",
};

const makeStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
};

const setLocation = (href: string): void => {
  const url = new URL(href);
  vi.stubGlobal("window", {
    location: {
      origin: url.origin,
      pathname: url.pathname,
    },
  });
};

const setupOidcMocks = (): void => {
  vi.mocked(createClient).mockReturnValue({
    getAuthMetadata: vi.fn(async () => OIDC_METADATA),
  } as never);
  vi.mocked(registerOidcClient).mockImplementation(async () => {
    return `client-${vi.mocked(registerOidcClient).mock.calls.length}`;
  });
  vi.mocked(generateOidcAuthorizationUrl).mockImplementation(
    ({ clientId, redirectUri }) =>
      `http://localhost:9810/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}`,
  );
};

describe("getOIDCAuthUrl", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("reuses the dynamic client for the same homeserver and redirect URI", async () => {
    vi.stubGlobal("localStorage", makeStorage());
    setLocation("http://localhost:9800/chat");
    setupOidcMocks();

    const first = await getOIDCAuthUrl(HOMESERVER, "hub", BRANDING);
    const second = await getOIDCAuthUrl(HOMESERVER, "hub", BRANDING);

    expect(registerOidcClient).toHaveBeenCalledOnce();
    expect(registerOidcClient).toHaveBeenCalledWith(
      OIDC_METADATA,
      expect.objectContaining({
        redirectUris: ["http://localhost:9800/chat"],
      }),
    );
    expect(first).toContain("client_id=client-1");
    expect(second).toContain("client_id=client-1");
  });

  it("uses a pre-registered client id without dynamic registration", async () => {
    setLocation("http://localhost:9800/chat");
    setupOidcMocks();

    const authUrl = await getOIDCAuthUrl(
      HOMESERVER,
      "hub",
      BRANDING,
      "01J00000000000000000000000",
    );

    expect(registerOidcClient).not.toHaveBeenCalled();
    expect(generateOidcAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "01J00000000000000000000000",
        redirectUri: "http://localhost:9800/chat",
      }),
    );
    expect(authUrl).toContain("client_id=01J00000000000000000000000");
  });

  it("registers another dynamic client when the redirect URI changes", async () => {
    vi.stubGlobal("localStorage", makeStorage());
    setupOidcMocks();

    setLocation("http://localhost:9800/chat/new");
    const fromNewChat = await getOIDCAuthUrl(HOMESERVER, "hub", BRANDING);

    setLocation("http://localhost:9800/chat");
    const fromExistingChat = await getOIDCAuthUrl(HOMESERVER, "hub", BRANDING);

    expect(registerOidcClient).toHaveBeenCalledTimes(2);
    expect(registerOidcClient).toHaveBeenNthCalledWith(
      1,
      OIDC_METADATA,
      expect.objectContaining({
        redirectUris: ["http://localhost:9800/chat/new"],
      }),
    );
    expect(registerOidcClient).toHaveBeenNthCalledWith(
      2,
      OIDC_METADATA,
      expect.objectContaining({
        redirectUris: ["http://localhost:9800/chat"],
      }),
    );
    expect(fromNewChat).toContain("client_id=client-1");
    expect(fromExistingChat).toContain("client_id=client-2");
  });
});
