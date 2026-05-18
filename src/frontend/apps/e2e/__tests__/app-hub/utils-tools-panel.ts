import { Locator, Page, expect } from '@playwright/test';

export const getToolsPanel = (page: Page): Locator =>
  page.locator('.hub__chat-tools-panel');

export const getToolsPanelTitle = (page: Page): Locator =>
  getToolsPanel(page).getByRole('heading', { level: 2 });

export const getClosePanelButton = (page: Page): Locator =>
  getToolsPanel(page).getByRole('button', { name: 'Close panel' });

export const getToolsPanelSection = (page: Page, title: string): Locator =>
  getToolsPanel(page)
    .locator('.hub__chat-tools-panel__section')
    .filter({
      has: page.locator('.hub__chat-tools-panel__section__title', {
        hasText: title,
      }),
    });

export const getToolsPanelSectionToggle = (section: Locator): Locator =>
  section.locator('.hub__chat-tools-panel__section__header');

export const getDocumentItem = (page: Page, title: string): Locator =>
  getToolsPanel(page)
    .locator('.hub__chat-tools-panel__list-item')
    .filter({ hasText: title });

export const expectToolsPanelOpen = async (page: Page) => {
  await expect(page.locator('.hub__chat-view')).toHaveAttribute(
    'data-panel-open',
    'true',
  );
};

export const expectToolsPanelClosed = async (page: Page) => {
  await expect(page.locator('.hub__chat-view')).toHaveAttribute(
    'data-panel-open',
    'false',
  );
};
