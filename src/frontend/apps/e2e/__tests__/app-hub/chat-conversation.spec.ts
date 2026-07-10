import { expect, test } from "@playwright/test";

import { setupAuthenticatedUser } from "./utils-auth";
import {
  getChatBubbles,
  getChatComposerAttachButton,
  getChatComposerInput,
  getChatComposerSendButton,
  getChatHeader,
  getChatMembersDialog,
  getHeaderChatNameButton,
  getHeaderChatMenuItem,
  getHeaderFilesButton,
  getHeaderStartMeetingButton,
  getHeaderThreadsButton,
} from "./utils-chat-conversation";
import {
  expectLeftPanelVisible,
  getChatLink,
  getChatScopeSelector,
  getChatSection,
  waitForChatUrl,
} from "./utils-left-panel";

const FIRST_CHAT = {
  id: "a3f1b2c0-1d2e-4f5a-9c8b-7d6e5f4a3b2c",
  name: "Didier Salambo",
};

const FAVOURITE_GROUP_CHAT = {
  id: "b4e2c3d1-2e3f-4a5b-8c9d-6e7f8a9b0c1d",
  name: "Working group",
};

test.describe("Chat conversation view", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto("/chat/new");
    await expectLeftPanelVisible(page);

    await getChatLink(page, FIRST_CHAT.name).click();
    await waitForChatUrl(page, FIRST_CHAT.id);
  });

  test("header is visible and displays the chat name", async ({ page }) => {
    await expect(getChatHeader(page)).toBeVisible();
    await expect(getHeaderChatNameButton(page, FIRST_CHAT.name)).toBeVisible();
  });

  test("header exposes the three right-side action buttons", async ({
    page,
  }) => {
    await expect(getHeaderStartMeetingButton(page)).toBeVisible();
    await expect(getHeaderStartMeetingButton(page)).toBeEnabled();
    await expect(getHeaderThreadsButton(page)).toBeVisible();
    await expect(getHeaderThreadsButton(page)).toBeEnabled();
    await expect(getHeaderFilesButton(page)).toBeVisible();
    await expect(getHeaderFilesButton(page)).toBeEnabled();
  });

  test("header menu opens the read-only members modal", async ({ page }) => {
    await getHeaderChatNameButton(page, FIRST_CHAT.name).click();

    await expect(getHeaderChatMenuItem(page, "Members")).toBeEnabled();
    await expect(
      getHeaderChatMenuItem(page, "Remove from favourites"),
    ).toBeEnabled();
    await expect(
      getHeaderChatMenuItem(page, "Rename conversation"),
    ).toBeDisabled();
    await expect(getHeaderChatMenuItem(page, "Notifications")).toBeDisabled();
    await expect(
      getHeaderChatMenuItem(page, "Leave conversation"),
    ).toBeDisabled();

    await getHeaderChatMenuItem(page, "Members").click();

    const dialog = getChatMembersDialog(page);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Chat members", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("You", { exact: true })).toBeVisible();
    await expect(
      dialog.getByText("Didier Salambo", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Remove access" }),
    ).toHaveCount(0);
    await expect(dialog.getByText("Turn into group")).toHaveCount(0);
  });

  test("members modal separates pending invitations", async ({ page }) => {
    await getChatLink(page, FAVOURITE_GROUP_CHAT.name).click();
    await waitForChatUrl(page, FAVOURITE_GROUP_CHAT.id);
    await getHeaderChatNameButton(page, FAVOURITE_GROUP_CHAT.name).click();
    await getHeaderChatMenuItem(page, "Members").click();

    const dialog = getChatMembersDialog(page);
    await expect(dialog.getByText("Pending invitations")).toBeVisible();
    await expect(dialog.getByText("Ops", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Shared between 3 people")).toBeVisible();
  });

  test("favourites stay exclusive and their section follows its contents", async ({
    page,
  }) => {
    await getChatScopeSelector(page).selectOption("mock-hub");

    const favourites = getChatSection(page, "Favourites");
    const allChats = getChatSection(page, "All chats");

    await expect(
      favourites.getByRole("link", { name: FIRST_CHAT.name, exact: true }),
    ).toBeVisible();
    await expect(
      allChats.getByRole("link", { name: FIRST_CHAT.name, exact: true }),
    ).toHaveCount(0);

    await getHeaderChatNameButton(page, FIRST_CHAT.name).click();
    await getHeaderChatMenuItem(page, "Remove from favourites").click();

    await expect(
      getChatSection(page, "Favourites").getByRole("link", {
        name: FIRST_CHAT.name,
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      getChatSection(page, "All chats").getByRole("link", {
        name: FIRST_CHAT.name,
        exact: true,
      }),
    ).toBeVisible();

    await getChatSection(page, "Favourites")
      .getByRole("link", {
        name: FAVOURITE_GROUP_CHAT.name,
        exact: true,
      })
      .click();
    await waitForChatUrl(page, FAVOURITE_GROUP_CHAT.id);
    await getHeaderChatNameButton(page, FAVOURITE_GROUP_CHAT.name).click();
    await getHeaderChatMenuItem(page, "Remove from favourites").click();

    await expect(getChatSection(page, "Favourites")).toHaveCount(0);

    await getHeaderChatNameButton(page, FAVOURITE_GROUP_CHAT.name).click();
    await getHeaderChatMenuItem(page, "Add to favourites").click();

    await expect(getChatSection(page, "Favourites")).toBeVisible();
    await expect(
      getChatSection(page, "Favourites").getByRole("link", {
        name: FAVOURITE_GROUP_CHAT.name,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      getChatSection(page, "All chats").getByRole("link", {
        name: FAVOURITE_GROUP_CHAT.name,
        exact: true,
      }),
    ).toHaveCount(0);
  });

  test("at least one message bubble is rendered", async ({ page }) => {
    await expect(getChatBubbles(page).first()).toBeVisible();
  });

  test("composer renders input, attach and send controls", async ({ page }) => {
    await expect(getChatComposerInput(page)).toBeVisible();
    await expect(getChatComposerInput(page)).toBeEditable();
    await expect(getChatComposerAttachButton(page)).toBeVisible();
    await expect(getChatComposerSendButton(page)).toBeVisible();
  });
});
