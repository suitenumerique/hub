import { expect, Locator, Page } from "@playwright/test";

import { SYNC_TIMEOUT } from "../env";
import { Composer } from "./composer";
import { Timeline } from "./timeline";

/** The tools panel showing threads: their list, or one open thread. */
export class ThreadsPanel {
  readonly root: Locator;
  /** The open thread's messages, without its composer. */
  readonly messages: Locator;
  readonly composer: Composer;
  readonly timeline: Timeline;
  readonly unreadBanner: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("complementary", { name: "Tools panel" });
    this.messages = this.root.locator(".hub__thread-detail__messages");
    this.composer = new Composer(this.root, "Answer");
    this.timeline = new Timeline(page, this.root);
    this.unreadBanner = page.locator(".hub__unread-threads-banner");
  }

  async expectOpen(): Promise<void> {
    await expect(this.root).toHaveAttribute("aria-hidden", "false");
  }

  /** Opens the list of the conversation's threads from its header. */
  async openList(): Promise<void> {
    await this.page
      .locator(".hub__chat-header")
      .getByRole("button", { name: "Threads", exact: true })
      .click();
    await this.expectOpen();
  }

  /** A row of the thread list, by a text it shows, such as its last reply. */
  listedThread(text: string): Locator {
    return this.root.getByRole("listitem").filter({ hasText: text });
  }

  /**
   * Scrolls down the virtualized thread list with the mouse wheel, as a
   * person would, until the thread is rendered: older pages load on the way.
   */
  async expectThreadListedBelow(text: string): Promise<void> {
    const scroller = this.root.locator("[data-virtuoso-scroller]");
    await scroller.hover();
    await expect
      .poll(
        async () => {
          if ((await this.listedThread(text).count()) > 0) return true;
          await this.page.mouse.wheel(0, 600);
          return false;
        },
        { timeout: SYNC_TIMEOUT, intervals: [300] },
      )
      .toBe(true);
  }

  /** The open thread shows its root message. */
  async expectThread(rootText: string): Promise<void> {
    await this.expectOpen();
    await this.timeline.expectMessage(rootText);
  }

  /** Banner of unread threads above the conversation composer. */
  async expectUnreadThreadsBanner(label: string | RegExp): Promise<void> {
    await expect(this.unreadBanner).toContainText(label, {
      timeout: SYNC_TIMEOUT,
    });
  }

  /** Marks every thread read from the banner, which then disappears. */
  async markAllRead(): Promise<void> {
    await this.unreadBanner
      .getByRole("button", { name: "Mark as read" })
      .click();
    await expect(this.unreadBanner).toBeHidden({ timeout: SYNC_TIMEOUT });
  }
}
