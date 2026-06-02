import { Locator, Page, expect } from "@playwright/test";

export const getLeftPanel = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Side panel" });

export const getNewChatAction = (page: Page): Locator =>
  getLeftPanel(page).getByRole("link", { name: "New" });

export const getStartMeetingAction = (page: Page): Locator =>
  getLeftPanel(page).getByRole("button", { name: "Start a meeting" });

export const getSearchAction = (page: Page): Locator =>
  getLeftPanel(page).getByRole("button", { name: "Search" });

export const getChatLink = (page: Page, name: string): Locator =>
  getLeftPanel(page).getByRole("link", { name });

export const getActiveChatLink = (page: Page): Locator =>
  getLeftPanel(page).locator('[aria-current="page"]');

export const expectLeftPanelVisible = async (page: Page) => {
  await expect(getLeftPanel(page)).toBeVisible();
};
