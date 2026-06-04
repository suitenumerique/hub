import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHAT_SCOPE_ID,
  DEFAULT_CHAT_SCOPES,
  StandardHubApi,
} from "../HubApi";

describe("StandardHubApi chat scopes", () => {
  it("exposes an aggregate default scope and single-server scopes", async () => {
    const api = new StandardHubApi();

    await expect(api.getChatScopes()).resolves.toEqual(DEFAULT_CHAT_SCOPES);
    expect(DEFAULT_CHAT_SCOPES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeId: DEFAULT_CHAT_SCOPE_ID,
          kind: "aggregate",
          accounts: expect.arrayContaining([
            expect.objectContaining({ accountId: "mock-main" }),
            expect.objectContaining({ accountId: "mock-support" }),
          ]),
        }),
        expect.objectContaining({
          scopeId: "mock-hub",
          kind: "server",
          accounts: [expect.objectContaining({ accountId: "mock-main" })],
        }),
        expect.objectContaining({
          scopeId: "mock-support",
          kind: "server",
          accounts: [
            expect.objectContaining({
              accountId: "mock-support",
              criticality: "required",
            }),
          ],
        }),
      ]),
    );
  });

  it("returns the accounts of the requested scope", async () => {
    const api = new StandardHubApi();

    await expect(api.getChatAccounts()).resolves.toHaveLength(2);
    await expect(api.getChatAccounts("mock-hub")).resolves.toEqual([
      expect.objectContaining({ accountId: "mock-main" }),
    ]);
    await expect(api.getChatAccounts("mock-support")).resolves.toEqual([
      expect.objectContaining({ accountId: "mock-support" }),
    ]);
  });
});
