import { expect, Locator, Page } from "@playwright/test";

import { SYNC_TIMEOUT } from "../env";

/**
 * The "Encryption" tab of the "Settings" dialog: device trust, key backup and
 * verification.
 */
export class EncryptionDialog {
  readonly dialog: Locator;
  readonly panel: Locator;
  readonly thisDevice: Locator;
  readonly backup: Locator;
  readonly verifyButton: Locator;
  readonly emojis: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole("dialog", { name: "Settings" });
    this.panel = this.dialog.getByRole("tabpanel", { name: "Encryption" });
    this.thisDevice = this.panel.getByRole("region", { name: "This device" });
    this.backup = this.panel.getByRole("region", {
      name: "Backup and history",
    });
    this.verifyButton = this.panel.getByRole("button", {
      name: "Verify this device",
    });
    this.emojis = this.panel.getByRole("list", {
      name: "The seven verification symbols",
    });
  }

  /** The badge of a section: "Verified", "Active", "Verification required"… */
  badge(section: Locator): Locator {
    return section.locator(".c__badge");
  }

  async expectDeviceStatus(status: string): Promise<void> {
    await expect(this.badge(this.thisDevice)).toHaveText(status, {
      timeout: SYNC_TIMEOUT,
    });
  }

  async expectBackupStatus(status: string): Promise<void> {
    await expect(this.badge(this.backup)).toHaveText(status, {
      timeout: 30_000,
    });
  }

  /** Starts "Verify this device" and waits for the emojis to compare. */
  async startVerification(): Promise<void> {
    await expect(this.verifyButton).toBeVisible({ timeout: SYNC_TIMEOUT });
    await this.verifyButton.click();
  }

  /** The 7 emojis shown by the Hub, in display order. */
  async shownEmojis(): Promise<string[]> {
    const symbols = this.emojis.locator('li > span[aria-hidden="true"]');
    await expect(symbols).toHaveCount(7, { timeout: SYNC_TIMEOUT });
    return symbols.allTextContents();
  }

  async theyMatch(): Promise<void> {
    await this.panel.getByRole("button", { name: "They match" }).click();
  }

  async theyDoNotMatch(): Promise<void> {
    await this.panel.getByRole("button", { name: "They do not match" }).click();
  }

  async expectText(text: string | RegExp): Promise<void> {
    await expect(this.panel).toContainText(text, { timeout: SYNC_TIMEOUT });
  }

  /** "Device ID" under "Technical details". */
  async deviceId(): Promise<string> {
    const details = this.panel.locator("details.hub__security-technical");
    if (
      !(await details.evaluate((node) => (node as HTMLDetailsElement).open))
    ) {
      await details.locator("summary").click();
    }
    const value = details
      .locator("dl > div")
      .filter({ has: this.page.locator("dt", { hasText: /^Device ID$/ }) })
      .locator("dd");
    await expect(value).not.toHaveText("—");
    return (await value.textContent())!.trim();
  }

  async close(): Promise<void> {
    await this.dialog
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(this.dialog).toBeHidden();
  }
}
