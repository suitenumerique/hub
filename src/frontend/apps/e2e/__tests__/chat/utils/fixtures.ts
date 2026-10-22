import {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  test as base,
} from "@playwright/test";

import { ChatPage } from "./pages/chat-page";
import { CryptoDevice } from "./crypto-device";
import { CHAT_TEST_TIMEOUT } from "./env";
import {
  issueDevice,
  newIdentity,
  registerIdentity,
  registerKeycloakOnly,
  type TestIdentity,
} from "./matrix-admin";
import { MatrixApi } from "./matrix-api";
import { signInToHubBackend, storeMatrixSession } from "./hub-session";

/**
 * One person of a test. `api` is a device of their own driven without a
 * browser: what they do "elsewhere", or everything when they have no Hub open.
 */
export type Person = TestIdentity & { api: MatrixApi };

export type OpenHubOptions = {
  /** Reuse a browser (a shared computer) instead of a fresh one. */
  context?: BrowserContext;
  /** First page to open. */
  path?: string;
};

type ChatFixtures = {
  /** Creates people with their own Matrix and Hub accounts. */
  people: {
    create: (name: string) => Promise<Person>;
    /** Someone known to Keycloak only: MAS creates them at first sign-in. */
    createNewcomer: (name: string) => Promise<TestIdentity>;
  };
  /** Opens the Hub, signed in, in a browser of its own. */
  hub: {
    open: (person: Person, options?: OpenHubOptions) => Promise<ChatPage>;
  };
  /** Starts a headless, encryption-capable device of a person. */
  devices: {
    /** Signed in, with cross-signing and key backup set up. */
    start: (person: Person) => Promise<CryptoDevice>;
  };
};

const contextFactory =
  (
    browser: Browser,
    options: BrowserContextOptions,
    contexts: BrowserContext[],
  ) =>
  async () => {
    const context = await browser.newContext(options);
    contexts.push(context);
    return context;
  };

/**
 * Chat test with the local Matrix stack. Every test creates its own people, so
 * tests never share conversations and no homeserver reset is needed.
 */
export const test = base.extend<ChatFixtures & { chatTimeout: void }>({
  chatTimeout: [
    async ({}, use, testInfo) => {
      testInfo.setTimeout(CHAT_TEST_TIMEOUT);
      await use();
    },
    { auto: true },
  ],

  people: async ({}, use) => {
    await use({
      create: async (name) => {
        const identity = newIdentity(name);
        await registerIdentity(identity);
        const api = new MatrixApi(await issueDevice(identity));
        return { ...identity, api };
      },
      createNewcomer: async (name) => {
        const identity = newIdentity(name);
        await registerKeycloakOnly(identity);
        return identity;
      },
    });
  },

  hub: async (
    { browser, baseURL, locale, timezoneId, viewport, contextOptions },
    use,
  ) => {
    const contexts: BrowserContext[] = [];
    // Same options as the default `context` of the project.
    const createContext = contextFactory(
      browser,
      { ...contextOptions, baseURL, locale, timezoneId, viewport },
      contexts,
    );
    await use({
      open: async (person, { context, path = "/chat/new" } = {}) => {
        const browserContext = context ?? (await createContext());
        await signInToHubBackend(browserContext, person);
        const page = await browserContext.newPage();
        await storeMatrixSession(page, person, await issueDevice(person));
        const chat = new ChatPage(page, person);
        await chat.goto(path);
        return chat;
      },
    });
    await Promise.all(contexts.map((context) => context.close()));
  },

  devices: async ({}, use) => {
    const started: CryptoDevice[] = [];
    await use({
      start: async (person) => {
        const device = await CryptoDevice.start(person);
        started.push(device);
        await device.setUpEncryption();
        return device;
      },
    });
    started.forEach((device) => device.stop());
  },
});

export { expect } from "@playwright/test";
