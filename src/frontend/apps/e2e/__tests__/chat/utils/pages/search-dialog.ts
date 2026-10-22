import { expect, Locator, Page } from "@playwright/test";

import { SYNC_TIMEOUT } from "../env";
import { exactly } from "../text";

const INCOMPLETE_PREPARATION =
  /Searching…|No matches yet|Preparation paused|Participants ready|Waiting for conversation details|awaiting retry/;

/** Conversation search, opened from "Search" or with ⌘K / Ctrl+K. */
export class SearchDialog {
  readonly dialog: Locator;
  readonly input: Locator;
  readonly status: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole("dialog", { name: "Search" });
    this.input = this.dialog.getByRole("combobox", { name: "Search chats" });
    this.status = this.dialog.locator(".hub__conversation-search__status");
  }

  async open(): Promise<void> {
    await this.page.keyboard.press("ControlOrMeta+k");
    await expect(this.input).toBeFocused();
  }

  async search(query: string): Promise<void> {
    await this.input.fill(query);
  }

  /** Result rows, each named after its conversation. */
  result(name: string): Locator {
    return this.dialog.locator("[cmdk-item]").filter({
      has: this.page.locator(".hub__conversation-search__name", {
        hasText: exactly(name),
      }),
    });
  }

  async expectResult(name: string): Promise<void> {
    await expect(this.result(name)).toBeVisible({ timeout: SYNC_TIMEOUT });
  }

  async expectNoResult(name: string): Promise<void> {
    await expect(this.result(name)).toHaveCount(0, { timeout: SYNC_TIMEOUT });
  }

  async expectNoChatsFound(): Promise<void> {
    await expect(this.status).toContainText("No chats found.", {
      timeout: SYNC_TIMEOUT,
    });
  }

  /**
   * Waits until the participants of every conversation are prepared: the
   * status then reports no incomplete preparation.
   */
  async expectPreparationComplete(): Promise<void> {
    await expect(this.status).not.toContainText(INCOMPLETE_PREPARATION, {
      timeout: SYNC_TIMEOUT,
    });
  }

  /** Opens a result, which closes the dialog. */
  async openResult(name: string): Promise<void> {
    await this.result(name).click();
    await expect(this.dialog).toBeHidden();
  }

  async close(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.dialog).toBeHidden();
  }
}
