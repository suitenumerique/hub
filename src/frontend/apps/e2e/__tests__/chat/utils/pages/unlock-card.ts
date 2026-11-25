import { expect, Locator, Page } from "@playwright/test";

import { SYNC_TIMEOUT } from "../env";

/**
 * The card that unlocks the messages of a device that is not verified, in place
 * of the home page and of the encrypted conversations.
 */
export class UnlockCard {
  readonly card: Locator;
  readonly emojis: Locator;

  constructor(readonly page: Page) {
    this.card = page.locator(".hub__message-unlock");
    this.emojis = this.card.getByRole("list", {
      name: "The seven verification symbols",
    });
  }

  /** The screen shown, by its title. */
  async expectScreen(title: string): Promise<void> {
    await expect(this.card.getByRole("heading", { level: 1 })).toHaveText(
      title,
      { timeout: SYNC_TIMEOUT },
    );
  }

  async expectHidden(): Promise<void> {
    await expect(this.card).toBeHidden({ timeout: SYNC_TIMEOUT });
  }

  async expectText(text: string | RegExp): Promise<void> {
    await expect(this.card).toContainText(text, { timeout: SYNC_TIMEOUT });
  }

  /** Asks the person's other devices to show the emojis. */
  async compareWithPhone(): Promise<void> {
    await this.button("Compare with my phone").click();
  }

  /** The 7 emojis shown by the Hub, in display order. */
  async shownEmojis(): Promise<string[]> {
    const symbols = this.emojis.locator('li > span[aria-hidden="true"]');
    await expect(symbols).toHaveCount(7, { timeout: SYNC_TIMEOUT });
    return symbols.allTextContents();
  }

  async theyMatch(): Promise<void> {
    await this.button("They match").click();
  }

  async theyDoNotMatch(): Promise<void> {
    await this.button("They do not match").click();
  }

  async startAgain(): Promise<void> {
    await this.button("Start again").click();
  }

  private button(name: string): Locator {
    return this.card.getByRole("button", { name, exact: true });
  }
}
