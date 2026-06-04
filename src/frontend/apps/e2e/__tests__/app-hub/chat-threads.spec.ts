import { expect, test } from "@playwright/test";

import { setupAuthenticatedUser } from "./utils-auth";
import {
  expectConversationLoaded,
  getChatHeader,
  getHeaderThreadsButton,
} from "./utils-chat-conversation";
import {
  expectLeftPanelVisible,
  getChatLink,
  waitForChatUrl,
} from "./utils-left-panel";
import {
  getBubbleThreadButtons,
  getThreadBackButton,
  getThreadDetail,
  getThreadItemButton,
  getThreadItems,
  getThreadsBanner,
  getThreadsBannerMarkReadButton,
  getThreadsBannerOpenButton,
  getUnreadThreadItems,
} from "./utils-threads";
import {
  expectToolsPanelClosed,
  expectToolsPanelOpen,
  getToolsPanelTitle,
} from "./utils-tools-panel";

const FIRST_CHAT = {
  id: "a3f1b2c0-1d2e-4f5a-9c8b-7d6e5f4a3b2c",
  name: "Didier Salambo",
};

test.describe("Chat threads", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto("/chat/new");
    await expectLeftPanelVisible(page);

    await getChatLink(page, FIRST_CHAT.name).click();
    await waitForChatUrl(page, FIRST_CHAT.id);
    await expectConversationLoaded(page);
  });

  test("threads button opens the panel on the thread list", async ({
    page,
  }) => {
    await expectToolsPanelClosed(page);

    await getHeaderThreadsButton(page).click();
    await expectToolsPanelOpen(page);
    await expect(getToolsPanelTitle(page)).toHaveText("All threads");
    await expect(getThreadItems(page).first()).toBeVisible();
    expect(await getThreadItems(page).count()).toBeGreaterThan(0);
  });

  test("opening a thread shows its detail view, back returns to the list", async ({
    page,
  }) => {
    await getHeaderThreadsButton(page).click();
    await expect(getThreadItems(page).first()).toBeVisible();

    await getThreadItemButton(getThreadItems(page).first()).click();
    await expect(getToolsPanelTitle(page)).toHaveText("Thread");
    await expect(getThreadDetail(page)).toBeVisible();
    await expect(getChatHeader(page)).toBeVisible();

    await getThreadBackButton(page).click();
    await expect(getToolsPanelTitle(page)).toHaveText("All threads");
    await expect(getThreadItems(page).first()).toBeVisible();
  });

  test("the unread threads banner sits above the composer", async ({
    page,
  }) => {
    await expect(getThreadsBanner(page)).toBeVisible();
    await expect(getThreadsBannerOpenButton(page)).toContainText(
      "unread thread",
    );
  });

  test("the banner opens the threads panel", async ({ page }) => {
    await expectToolsPanelClosed(page);

    await getThreadsBannerOpenButton(page).click();
    await expectToolsPanelOpen(page);
    await expect(
      getThreadDetail(page).or(getThreadItems(page).first()),
    ).toBeVisible();
  });

  test("marking all as read dismisses the banner", async ({ page }) => {
    await expect(getThreadsBanner(page)).toBeVisible();

    await getThreadsBannerMarkReadButton(page).click();
    await expect(getThreadsBanner(page)).toHaveCount(0);
  });

  test("a bubble thread button opens the thread detail", async ({ page }) => {
    const threadButton = getBubbleThreadButtons(page).last();
    await expect(threadButton).toBeVisible();

    await threadButton.click();
    await expectToolsPanelOpen(page);
    await expect(getToolsPanelTitle(page)).toHaveText("Thread");
    await expect(getThreadDetail(page)).toBeVisible();
  });

  test("a thread message can be reacted to, with no Reply/More actions", async ({
    page,
  }) => {
    await getHeaderThreadsButton(page).click();
    await getThreadItemButton(getThreadItems(page).first()).click();
    await expect(getThreadDetail(page)).toBeVisible();

    const bubble = getThreadDetail(page).locator(".hub__chat-bubble").last();
    await bubble.locator(".hub__chat-bubble__body").hover();

    // The threads toolbar exposes reactions but not Reply / More.
    const toolbar = bubble.locator(".hub__message-toolbar");
    await expect(toolbar.getByText("Reply")).toHaveCount(0);
    await expect(
      toolbar.getByRole("button", { name: "More actions" }),
    ).toHaveCount(0);

    await toolbar
      .getByRole("button", { name: "React with a thumbs up" })
      .click();

    // The reaction lands in the persistent bar under that thread bubble.
    await expect(bubble.locator(".hub__message-reactions")).toBeVisible();
  });

  test("reading an unread thread lowers the unread count", async ({ page }) => {
    await expect(getThreadsBannerOpenButton(page)).toContainText(
      "2 unread threads",
    );

    await getHeaderThreadsButton(page).click();
    const firstUnread = getUnreadThreadItems(page).first();
    await expect(firstUnread).toBeVisible();
    await getThreadItemButton(firstUnread).click();
    await expect(getThreadDetail(page)).toBeVisible();

    await getThreadBackButton(page).click();
    await expect(getThreadsBannerOpenButton(page)).toContainText(
      "1 unread thread",
    );
  });
});
