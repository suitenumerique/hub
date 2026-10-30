import { expect, Locator, Page } from "@playwright/test";

import { SYNC_TIMEOUT } from "../env";
import { escapeRegExp } from "../text";

/** Reactions offered at the top of the message actions menu. */
export const QUICK_REACTIONS = {
  "👍": "React with a thumbs up",
  "😂": "React with a laughing face",
  "✅": "React with a check mark",
} as const;
export type QuickReaction = keyof typeof QUICK_REACTIONS;

export const DELETED_MESSAGE = "Message deleted";

/** A message, by its text, or a bubble already located (an image…). */
export type MessageTarget = string | Locator;

/**
 * Messages of a conversation or of a thread. Rows are virtualized and carry no
 * ARIA roles: bubbles are found by their text within this timeline.
 */
export class Timeline {
  readonly unreadSeparator: Locator;
  readonly unreadBanner: Locator;
  readonly encryptionNotice: Locator;

  constructor(
    readonly page: Page,
    readonly root: Locator,
  ) {
    this.unreadSeparator = root.getByTestId("unread-separator");
    this.unreadBanner = page.getByTestId("unread-banner");
    this.encryptionNotice = root.locator(".hub__encryption-notice");
  }

  /** Bubbles containing `text`; texts are unique to a test. */
  message(text: string): Locator {
    return this.root.locator(".hub__chat-bubble", { hasText: text });
  }

  private bubble(target: MessageTarget): Locator {
    return typeof target === "string" ? this.message(target) : target;
  }

  body(target: MessageTarget): Locator {
    return this.bubble(target).locator(".hub__chat-bubble__body");
  }

  /** All bubbles currently rendered. */
  messages(): Locator {
    return this.root.locator(".hub__chat-bubble");
  }

  async expectMessage(text: string): Promise<void> {
    await expect(this.message(text)).toBeVisible({ timeout: SYNC_TIMEOUT });
  }

  /**
   * Scrolls up through the virtualized list with the mouse wheel, as a person
   * would, until the message is rendered: older pages load on the way.
   */
  async expectMessageAbove(text: string): Promise<void> {
    const scroller = this.root.locator("[data-virtuoso-scroller]");
    await scroller.hover();
    await expect
      .poll(
        async () => {
          if ((await this.message(text).count()) > 0) return true;
          await this.page.mouse.wheel(0, -600);
          return false;
        },
        { timeout: SYNC_TIMEOUT, intervals: [300] },
      )
      .toBe(true);
    await this.message(text).scrollIntoViewIfNeeded();
  }

  /** Scrolls up a little with the mouse wheel, as a person reading back. */
  async scroll(): Promise<void> {
    await this.root.locator("[data-virtuoso-scroller]").hover();
    await this.page.mouse.wheel(0, -300);
  }

  /** Shown exactly once: the server echo did not duplicate it. */
  async expectMessageOnce(text: string): Promise<void> {
    await this.expectMessage(text);
    await expect(this.message(text)).toHaveCount(1);
  }

  async expectNoMessage(text: string): Promise<void> {
    await expect(this.message(text)).toHaveCount(0, { timeout: SYNC_TIMEOUT });
  }

  /** A right click on the bubble opens its actions menu at the pointer. */
  async openActions(target: MessageTarget): Promise<Locator> {
    const body = this.body(target);
    await body.scrollIntoViewIfNeeded();
    await body.click({ button: "right" });
    await expect(body).toHaveAttribute("data-toolbar-open", "true");
    return body.locator(".hub__message-toolbar");
  }

  async react(text: string, emoji: QuickReaction): Promise<void> {
    const menu = await this.openActions(text);
    await menu.getByRole("button", { name: QUICK_REACTIONS[emoji] }).click();
  }

  /** Reaction chip of `emoji` under the message. */
  reaction(text: string, emoji: string): Locator {
    return this.message(text)
      .locator(".hub__message-reactions")
      .getByRole("button", {
        name: new RegExp(
          `^(React with ${escapeRegExp(emoji)}|Remove your ${escapeRegExp(emoji)} reaction) \\(`,
        ),
      });
  }

