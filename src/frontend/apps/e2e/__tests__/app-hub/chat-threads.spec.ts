import { expect, test, type Locator } from "@playwright/test";

import { setupAuthenticatedUser } from "./utils-auth";
import {
  expectConversationLoaded,
  getChatComposerInput,
  getChatComposerSendButton,
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

type Box = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

const BOUNDS_TOLERANCE = 2;

const getBox = async (locator: Locator, label: string): Promise<Box> => {
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).not.toBeNull();
  return box as Box;
};

const getBubbleBodyText = (body: Locator): Promise<string> =>
  body.evaluate((element) =>
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim(),
  );

const expectToolbarAnchored = async (
  bubble: Locator,
  side: "left" | "right",
) => {
  const body = bubble.locator(".hub__chat-bubble__body");
  const toolbarBar = bubble.locator(".hub__message-toolbar__bar");
  const container = bubble.locator(
    "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' hub__chat-conversation__row-inner ')][1]",
  );

  await body.hover();
  await expect(toolbarBar).toBeVisible();

  const [bodyBox, toolbarBox, containerBox] = await Promise.all([
    getBox(body, "bubble body"),
    getBox(toolbarBar, "message toolbar"),
    getBox(container, "conversation row"),
  ]);

  if (side === "left") {
    expect(Math.abs(toolbarBox.x - bodyBox.x)).toBeLessThanOrEqual(
      BOUNDS_TOLERANCE,
    );
  } else {
    expect(
      Math.abs(toolbarBox.x + toolbarBox.width - (bodyBox.x + bodyBox.width)),
    ).toBeLessThanOrEqual(BOUNDS_TOLERANCE);
  }

  expect(toolbarBox.x).toBeGreaterThanOrEqual(
    containerBox.x - BOUNDS_TOLERANCE,
  );
  expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(
    containerBox.x + containerBox.width + BOUNDS_TOLERANCE,
  );

  return { bodyBox, toolbarBox, containerBox };
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

  test("the hover toolbar is anchored within the conversation on short bubbles", async ({
    page,
  }) => {
    const receivedBubble = page.locator(".hub__chat-bubble--received").last();
    await expect(receivedBubble).toBeVisible();
    await expectToolbarAnchored(receivedBubble, "left");

    await getChatComposerInput(page).fill("ok");
    await getChatComposerSendButton(page).click();

    const sentBubble = page
      .locator(".hub__chat-bubble--sent")
      .filter({ hasText: "ok" })
      .last();
    await expect(sentBubble).toBeVisible();
    const { bodyBox: sentBodyBox, toolbarBox: sentToolbarBox } =
      await expectToolbarAnchored(sentBubble, "right");

    expect(sentBodyBox.width).toBeLessThan(80);
    expect(sentToolbarBox.width).toBeGreaterThan(
      sentBodyBox.width + BOUNDS_TOLERANCE,
    );
  });

  test("starting a thread from a received bubble keeps the root visible and composer focused", async ({
    page,
  }) => {
    const rootBubble = page
      .locator(".hub__chat-bubble--received")
      .filter({ hasNot: page.locator(".hub__chat-thread-button") })
      .last();
    const rootBody = rootBubble.locator(".hub__chat-bubble__body");

    await expect(rootBubble).toBeVisible();
    const rootText = await getBubbleBodyText(rootBody);
    expect(rootText).not.toHaveLength(0);

    await rootBody.hover();
    await rootBubble
      .locator(".hub__message-toolbar")
      .getByRole("button", { name: "Reply" })
      .click();

    await expectToolsPanelOpen(page);
    await expect(getToolsPanelTitle(page)).toHaveText("Thread");
    await expect(getThreadDetail(page)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Answer" })).toBeFocused();

    await page.getByRole("textbox", { name: "Answer" }).fill("First reply");
    await getThreadDetail(page)
      .getByRole("button", { name: "Send message" })
      .click();

    await expect(
      getThreadDetail(page)
        .locator(".hub__chat-bubble", { hasText: rootText })
        .first(),
    ).toBeVisible();
    await expect(
      getThreadDetail(page).locator(".hub__chat-bubble", {
        hasText: "First reply",
      }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Answer" })).toBeFocused();
  });

  test("sending a thread reply from an older scroll position returns to the bottom", async ({
    page,
  }) => {
    const threadButton = getBubbleThreadButtons(page).last();
    await expect(threadButton).toBeVisible();
    await threadButton.click();
    await expect(getThreadDetail(page)).toBeVisible();

    const messages = getThreadDetail(page).locator(
      ".hub__thread-detail__messages",
    );
    await expect
      .poll(() =>
        messages.evaluate(
          (el) =>
            (el as HTMLElement).scrollHeight >
            (el as HTMLElement).clientHeight + 100,
        ),
      )
      .toBe(true);

    await messages.evaluate((el) => {
      const scroller = el as HTMLElement;
      scroller.scrollTop = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight - 160,
      );
    });
    await expect
      .poll(() =>
        messages.evaluate((el) => {
          const scroller = el as HTMLElement;
          return (
            scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
          );
        }),
      )
      .toBeGreaterThan(100);

    await page
      .getByRole("textbox", { name: "Answer" })
      .fill("Scroll follow thread");
    await getThreadDetail(page)
      .getByRole("button", { name: "Send message" })
      .click();

    await expect(
      getThreadDetail(page).locator(".hub__chat-bubble", {
        hasText: "Scroll follow thread",
      }),
    ).toBeVisible();
    await expect
      .poll(() =>
        messages.evaluate((el) => {
          const scroller = el as HTMLElement;
          return (
            scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
          );
        }),
      )
      .toBeLessThan(4);
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
