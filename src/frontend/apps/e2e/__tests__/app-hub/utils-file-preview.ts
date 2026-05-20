import { Locator, Page, expect } from '@playwright/test';

export const getFilePreview = (page: Page): Locator =>
  page.locator('[data-testid="file-preview"]');

export const getFilePreviewTitle = (page: Page): Locator =>
  getFilePreview(page).locator('.file-preview__title');

export const getFilePreviewCloseButton = (page: Page): Locator =>
  getFilePreview(page)
    .locator('.file-preview__header__content__left button')
    .first();

export const getFilePreviewNextButton = (page: Page): Locator =>
  getFilePreview(page).locator('.file-preview__next-button button');

export const getFilePreviewPreviousButton = (page: Page): Locator =>
  getFilePreview(page).locator('.file-preview__previous-button button');

export const expectFilePreviewOpen = async (page: Page) => {
  await expect(getFilePreview(page)).toBeVisible();
};

export const expectFilePreviewClosed = async (page: Page) => {
  await expect(getFilePreview(page)).toHaveCount(0);
};
