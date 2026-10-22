import { expect, Locator, Page } from "@playwright/test";

import { SYNC_TIMEOUT } from "../env";

/** "New invitation": shown instead of a conversation not joined yet. */
export class Invitation {
  readonly root: Locator;
  readonly text: Locator;
  readonly acceptButton: Locator;
  readonly dismissButton: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("region", { name: "New invitation" });
    this.text = this.root.locator(".hub__chat-invitation__text");
    this.acceptButton = this.root.getByRole("button", {
      name: "Accept",
      exact: true,
    });
    this.dismissButton = this.root.getByRole("button", {
      name: "Dismiss",
      exact: true,
    });
  }

  async expectFrom(inviterName: string): Promise<void> {
    await expect(this.text).toHaveText(
      `${inviterName} wants to chat with you. Do you accept the invitation?`,
      { timeout: SYNC_TIMEOUT },
    );
  }

  async accept(): Promise<void> {
    await this.acceptButton.click();
    await expect(this.root).toBeHidden({ timeout: SYNC_TIMEOUT });
  }

  async dismiss(): Promise<void> {
    await this.dismissButton.click();
    await expect(this.page).toHaveURL(/\/chat\/new$/, {
      timeout: SYNC_TIMEOUT,
    });
  }
}
