import { Locator, Page, expect } from "@playwright/test";

export const DEFAULT_CHAT_ACCOUNT_ID = "mock-main";

export const getLeftPanel = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Side panel" });

export const getNewChatAction = (page: Page): Locator =>
  getLeftPanel(page).getByRole("link", { name: "New" });

export const getStartMeetingAction = (page: Page): Locator =>
  getLeftPanel(page).getByRole("button", { name: "Start a meeting" });

export const getSearchAction = (page: Page): Locator =>
  getLeftPanel(page).getByRole("button", { name: "Search" });

export const getChatScopeSelector = (page: Page): Locator =>
  getLeftPanel(page).getByLabel("Chat scope");

export const getChatLink = (
  page: Page,
  name: string,
  accountLabel: string | null = "Hub",
): Locator =>
  getLeftPanel(page).getByRole("link", {
    name: accountLabel ? `${name} ${accountLabel}` : name,
    exact: true,
  });

export const getActiveChatLink = (page: Page): Locator =>
  getLeftPanel(page).locator('[aria-current="page"]');

export const expectLeftPanelVisible = async (page: Page) => {
  await expect(getLeftPanel(page)).toBeVisible();
};

export const chatPath = (
  chatId: string,
  accountId: string = DEFAULT_CHAT_ACCOUNT_ID,
): string =>
  `/chat?account=${encodeURIComponent(accountId)}&chat=${encodeURIComponent(
    chatId,
  )}`;

export const waitForChatUrl = async (
  page: Page,
  chatId: string,
  accountId: string = DEFAULT_CHAT_ACCOUNT_ID,
) => {
  await page.waitForURL((url) => {
    return (
      url.pathname === "/chat" &&
      url.searchParams.get("account") === accountId &&
      url.searchParams.get("chat") === chatId
    );
  });
};
