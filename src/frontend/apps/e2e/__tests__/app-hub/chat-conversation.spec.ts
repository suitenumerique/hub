import { expect, test } from '@playwright/test';

import { setupAuthenticatedUser } from './utils-auth';
import {
  getChatBubbles,
  getChatComposerAttachButton,
  getChatComposerInput,
  getChatComposerSendButton,
  getChatHeader,
  getHeaderChatNameButton,
  getHeaderFilesButton,
  getHeaderStartMeetingButton,
  getHeaderThreadsButton,
} from './utils-chat-conversation';
import { expectLeftPanelVisible, getChatLink } from './utils-left-panel';

const FIRST_CHAT = {
  id: 'a3f1b2c0-1d2e-4f5a-9c8b-7d6e5f4a3b2c',
  name: 'Didier Salambo',
};

test.describe('Chat conversation view', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/chat/new');
    await expectLeftPanelVisible(page);

    await getChatLink(page, FIRST_CHAT.name).click();
    await page.waitForURL(`**/chat/${FIRST_CHAT.id}`);
  });

  test('header is visible and displays the chat name', async ({ page }) => {
    await expect(getChatHeader(page)).toBeVisible();
    await expect(getHeaderChatNameButton(page, FIRST_CHAT.name)).toBeVisible();
  });

  test('header exposes the three right-side action buttons', async ({
    page,
  }) => {
    await expect(getHeaderStartMeetingButton(page)).toBeVisible();
    await expect(getHeaderStartMeetingButton(page)).toBeEnabled();
    await expect(getHeaderThreadsButton(page)).toBeVisible();
    await expect(getHeaderThreadsButton(page)).toBeEnabled();
    await expect(getHeaderFilesButton(page)).toBeVisible();
    await expect(getHeaderFilesButton(page)).toBeEnabled();
  });

  test('at least one message bubble is rendered', async ({ page }) => {
    await expect(getChatBubbles(page).first()).toBeVisible();
  });

  test('composer renders input, attach and send controls', async ({ page }) => {
    await expect(getChatComposerInput(page)).toBeVisible();
    await expect(getChatComposerInput(page)).toBeEditable();
    await expect(getChatComposerAttachButton(page)).toBeVisible();
    await expect(getChatComposerSendButton(page)).toBeVisible();
  });
});
