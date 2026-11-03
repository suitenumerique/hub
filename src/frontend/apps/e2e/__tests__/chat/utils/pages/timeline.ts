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

/** Names the shield shown instead of a message still being decrypted. */
export const DECRYPTING_MESSAGE = "Decrypting message…";

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

  /**
   * Bubbles whose message contains `text`; texts are unique to a test. A reply
   * quoting that message is left out: its quote is outside its message.
   */
  message(text: string): Locator {
    // `has` looks inside each bubble: the inner locator must not start from
    // the timeline root.
    return this.root.locator(".hub__chat-bubble", {
      has: this.page.locator(".hub__chat-bubble__body", { hasText: text }),
    });
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

  /** As {@link expectMessageAbove}, scrolling down. */
  async expectMessageBelow(text: string): Promise<void> {
    const scroller = this.root.locator("[data-virtuoso-scroller]");
    await scroller.hover();
    await expect
      .poll(
        async () => {
          if ((await this.message(text).count()) > 0) return true;
          await this.page.mouse.wheel(0, 600);
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

  /** The "more" button beside the bubble, shown while it is hovered. */
  moreButton(target: MessageTarget): Locator {
    return this.bubble(target).getByRole("button", { name: "Message actions" });
  }

  /** The "more" button opens the same actions menu, under itself. */
  async openActionsFromButton(target: MessageTarget): Promise<Locator> {
    const body = this.body(target);
    await body.scrollIntoViewIfNeeded();
    await body.hover();
    await this.moreButton(target).click();
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

  /** Hovers a reaction chip: its tooltip names who reacted, one per line. */
  async hoverReaction(text: string, emoji: string): Promise<Locator> {
    // Pressing a chip closes its tooltip until the pointer comes back.
    await this.page.mouse.move(0, 0);
    return this.openTooltip(this.reaction(text, emoji));
  }

  /** Hovers the shield of a message still being decrypted. */
  async hoverDecryptingMessage(target: Locator): Promise<Locator> {
    return this.openTooltip(
      target.getByRole("img", { name: DECRYPTING_MESSAGE }),
    );
  }

  private async openTooltip(trigger: Locator): Promise<Locator> {
    await trigger.hover();
    const tooltip = this.page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    // It shows after a delay, sliding in: wait until it stands still.
    await tooltip.evaluate((element) =>
      Promise.all(element.getAnimations().map(({ finished }) => finished)),
    );
    return tooltip;
  }

  /** Lines of the open reaction tooltip: names, then "and N others". */
  reactionSenders(tooltip: Locator): Locator {
    return tooltip.locator(".hub__message-reactions__sender");
  }

  async expectReactionSenders(
    text: string,
    emoji: string,
    lines: string[],
  ): Promise<void> {
    const tooltip = await this.hoverReaction(text, emoji);
    await expect(this.reactionSenders(tooltip)).toHaveText(lines, {
      timeout: SYNC_TIMEOUT,
    });
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

  /** Messages still being decrypted keep their place, as a shield. */
  decryptingMessages(): Locator {
    return this.messages().filter({
      has: this.page.getByRole("img", { name: DECRYPTING_MESSAGE }),
    });
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

  /** Quote of the answered message, above a reply sent from Tchap. */
  quote(text: string): Locator {
    return this.message(text).locator(".hub__message-quote");
  }

  /** Checks who and what the quote above a reply shows. */
  async expectQuote(
    text: string,
    { author, quoted }: { author?: string; quoted: string },
  ): Promise<void> {
    const quote = this.quote(text);
    await expect(quote.locator(".hub__message-quote__text")).toHaveText(
      quoted,
      { timeout: SYNC_TIMEOUT },
    );
    const authorLine = quote.locator(".hub__message-quote__author");
    if (author) {
      await expect(authorLine).toHaveText(author);
    } else {
      await expect(authorLine).toHaveCount(0);
    }
  }

  /** The quote's button that goes to the answered message. */
  quoteJump(text: string): Locator {
    return this.quote(text).getByRole("button", {
      name: "Go to the original message",
    });
  }

  /** The message a quote went to is shown and selected. */
  async expectSelected(text: string): Promise<void> {
    await expect(this.message(text)).toHaveAttribute(
      "data-highlighted",
      "true",
      { timeout: SYNC_TIMEOUT },
    );
    await expect(this.body(text)).toBeInViewport();
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
