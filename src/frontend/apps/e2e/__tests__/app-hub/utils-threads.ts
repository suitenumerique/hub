import { Locator, Page } from '@playwright/test';

import { getToolsPanel } from './utils-tools-panel';

export const getThreadsBanner = (page: Page): Locator =>
  page.locator('.hub__unread-threads-banner');

export const getThreadsBannerOpenButton = (page: Page): Locator =>
  getThreadsBanner(page).locator('.hub__unread-threads-banner__open');

export const getThreadsBannerMarkReadButton = (page: Page): Locator =>
  getThreadsBanner(page).getByRole('button', { name: 'Mark all as read' });

export const getThreadItems = (page: Page): Locator =>
  getToolsPanel(page).locator('.hub__chat-thread-item');

export const getUnreadThreadItems = (page: Page): Locator =>
  getToolsPanel(page).locator('.hub__chat-thread-item[data-unread="true"]');

export const getThreadItemButton = (item: Locator): Locator =>
  item.locator('.hub__chat-thread-item__button');

export const getThreadDetail = (page: Page): Locator =>
  getToolsPanel(page).locator('.hub__thread-detail');

export const getThreadBackButton = (page: Page): Locator =>
  getToolsPanel(page).getByRole('button', { name: 'Back to all threads' });

export const getBubbleThreadButtons = (page: Page): Locator =>
  page.locator('.hub__chat-thread-button');
