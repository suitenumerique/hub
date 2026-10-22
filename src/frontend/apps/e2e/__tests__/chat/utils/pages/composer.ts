import { expect, Locator } from "@playwright/test";

import type { TestFile } from "../files";
import { startingWith } from "../text";

export const BLOCKED_PLACEHOLDER =
  "Verify encryption before sending a message.";

/**
 * A message composer: the conversation one ("Message") or a thread one
 * ("Answer"), scoped to its own region of the page.
 */
export class Composer {
  readonly field: Locator;
  readonly sendButton: Locator;
  readonly fileInput: Locator;
  readonly attachments: Locator;
  readonly editingStatus: Locator;
  readonly mentionSuggestions: Locator;

  constructor(
    readonly scope: Locator,
    fieldName: "Message" | "Answer" = "Message",
  ) {
    this.field = scope.getByRole("textbox", { name: fieldName });
    const form = scope.locator(".hub__chat-composer");
    this.sendButton = form.getByRole("button", { name: "Send message" });
    this.fileInput = form.locator('input[type="file"]');
    this.attachments = scope.getByRole("list", { name: "Attached files" });
    this.editingStatus = scope.getByRole("status").filter({
      hasText: "Editing message",
    });
    this.mentionSuggestions = scope.page().getByRole("listbox", {
      name: "Mention suggestions",
    });
  }

  /**
   * Types and sends with Enter, then checks the field is empty again. The
   * field is read-only while the previous message is being sent.
   */
  async send(text: string): Promise<void> {
    await expect(this.field).not.toHaveAttribute("aria-busy", "true", {
      timeout: 15_000,
    });
    await this.field.fill(text);
    await expect(this.field).toBeEditable();
    await this.field.press("Enter");
    await expect(this.field).toHaveValue("");
  }

  /** Types key by key, as a person would (typing notifications). */
  async type(text: string): Promise<void> {
    await this.field.click();
    await this.field.pressSequentially(text, { delay: 30 });
  }

  /** Attaches files and waits until every upload is done. */
  async attach(files: TestFile[]): Promise<void> {
    await this.fileInput.setInputFiles(
      files.map(({ name, mimeType, data }) => ({
        name,
        mimeType,
        buffer: data,
      })),
    );
    const items = this.attachments.getByRole("listitem");
    await expect(items).toHaveCount(files.length);
    for (const item of await items.all()) {
      await expect(item).toHaveAttribute("data-status", "ready", {
        timeout: 30_000,
      });
    }
  }

  /** Sends the attached files, with an optional caption. */
  async sendAttachments(caption = ""): Promise<void> {
    if (caption) await this.field.fill(caption);
    await expect(this.sendButton).toBeEnabled();
    await this.sendButton.click();
    await expect(this.attachments).toHaveCount(0);
  }

  /** Types `@query` and picks the suggestion for `displayName`. */
  async mention(query: string, displayName: string): Promise<void> {
    await this.field.click();
    await this.field.pressSequentially(`@${query}`, { delay: 30 });
    const option = this.mentionSuggestions.getByRole("option", {
      name: startingWith(displayName),
    });
    await expect(option).toBeVisible();
    await option.click();
  }

  async expectBlocked(): Promise<void> {
    await expect(this.field).toBeDisabled();
    await expect(this.field).toHaveAttribute(
      "placeholder",
      BLOCKED_PLACEHOLDER,
    );
  }

  async expectUsable(): Promise<void> {
    await expect(this.field).toBeEnabled({ timeout: 30_000 });
    await expect(this.field).not.toHaveAttribute(
      "placeholder",
      BLOCKED_PLACEHOLDER,
    );
  }
}
