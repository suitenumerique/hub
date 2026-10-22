import { expect, Locator, Page } from "@playwright/test";

import { SYNC_TIMEOUT } from "../env";
import { startingWith } from "../text";

type Someone = { displayName: string; userId: string };

/** The people search of "New": who the new conversation is with. */
export class NewChat {
  readonly root: Locator;
  readonly input: Locator;
  readonly results: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByLabel("New chat search", { exact: true });
    this.input = this.root.getByRole("combobox", { name: "Search users" });
    this.results = page.getByRole("listbox");
  }

  async expectOpen(): Promise<void> {
    await expect(this.page).toHaveURL(/\/chat\/new$/);
    await expect(this.input).toBeVisible();
  }

  /** Searches someone by display name and adds them to the selection. */
  async add(person: Someone): Promise<void> {
    await this.input.fill(person.displayName);
    const option = this.results.getByRole("option", {
      name: startingWith(person.displayName),
    });
    await expect(option).toBeVisible({ timeout: SYNC_TIMEOUT });
    await option.click();
    await expect(this.selected(person)).toBeVisible();
  }

  /** Chip of a selected person. */
  selected(person: Someone): Locator {
    return this.root.getByRole("button", {
      name: `Remove ${person.displayName}`,
    });
  }

  /** Enter with an empty query confirms the selection. */
  async confirm(): Promise<void> {
    await this.input.press("Enter");
  }
}
