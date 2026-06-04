import { expect, test } from "@playwright/test";

import { setupAuthenticatedUser } from "./utils-auth";
import {
  getChatBubbles,
  getChatScrollState,
  getChatScroller,
  getTopLoader,
} from "./utils-chat-conversation";
import {
  expectLeftPanelVisible,
  getChatLink,
  waitForChatUrl,
} from "./utils-left-panel";

const FIRST_CHAT = {
  id: "a3f1b2c0-1d2e-4f5a-9c8b-7d6e5f4a3b2c",
  name: "Didier Salambo",
};

test.describe("Chat conversation scroll & pagination", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto("/chat/new");
    await expectLeftPanelVisible(page);

    await getChatLink(page, FIRST_CHAT.name).click();
    await waitForChatUrl(page, FIRST_CHAT.id);
    await expect(getChatBubbles(page).first()).toBeVisible();
  });

  test("lands at the bottom of the conversation on chat open", async ({
    page,
  }) => {
    // Wait for Virtuoso to settle. Two animation frames + a small buffer
    // covers the initial measurement pass.
    await page.waitForFunction(() => {
      const scroller = document.querySelector(
        '[data-testid="virtuoso-scroller"]',
      ) as HTMLElement | null;
      if (!scroller) return false;
      // "At bottom" allowing a few px of subpixel rounding.
      return (
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 4
      );
    });

    const state = await getChatScrollState(page);
    expect(state).not.toBeNull();
    if (!state) return;
    expect(state.scrollHeight).toBeGreaterThan(state.clientHeight);
    expect(
      state.scrollHeight - state.scrollTop - state.clientHeight,
    ).toBeLessThan(4);
  });

  test("scrolling to the top loads older messages without losing position", async ({
    page,
  }) => {
    await expect(getChatBubbles(page).first()).toBeVisible();
    const stateBefore = await getChatScrollState(page);
    expect(stateBefore?.scrollHeight).toBeGreaterThan(0);

    await getChatScroller(page).evaluate((el) => {
      (el as HTMLElement).scrollTop = 0;
    });

    // The top-loader appears while fetchOlder is in flight, then disappears
    // once the new page has been merged in — that's the only browser-agnostic
    // proof that the pagination round-trip happened.
    await expect(getTopLoader(page)).toBeVisible();
    await expect(getTopLoader(page)).toBeHidden();

    // After the prepend, the scroller is taller (one full page of older
    // messages was added) and Virtuoso has shifted scrollTop away from 0 so
    // the previously visible content stays in view.
    const heightBefore = stateBefore!.scrollHeight;
    await page.waitForFunction((before) => {
      const scroller = document.querySelector(
        '[data-testid="virtuoso-scroller"]',
      ) as HTMLElement | null;
      return !!scroller && scroller.scrollHeight > before;
    }, heightBefore);
    const stateAfter = await getChatScrollState(page);
    expect(stateAfter?.scrollTop).toBeGreaterThan(0);
  });
});