  /** Checks the chip total and whether the reaction is the viewer's own. */
  async expectReaction(
    text: string,
    emoji: string,
    { count, mine }: { count: number; mine: boolean },
  ): Promise<void> {
    const chip = this.reaction(text, emoji);
    await expect(chip).toHaveAttribute("aria-pressed", String(mine), {
      timeout: SYNC_TIMEOUT,
    });
    await expect(chip).toHaveAccessibleName(
      mine
        ? `Remove your ${emoji} reaction (${count})`
        : `React with ${emoji} (${count})`,
    );
  }

  /** Emojis of the reaction chips under a message, in display order. */
  async reactionEmojis(text: string): Promise<string[]> {
    const labels = await this.message(text)
      .locator(".hub__message-reactions__chip")
      .evaluateAll((chips) =>
        chips.map((chip) => chip.getAttribute("aria-label") ?? ""),
      );
    // The trailing "Add a reaction" button has the same class: skip it.
    return labels.flatMap((label) => {
      const match = /^(?:React with (.+) \(|Remove your (.+) reaction \()/.exec(
        label,
      );
      return match ? [match[1] ?? match[2]] : [];
    });
  }

  async expectReactionOrder(text: string, emojis: string[]): Promise<void> {
    await expect
      .poll(() => this.reactionEmojis(text), { timeout: SYNC_TIMEOUT })
      .toEqual(emojis);
  }

  /** Opens the actions menu and picks one of its actions. */
  async pickAction(
    target: MessageTarget,
    action: "Download" | "Copy" | "Edit" | "Delete",
  ): Promise<void> {
    const menu = await this.openActions(target);
    await menu.getByRole("button", { name: action, exact: true }).click();
  }

  async expectEdited(text: string): Promise<void> {
    await expect(
      this.message(text).locator(".hub__chat-bubble__edited"),
    ).toHaveText("edited", { timeout: SYNC_TIMEOUT });
  }

  /** Deleted messages keep their place, as a tombstone. */
  deletedMessages(): Locator {
    return this.root.locator(".hub__chat-bubble__tombstone", {
      hasText: DELETED_MESSAGE,
    });
  }

  /** Image of a message, which opens its preview. */
  image(fileName: string): Locator {
    return this.root.getByRole("button", { name: `Open ${fileName}` });
  }

  /** File card of a message, named after the file. */
  file(fileName: string): Locator {
    return this.root.locator(".hub__message-attachment--file", {
      hasText: fileName,
    });
  }

  /** Bubble of an image or a file. */
  attachmentMessage(fileName: string, kind: "image" | "file"): Locator {
    // `has` looks inside each bubble: the inner locator must not start from
    // the timeline root.
    return this.root.locator(".hub__chat-bubble", {
      has:
        kind === "image"
          ? this.page.getByRole("button", { name: `Open ${fileName}` })
          : this.page.locator(".hub__message-attachment--file", {
              hasText: fileName,
            }),
    });
  }

  /** Downloads an image or a file from its actions menu. */
  async download(fileName: string, kind: "image" | "file") {
    const download = this.page.waitForEvent("download");
    await this.pickAction(this.attachmentMessage(fileName, kind), "Download");
    return download;
  }

  /** "Reply" on a message opens its thread in the tools panel. */
  async reply(text: string): Promise<void> {
    const menu = await this.openActions(text);
    await menu.getByRole("button", { name: "Reply", exact: true }).click();
  }

  /** "N replies" button under a thread root. */
  threadButton(text: string): Locator {
    return this.message(text).locator(".hub__chat-thread-button");
  }

  async expectUnreadSeparatorBefore(text: string): Promise<void> {
    await expect(
      this.root
        .locator(".hub__chat-conversation__row", { hasText: text })
        .getByTestId("unread-separator"),
    ).toHaveAttribute("data-visible", "true", { timeout: SYNC_TIMEOUT });
  }

  unreadBannerButton(): Locator {
    return this.unreadBanner.locator(".hub__unread-messages-banner__open");
  }

  async expectUnreadBanner(label: string | RegExp): Promise<void> {
    await expect(this.unreadBannerButton()).toHaveAccessibleName(label, {
      timeout: SYNC_TIMEOUT,
    });
  }

  async markAllRead(): Promise<void> {
    await this.unreadBanner
      .getByRole("button", { name: "Mark as read" })
      .click();
    await expect(this.unreadBanner).toBeHidden({ timeout: SYNC_TIMEOUT });
  }
}
