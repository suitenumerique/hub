import { expect, Locator, Page } from "@playwright/test";

/** "Chat connection interrupted": the screen shown when the chat cannot start. */
export class ConnectionError {
  readonly root: Locator;
  readonly message: Locator;
  readonly tryAgainButton: Locator;
  readonly reconnectButton: Locator;
  readonly logOutButton: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator("main.hub__connection-error");
    this.message = this.root.getByRole("alert");
    this.tryAgainButton = this.root.getByRole("button", { name: "Try again" });
    this.reconnectButton = this.root.getByRole("button", {
      name: "Reconnect LaSuite Tchap v2 with a new device",
    });
    this.logOutButton = this.root.getByRole("button", { name: "Log out" });
  }

  async expectShown(message: string): Promise<void> {
    await expect(
      this.root.getByRole("heading", { name: "Chat connection interrupted" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(this.message).toHaveText(message);
  }
}

export const ANOTHER_TAB_MESSAGE =
  "Another LaSuite Tchap v2 tab is using this session. Close that tab, then try again here. You can keep Tchap open.";

export const STORAGE_CLOSED_MESSAGE =
  "The browser closed the chat’s storage, for example to free up disk space. Try again to reload the chat. If this happens again, free up space on your computer.";

export const LOST_KEYS_MESSAGE =
  "This device’s local keys are missing or no longer match its session. Stored data has not been deleted. A new device session is required.";
