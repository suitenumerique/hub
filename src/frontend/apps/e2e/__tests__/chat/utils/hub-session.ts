import { BrowserContext, Page } from "@playwright/test";

import { CHAT_ACCOUNT_ID, HOMESERVER_URL, HUB_API_URL, MAS_URL } from "./env";
import type { MatrixCredentials, TestIdentity } from "./matrix-admin";

/** A static file of the Hub origin: it gives storage access without the app. */
const STATIC_HUB_PAGE = "/assets/logo-icon.svg";

/** localStorage key of the Matrix session (`matrixStorageKey` in the Hub). */
export const matrixSessionKey = (identity: TestIdentity): string =>
  `matrixUser:${identity.email}:${CHAT_ACCOUNT_ID}`;

/** Signs in to the Hub backend through the e2e bypass (no Keycloak). */
export const signInToHubBackend = async (
  context: BrowserContext,
  identity: TestIdentity,
): Promise<void> => {
  const response = await context.request.post(`${HUB_API_URL}/e2e/user-auth/`, {
    data: { email: identity.email },
  });
  if (!response.ok()) {
    throw new Error(
      `E2E sign-in failed (${response.status()}). Is the e2e backend up (make run-backend-e2e)?`,
    );
  }
};

/**
 * Stores a Matrix session in the Hub origin, as the Hub does after its MAS
 * sign-in, so Keycloak and MAS are skipped: the session is a device signed in
 * with a compatibility token. Written once, from a static page, so the app
 * owns it afterwards and a test sees what the app does with it.
 */
export const storeMatrixSession = async (
  page: Page,
  identity: TestIdentity,
  device: MatrixCredentials,
): Promise<void> => {
  await page.goto(STATIC_HUB_PAGE);
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    {
      key: matrixSessionKey(identity),
      value: JSON.stringify({
        homeserverUrl: HOMESERVER_URL,
        mxId: device.userId,
        deviceId: device.deviceId,
        accessToken: device.accessToken,
      }),
    },
  );
};

type StoredMatrixSession = {
  mxId: string;
  deviceId?: string;
  accessToken: string;
  refreshToken?: string;
};

/** The Matrix session the Hub keeps for `identity`, or null. */
export const readMatrixSession = async (
  page: Page,
  identity: TestIdentity,
): Promise<StoredMatrixSession | null> => {
  const raw = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    matrixSessionKey(identity),
  );
  return raw ? (JSON.parse(raw) as StoredMatrixSession) : null;
};

/** Records every request a page sends to MAS, to prove none happened. */
export const watchMasRequests = (page: Page): string[] => {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(MAS_URL)) urls.push(request.url());
  });
  return urls;
};
