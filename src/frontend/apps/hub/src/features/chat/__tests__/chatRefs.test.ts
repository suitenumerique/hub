import { describe, expect, it } from "vitest";

import {
  chatHref,
  decorateChat,
  decorateChatSections,
  readChatRef,
  sameChatRef,
} from "../chatRefs";

describe("chatRefs", () => {
  it("decorates a local chat with account identity", () => {
    const chat = decorateChat("account-a", {
      id: "!room:server",
      name: "General",
      section: "all",
      kind: "group",
      participantIds: ["user-a", "user-b"],
      visual: { kind: "initials" },
    });

    expect(chat.accountId).toBe("account-a");
    expect(chat.ref).toEqual({
      accountId: "account-a",
      chatId: "!room:server",
    });
  });

  it("decorates every section", () => {
    const sections = decorateChatSections("account-a", {
      favourites: [
        {
          id: "favourite",
          name: "Favourite",
          section: "favourites",
          kind: "direct",
          participantIds: ["user-fav"],
          visual: { kind: "initials" },
        },
      ],
      all: [
        {
          id: "all",
          name: "All",
          section: "all",
          kind: "group",
          participantIds: ["user-a", "user-b"],
          visual: { kind: "initials" },
        },
      ],
    });

    expect(sections.favourites[0].ref.accountId).toBe("account-a");
    expect(sections.all[0].ref.chatId).toBe("all");
  });

  it("round-trips Matrix-looking ids through query params", () => {
    const ref = { accountId: "matrix-main", chatId: "!abc:def.example" };

    expect(chatHref(ref)).toEqual({
      pathname: "/chat",
      query: {
        account: "matrix-main",
        chat: "!abc:def.example",
      },
    });
    expect(
      readChatRef({
        account: "matrix-main",
        chat: "!abc:def.example",
      }),
    ).toEqual(ref);
  });

  it("compares full refs instead of local chat ids only", () => {
    expect(
      sameChatRef(
        { accountId: "a", chatId: "same" },
        { accountId: "b", chatId: "same" },
      ),
    ).toBe(false);
  });
});
