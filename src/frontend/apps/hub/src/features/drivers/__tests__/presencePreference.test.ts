// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  readChatSelfPresencePreference,
  writeChatSelfPresencePreference,
} from "../presencePreference";

describe("chat self-presence preference persistence", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to automatic online mode", () => {
    expect(readChatSelfPresencePreference("account-a")).toBe("online");
  });

  it.each(["online", "offline"] as const)("persists %s", (preference) => {
    writeChatSelfPresencePreference("account-a", preference);
    expect(readChatSelfPresencePreference("account-a")).toBe(preference);
  });

  it("isolates accounts", () => {
    writeChatSelfPresencePreference("account-a", "online");
    writeChatSelfPresencePreference("account-b", "offline");

    expect(readChatSelfPresencePreference("account-a")).toBe("online");
    expect(readChatSelfPresencePreference("account-b")).toBe("offline");
  });
});
