import { expect, Locator, Page } from "@playwright/test";

/** The avatar menu at the bottom of the side panel: the ui-kit `UserMenu`. */
export class AccountMenu {
  readonly trigger: Locator;
  readonly menu: Locator;

  constructor(readonly page: Page) {
    this.trigger = page.getByRole("button", { name: "Open user menu" });
    this.menu = page.getByRole("dialog", { name: "User menu" });
  }

  /** Opens the "Settings" dialog on one of its tabs. */
  async openSettings(tab: "General" | "Encryption"): Promise<void> {
    await this.trigger.click();
    await this.menu.getByRole("button", { name: "App settings" }).click();
    await this.page
      .getByRole("dialog", { name: "Settings" })
      .getByRole("tab", { name: tab })
      .click();
  }

  /** Changes the language of the Hub, by its name in that language. */
  async chooseLanguage(name: string): Promise<void> {
    await this.trigger.click();
    await this.menu.getByRole("button", { name: /^Language:/ }).click();
    await this.page.getByRole("menuitem", { name }).click();
    // The user menu stays open after a language change. Its button is found by
    // class: its name is now in the new language.
    await this.page.keyboard.press("Escape");
    await expect(this.page.locator(".user-menu__button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  }

  /** Logs out of the Hub, which leads back to the home page. */
  async logout(): Promise<void> {
    await this.trigger.click();
    await this.menu.getByRole("button", { name: "Logout" }).click();
    await expect(this.page).toHaveURL(/\/home$/, { timeout: 30_000 });
  }
}
