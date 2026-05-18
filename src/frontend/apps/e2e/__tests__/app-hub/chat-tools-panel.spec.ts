import { expect, test } from '@playwright/test';

import { setupAuthenticatedUser } from './utils-auth';
import {
  getChatHeader,
  getHeaderFilesButton,
  getHeaderThreadsButton,
} from './utils-chat-conversation';
import { expectLeftPanelVisible, getChatLink } from './utils-left-panel';
import {
  expectToolsPanelClosed,
  expectToolsPanelOpen,
  getClosePanelButton,
  getDocumentItem,
  getToolsPanelSection,
  getToolsPanelSectionToggle,
  getToolsPanelTitle,
} from './utils-tools-panel';

const FIRST_CHAT = {
  id: 'a3f1b2c0-1d2e-4f5a-9c8b-7d6e5f4a3b2c',
  name: 'Didier Salambo',
};

test.describe('Chat tools panel', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto('/chat/new');
    await expectLeftPanelVisible(page);

    await getChatLink(page, FIRST_CHAT.name).click();
    await page.waitForURL(`**/chat/${FIRST_CHAT.id}`);
    await expect(getChatHeader(page)).toBeVisible();
  });

  test('Files button toggles the panel open and closed', async ({ page }) => {
    const filesButton = getHeaderFilesButton(page);
    await expect(filesButton).toHaveAttribute('aria-pressed', 'false');
    await expectToolsPanelClosed(page);

    await filesButton.click();
    await expect(filesButton).toHaveAttribute('aria-pressed', 'true');
    await expectToolsPanelOpen(page);
    await expect(getToolsPanelTitle(page)).toHaveText('Documents');

    await filesButton.click();
    await expect(filesButton).toHaveAttribute('aria-pressed', 'false');
    await expectToolsPanelClosed(page);
  });

  test('switching tools updates the panel title and aria-pressed', async ({
    page,
  }) => {
    const threadsButton = getHeaderThreadsButton(page);
    const filesButton = getHeaderFilesButton(page);

    await threadsButton.click();
    await expect(threadsButton).toHaveAttribute('aria-pressed', 'true');
    await expect(filesButton).toHaveAttribute('aria-pressed', 'false');
    await expect(getToolsPanelTitle(page)).toHaveText('Threads');

    await filesButton.click();
    await expect(filesButton).toHaveAttribute('aria-pressed', 'true');
    await expect(threadsButton).toHaveAttribute('aria-pressed', 'false');
    await expect(getToolsPanelTitle(page)).toHaveText('Documents');
  });

  test('close button dismisses the panel', async ({ page }) => {
    await getHeaderFilesButton(page).click();
    await expectToolsPanelOpen(page);

    await getClosePanelButton(page).click();
    await expectToolsPanelClosed(page);
    await expect(getHeaderFilesButton(page)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('documents tool renders three sections with collapsible behaviour', async ({
    page,
  }) => {
    await getHeaderFilesButton(page).click();
    await expectToolsPanelOpen(page);

    const pinned = getToolsPanelSection(page, 'Pinned');
    const shared = getToolsPanelSection(page, 'Shared Files');
    const multimedia = getToolsPanelSection(page, 'Multimedia');

    await expect(pinned).toBeVisible();
    await expect(shared).toBeVisible();
    await expect(multimedia).toBeVisible();

    const sharedItem = getDocumentItem(page, 'Communication');
    await expect(sharedItem).toBeVisible();

    const sharedToggle = getToolsPanelSectionToggle(shared);
    await sharedToggle.click();
    await expect(sharedToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(sharedItem).toBeHidden();

    await sharedToggle.click();
    await expect(sharedToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(sharedItem).toBeVisible();
  });
});
