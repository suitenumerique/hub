import { expect, Locator } from "@playwright/test";

import type { TestFile } from "../files";
import { escapeRegExp, startingWith } from "../text";

export const BLOCKED_PLACEHOLDER =
  "Verify encryption before sending a message.";

/**
 * A message composer: the conversation one ("Message") or a thread one
 * ("Reply"), scoped to its own region of the page.
 */
export class Composer {
  readonly field: Locator;
  readonly sendButton: Locator;
  /** The send button while a message is edited. */
  readonly saveButton: Locator;
  readonly fileInput: Locator;
  readonly attachments: Locator;
  readonly editingStatus: Locator;
  readonly mentionSuggestions: Locator;
  /** Highlight of a mention in the field, before sending. */
  readonly draftMention: Locator;
  readonly emojiButton: Locator;
  readonly emojiPicker: Locator;
  readonly emojiSearch: Locator;
  /** The emojis offered for a `:shortcode` being typed. */
  readonly emojiSuggestions: Locator;
  /** What screen readers hear when the `@` or `:` suggestions open. */
  readonly suggestionsStatus: Locator;

  constructor(
    readonly scope: Locator,
    fieldName: "Message" | "Reply" = "Message",
  ) {
    this.field = scope.getByRole("textbox", { name: fieldName });
    const form = scope.locator(".hub__chat-composer");
    this.sendButton = form.getByRole("button", { name: "Send message" });
    this.saveButton = form.getByRole("button", { name: "Save changes" });
    this.fileInput = form.locator('input[type="file"]');
    this.attachments = scope.getByRole("list", { name: "Attached files" });
    this.editingStatus = scope.getByRole("status").filter({
      hasText: "Editing message",
    });
    this.mentionSuggestions = scope.page().getByRole("listbox", {
      name: "Mention suggestions",
    });
    this.draftMention = form.locator(".hub__chat-composer__mention");
    this.emojiButton = form.getByRole("button", { name: "Add an emoji" });
    this.emojiPicker = scope
      .page()
      .getByRole("dialog", { name: "Emoji picker" });
    this.emojiSearch = this.emojiPicker.getByPlaceholder("Search emoji");
    this.emojiSuggestions = scope.page().getByRole("listbox", {
      name: "Emoji suggestions",
    });
    // Singular or plural: "1 emoji suggestion, use the arrow keys to choose".
    this.suggestionsStatus = scope.getByRole("status").filter({
      hasText: "use the arrow keys to choose",
    });
  }

  /**
   * The suggestion of `:shortcode:` in the list, after its emoji (shown as
   * text when no image exists for it).
   */
  emojiSuggestion(shortcode: string): Locator {
    return this.emojiSuggestions.getByRole("option").filter({
      hasText: new RegExp(`${escapeRegExp(`:${shortcode}:`)}$`),
    });
  }

  /** Picks from the picker the emoji named `name`, found by that name. */
  async pickEmoji(name: string): Promise<void> {
    await this.emojiButton.click();
    await expect(this.emojiSearch).toBeFocused();
    await this.emojiSearch.fill(name);
    // Emojibase names start with a capital: "Party popper".
    await this.emojiPicker
      .getByRole("gridcell", {
        name: new RegExp(`^${escapeRegExp(name)}$`, "i"),
      })
      .click();
    await expect(this.emojiPicker).toBeHidden();
  }

  /**
   * Types and sends with Enter, then checks the field is empty again. The
   * field is read-only only while an edit is being saved.
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

  /** Sends what the field already holds, such as a draft found there. */
  async sendDraft(): Promise<void> {
    await expect(this.sendButton).toBeEnabled({ timeout: 15_000 });
    await this.field.press("Enter");
    await expect(this.field).toHaveValue("");
  }

  /** Types key by key, as a person would (typing notifications). */
  async type(text: string): Promise<void> {
    await this.field.click();
    await this.field.pressSequentially(text, { delay: 30 });
  }

  /** Selects with Shift+← the `text` that ends at the caret, as a person would. */
  async selectBeforeCaret(text: string): Promise<void> {
    for (let index = 0; index < text.length; index += 1) {
      await this.field.press("Shift+ArrowLeft");
    }
    await expect
      .poll(() =>
        this.field.evaluate((input: HTMLTextAreaElement) =>
          input.value.slice(input.selectionStart, input.selectionEnd),
        ),
      )
      .toBe(text);
  }

  /** Copies `text` to the clipboard and pastes it with the keyboard. */
  async paste(text: string): Promise<void> {
    await this.field
      .page()
      .evaluate((value) => navigator.clipboard.writeText(value), text);
    await this.field.press("ControlOrMeta+V");
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
