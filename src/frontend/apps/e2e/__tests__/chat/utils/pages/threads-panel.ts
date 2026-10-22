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
}
