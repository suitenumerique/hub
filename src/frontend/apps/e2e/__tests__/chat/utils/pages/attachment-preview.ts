import { expect, Locator, Page } from "@playwright/test";

/**
 * Full-screen preview of a file. Its header buttons are named after their
 * icons ("file_download", "info_outline", "close").
 */
export class AttachmentPreview {
  readonly root: Locator;
  readonly title: Locator;
  readonly details: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByTestId("file-preview");
    this.title = this.root.locator("h1.file-preview__title");
    this.details = page.locator("section.hub__attachment-details");
  }

  async expectOpen(title: string): Promise<void> {
    await expect(this.title).toHaveText(title, { timeout: 15_000 });
  }

  /** A value of "File details": "Name", "Type", "Size", "Sent by"… */
  async detail(label: string): Promise<Locator> {
    if (!(await this.details.isVisible())) {
      await this.root.getByRole("button", { name: "info_outline" }).click();
    }
    await expect(
      this.details.getByRole("heading", { name: "File details" }),
    ).toBeVisible();
    return this.details
      .locator("dl > div")
      .filter({ has: this.page.locator("dt", { hasText: label }) })
      .locator("dd");
  }

  async download() {
    const download = this.page.waitForEvent("download");
    await this.root
      .getByRole("button", { name: "file_download", exact: true })
      .click();
    return download;
  }

  async close(): Promise<void> {
    await this.root.getByRole("button", { name: "close", exact: true }).click();
    await expect(this.root).toBeHidden();
  }
}
