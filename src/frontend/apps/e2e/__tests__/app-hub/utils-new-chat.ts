import { Locator, Page } from "@playwright/test";

export const getNewChatSearchInput = (page: Page): Locator =>
  page.getByRole("combobox", { name: "Search users" });

export const getNewChatUserOption = (page: Page, name: string): Locator =>
  page.getByRole("option", { name });

export const getCreateGroupButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Create group" });

export const getSelectedUserChip = (page: Page, name: string): Locator =>
  page.locator(".hub__new-chat-search__chip", { hasText: name });

export const getRemoveSelectedUserButton = (
  page: Page,
  name: string,
): Locator => page.getByRole("button", { name: `Remove ${name}` });
