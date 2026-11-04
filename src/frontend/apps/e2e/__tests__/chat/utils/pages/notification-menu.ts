import { expect, Locator, Page } from "@playwright/test";

const LEVEL_ROW = "hub-chat-notification-level";

/** The "Notifications" entry of a conversation menu and its levels. */
export class NotificationMenu {
  constructor(readonly page: Page) {}

  entry(menu: Locator): Locator {
    return menu.getByRole("menuitem", { name: "Notifications" });
  }

  /** Opens the levels from an open conversation menu. */
  async openLevels(menu: Locator): Promise<void> {
    await this.entry(menu).click();
    await expect(this.levels().first()).toBeVisible();
  }

  levels(): Locator {
    return this.page.getByTestId(LEVEL_ROW);
  }

  /** The levels shown, in order, and the one that is checked. */
  async expectLevels(labels: string[], current: string): Promise<void> {
    await expect(
      this.levels().locator(".c__dropdown-menu-item__label"),
    ).toHaveText(labels);
    for (const label of labels) {
      await expect(
        this.level(label).locator(".c__dropdown-menu-item__check"),
      ).toHaveCount(label === current ? 1 : 0);
    }
  }

  level(label: string): Locator {
    return this.levels().filter({
      has: this.page.getByText(label, { exact: true }),
    });
  }

  async choose(label: string): Promise<void> {
    await this.level(label).click();
    await expect(this.levels()).toHaveCount(0);
  }

  /** Closes the levels and the menu without choosing. */
  async close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.page.keyboard.press("Escape");
    await expect(this.levels()).toHaveCount(0);
  }
}
