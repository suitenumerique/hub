import { Locator, Page, expect } from '@playwright/test';

export const getChatHeader = (page: Page): Locator =>
  page.getByLabel('Chat header');

export const getHeaderChatNameButton = (
  page: Page,
  chatName: string,
): Locator => getChatHeader(page).getByRole('button', { name: chatName });

export const getHeaderStartMeetingButton = (page: Page): Locator =>
  getChatHeader(page).getByRole('button', { name: 'Start a meeting' });

export const getHeaderThreadsButton = (page: Page): Locator =>
  getChatHeader(page).getByRole('button', { name: 'Threads' });

export const getHeaderFilesButton = (page: Page): Locator =>
  getChatHeader(page).getByRole('button', { name: 'Files' });

export const getChatBubbles = (page: Page): Locator =>
  page.locator('.hub__chat-bubble');

export const getChatScroller = (page: Page): Locator =>
  page.locator('[data-testid="virtuoso-scroller"]');

export const getTopLoader = (page: Page): Locator =>
  page.getByText('Loading older messages…');

export const getChatScrollState = (page: Page) =>
  page.evaluate(() => {
    const scroller = document.querySelector(
      '[data-testid="virtuoso-scroller"]',
    ) as HTMLElement | null;
    if (!scroller) {
      return null;
    }
    return {
      scrollTop: scroller.scrollTop,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
    };
  });

export const getChatComposerInput = (page: Page): Locator =>
  page.getByRole('textbox', { name: 'Message' });

export const getChatComposerSendButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'Send message' });

export const getChatComposerAttachButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'Attach a file' });

export const expectConversationLoaded = async (page: Page) => {
  await expect(getChatHeader(page)).toBeVisible();
  await expect(getChatBubbles(page).first()).toBeVisible();
  await expect(getChatComposerInput(page)).toBeVisible();
};
