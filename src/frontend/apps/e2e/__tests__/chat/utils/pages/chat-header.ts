import { expect, Locator, Page } from "@playwright/test";

import { SYNC_TIMEOUT } from "../env";

/** Header of the open conversation, with its menu and tool toggles. */
export class ChatHeader {
  readonly root: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator(".hub__chat-header");
  }

  /** The conversation name, which also opens the conversation menu. */
  title(name: string): Locator {
    return this.root.getByRole("button", { name, exact: true });
  }

  async expectTitle(name: string): Promise<void> {
    await expect(this.title(name)).toBeVisible({ timeout: SYNC_TIMEOUT });
  }

  async openMenu(name: string): Promise<Locator> {
    await this.title(name).click();
    const menu = this.page.getByRole("menu");
    await expect(menu).toBeVisible();
    return menu;
  }

  /** Leaves through the menu and its confirmation dialog. */
  async leave(name: string): Promise<void> {
    const menu = await this.openMenu(name);
    await menu.getByRole("menuitem", { name: "Leave conversation" }).click();
    const dialog = this.page.getByRole("dialog", {
      name: "Leave conversation?",
    });
    await dialog.getByRole("button", { name: "Leave conversation" }).click();
    await expect(dialog).toBeHidden({ timeout: SYNC_TIMEOUT });
  }
}
