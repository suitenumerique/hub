import { BrowserContext, expect, Page } from "@playwright/test";

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

/**
 * Waits until the homeserver publishes the keys of the Hub's device, which is
 * what tells a later load that the device lost its own. Returns its id.
 */
export const waitForPublishedDeviceKeys = async (
  page: Page,
  identity: TestIdentity,
): Promise<string> => {
  const session = await readMatrixSession(page, identity);
  const deviceId = session?.deviceId;
  if (!session || !deviceId) {
    throw new Error("The Hub keeps no Matrix device for this person.");
  }
  await expect
    .poll(async () => {
      const response = await page.request.post(
        `${HOMESERVER_URL}/_matrix/client/v3/keys/query`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
          data: { device_keys: { [session.mxId]: [] } },
        },
      );
      const { device_keys: keys } = (await response.json()) as {
        device_keys: Record<string, Record<string, unknown>>;
      };
      return Boolean(keys[session.mxId]?.[deviceId]);
    })
    .toBe(true);
  return deviceId;
};

/**
 * Deletes the IndexedDB of the Hub under the open page, as Chrome does to a
 * site when free disk space runs low: the connections close, localStorage
 * stays (#153). Chromium only.
 */
export const deleteHubDatabases = async (page: Page): Promise<void> => {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("Storage.clearDataForOrigin", {
    origin: new URL(page.url()).origin,
    storageTypes: "indexeddb",
  });
  await devtools.detach();
};

/** Records every request a page sends to MAS, to prove none happened. */
export const watchMasRequests = (page: Page): string[] => {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(MAS_URL)) urls.push(request.url());
  });
  return urls;
};
