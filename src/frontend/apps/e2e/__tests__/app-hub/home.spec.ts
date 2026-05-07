import { expect, test } from '@playwright/test';

import { clearDb, login } from './utils-common';

test.describe('Home page', () => {
  test('user is logged in and sees the welcome message', async ({ page }) => {
    await clearDb();
    await login(page, 'user.test@chromium.test');

    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Welcome to the Hub' }),
    ).toBeVisible();
  });

  test('anonymous user is redirected from / to /home', async ({ page }) => {
    await clearDb();

    await page.goto('/');

    await page.waitForURL('**/home');

    await expect(
      page.getByRole('heading', {
        name: 'LaSuite Hub, your gateway to the collaborative suite.',
      }),
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Login' }),
    ).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Welcome to the Hub' }),
    ).toBeHidden();
  });
});
