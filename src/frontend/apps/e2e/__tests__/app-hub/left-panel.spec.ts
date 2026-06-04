import { expect, test } from "@playwright/test";

import { setupAuthenticatedUser } from "./utils-auth";
import {
  chatPath,
  expectLeftPanelVisible,
  getActiveChatLink,
  getChatLink,
  getChatScopeSelector,
  getNewChatAction,
  getSearchAction,
  getStartMeetingAction,
  waitForChatUrl,
} from "./utils-left-panel";

const FIRST_CHAT = {
  id: "a3f1b2c0-1d2e-4f5a-9c8b-7d6e5f4a3b2c",
  name: "Didier Salambo",
};

const SECOND_CHAT = {
  id: "c5d3e4f2-3f4a-4b5c-9d0e-7f8a9b0c1d2e",
  name: "Anabelle Dupontel",
};

test.describe("LeftPanel quick actions", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto("/chat/new");
    await expectLeftPanelVisible(page);
  });

  test('"New" link navigates to /chat/new and renders the placeholder', async ({
    page,
  }) => {
    const newAction = getNewChatAction(page);
    await expect(newAction).toBeVisible();
    await expect(newAction).toHaveAttribute("href", "/chat/new");

    await newAction.click();

    await page.waitForURL("**/chat/new");
    await expect(page.getByRole("heading", { name: "New chat" })).toBeVisible();
  });

  test('"Start a meeting" button is visible and does not navigate', async ({
    page,
  }) => {
    const action = getStartMeetingAction(page);
    await expect(action).toBeVisible();
    await expect(action).toBeEnabled();

    const urlBefore = page.url();
    await action.click();
    expect(page.url()).toBe(urlBefore);
  });

  test('"Search" button is visible and does not navigate', async ({ page }) => {
    const action = getSearchAction(page);
    await expect(action).toBeVisible();
    await expect(action).toBeEnabled();

    const urlBefore = page.url();
    await action.click();
    expect(page.url()).toBe(urlBefore);
  });
});

test.describe("Chat navigation from the LeftPanel", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto("/chat/new");
    await expectLeftPanelVisible(page);
  });

  test("clicking a chat updates the URL and marks the row active", async ({
    page,
  }) => {
    await getChatLink(page, FIRST_CHAT.name).click();

    await waitForChatUrl(page, FIRST_CHAT.id);
    await expect(getActiveChatLink(page)).toHaveCount(1);
    await expect(getActiveChatLink(page)).toHaveAttribute(
      "href",
      chatPath(FIRST_CHAT.id),
    );
  });

  test("switching between two chats updates the active row", async ({
    page,
  }) => {
    await getChatLink(page, FIRST_CHAT.name).click();
    await waitForChatUrl(page, FIRST_CHAT.id);

    await getChatLink(page, SECOND_CHAT.name).click();
    await waitForChatUrl(page, SECOND_CHAT.id);

    await expect(getActiveChatLink(page)).toHaveCount(1);
    await expect(getActiveChatLink(page)).toHaveAttribute(
      "href",
      chatPath(SECOND_CHAT.id),
    );
  });
});

test.describe("Chat scope selection from the LeftPanel", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto("/chat/new");
    await expectLeftPanelVisible(page);
  });

  test("defaults to the aggregate scope and shows chats from both mock servers", async ({
    page,
  }) => {
    await expect(getChatScopeSelector(page)).toHaveValue("mock-aggregate");
    await expect(getChatLink(page, FIRST_CHAT.name, "Hub")).toBeVisible();
    await expect(
      getChatLink(page, `${FIRST_CHAT.name} (Support)`, "Support"),
    ).toBeVisible();
  });

  test("switching to the Hub scope shows only Hub chats", async ({ page }) => {
    await getChatScopeSelector(page).selectOption("mock-hub");

    await expect(getChatScopeSelector(page)).toHaveValue("mock-hub");
    await expect(getChatLink(page, FIRST_CHAT.name, null)).toBeVisible();
    await expect(
      getChatLink(page, `${FIRST_CHAT.name} (Support)`, "Support"),
    ).toHaveCount(0);
  });

  test("switching to the Support scope shows only Support chats", async ({
    page,
  }) => {
    await getChatScopeSelector(page).selectOption("mock-support");

    await expect(getChatScopeSelector(page)).toHaveValue("mock-support");
    await expect(
      getChatLink(page, `${FIRST_CHAT.name} (Support)`, null),
    ).toBeVisible();
    await expect(getChatLink(page, FIRST_CHAT.name, "Hub")).toHaveCount(0);
  });

  test("switching away from the active account returns to the new chat page", async ({
    page,
  }) => {
    await getChatLink(page, `${FIRST_CHAT.name} (Support)`, "Support").click();
    await waitForChatUrl(page, FIRST_CHAT.id, "mock-support");

    await getChatScopeSelector(page).selectOption("mock-hub");

    await page.waitForURL("**/chat/new");
    await expect(page.getByRole("heading", { name: "New chat" })).toBeVisible();
    await expect(getChatScopeSelector(page)).toHaveValue("mock-hub");
  });
});
