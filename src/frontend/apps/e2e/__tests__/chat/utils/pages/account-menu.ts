import { expect, Locator, Page } from "@playwright/test";

/** The avatar menu at the bottom of the side panel. */
export class AccountMenu {
  readonly trigger: Locator;
  readonly menu: Locator;

  constructor(readonly page: Page) {
    this.trigger = page.getByRole("button", { name: "Account menu" });
    this.menu = page.getByRole("menu", { name: "Account menu" });
  }

  async choose(item: "Encryption" | "Logout"): Promise<void> {
    await this.trigger.click();
    await this.menu.getByRole("menuitem", { name: item }).click();
  }

  /** Logs out of the Hub, which leads back to the home page. */
  async logout(): Promise<void> {
    await this.choose("Logout");
    await expect(this.page).toHaveURL(/\/home$/, { timeout: 30_000 });
  }
}
