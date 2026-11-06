import { expect, Locator, Page } from "@playwright/test";

/** "Cannot connect to Tchap": the screen shown when the chat cannot start. */
export class ConnectionError {
  readonly root: Locator;
  readonly message: Locator;
  readonly tryAgainButton: Locator;
  readonly logOutButton: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator("main.hub__connection-error");
    this.message = this.root.getByRole("alert");
    this.tryAgainButton = this.root.getByRole("button", { name: "Try again" });
    this.logOutButton = this.root.getByRole("button", { name: "Log out" });
  }

  async expectShown(message: string): Promise<void> {
    await expect(
      this.root.getByRole("heading", { name: "Cannot connect to Tchap" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(this.message).toHaveText(message);
  }
}

export const ANOTHER_TAB_MESSAGE =
  "LaSuite Tchap is already open in another tab. Close that tab, then try again here. Your other Tchap apps can stay open.";
