import { expect, test } from '@playwright/test';

import { setupAuthenticatedUser } from './utils-auth';
import {
  getChatHeader,
  getHeaderFilesButton,
  getHeaderThreadsButton,
} from './utils-chat-conversation';
import {
  expectFilePreviewClosed,
  expectFilePreviewOpen,
  getFilePreview,
  getFilePreviewCloseButton,
  getFilePreviewNextButton,
  getFilePreviewPreviousButton,
  getFilePreviewTitle,
} from './utils-file-preview';
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

const SECOND_CHAT = {
  id: 'b4e2c3d1-2e3f-4a5b-8c9d-6e7f8a9b0c1d',
  name: 'Working group',
};

const PDF_MOCK_TITLE = 'Tracemonkey paper.pdf';
const FOLDER_MOCK_TITLE = 'Project Alpha';
const LINK_MOCK_TITLE = 'wikipedia.com';

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

  test('clicking a previewable file opens the preview modal', async ({
    page,
  }) => {
    await getHeaderFilesButton(page).click();
    await expectToolsPanelOpen(page);
    await expectFilePreviewClosed(page);

    await getDocumentItem(page, PDF_MOCK_TITLE).click();
    await expectFilePreviewOpen(page);
    await expect(getFilePreviewTitle(page)).toHaveText('Tracemonkey paper');
  });

  test('preview without siblings hides prev/next navigation', async ({
    page,
  }) => {
    await getHeaderFilesButton(page).click();
    await getDocumentItem(page, PDF_MOCK_TITLE).click();
    await expectFilePreviewOpen(page);

    await expect(getFilePreviewNextButton(page)).toHaveCount(0);
    await expect(getFilePreviewPreviousButton(page)).toHaveCount(0);
  });

  test('clicking the close button dismisses the preview', async ({ page }) => {
    await getHeaderFilesButton(page).click();
    await getDocumentItem(page, PDF_MOCK_TITLE).click();
    await expectFilePreviewOpen(page);

    await getFilePreviewCloseButton(page).click();
    await expect(getFilePreview(page)).toHaveCount(0);
  });

  test('pressing Escape dismisses the preview', async ({ page }) => {
    await getHeaderFilesButton(page).click();
    await getDocumentItem(page, PDF_MOCK_TITLE).click();
    await expectFilePreviewOpen(page);

    await page.keyboard.press('Escape');
    await expect(getFilePreview(page)).toHaveCount(0);
  });

  test('clicking a folder does not open a preview', async ({ page }) => {
    await getHeaderFilesButton(page).click();
    await getDocumentItem(page, FOLDER_MOCK_TITLE).click();
    await page.waitForTimeout(150);
    await expect(getFilePreview(page)).toHaveCount(0);

    // Sanity check: clicking a previewable file straight after still works,
    // proving the dispatch isn't broken for files.
    await getDocumentItem(page, PDF_MOCK_TITLE).click();
    await expectFilePreviewOpen(page);
  });

  test('clicking a link opens a new tab with the link url', async ({
    page,
    context,
  }) => {
    await getHeaderFilesButton(page).click();

    const popupPromise = context.waitForEvent('page');
    await getDocumentItem(page, LINK_MOCK_TITLE).click();
    const popup = await popupPromise;
    expect(popup.url()).toMatch(/wikipedia\.org/);
    await popup.close();
    await expectFilePreviewClosed(page);
  });

  test('switching chats closes an open preview', async ({ page }) => {
    await getHeaderFilesButton(page).click();
    await getDocumentItem(page, PDF_MOCK_TITLE).click();
    await expectFilePreviewOpen(page);

    await getChatLink(page, SECOND_CHAT.name).click();
    await page.waitForURL(`**/chat/${SECOND_CHAT.id}`);
    await expect(getFilePreview(page)).toHaveCount(0);
  });
});
