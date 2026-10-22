import { expect, Locator, Page } from "@playwright/test";

/** "Chat connection interrupted": the screen shown when the chat cannot start. */
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
      this.root.getByRole("heading", { name: "Chat connection interrupted" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(this.message).toHaveText(message);
  }
}

export const ANOTHER_TAB_MESSAGE =
  "Another Hub tab is using this session. Close that tab, then try again here. You can keep Element open.";
