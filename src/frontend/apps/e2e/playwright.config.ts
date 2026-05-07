import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({
  path: ['./.env.local', './.env'],
  quiet: true,
  debug: !process.env.CI,
});

const PORT = process.env.PORT || 9800;
const baseURL = process.env.BASE_URL || `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  timeout: 30 * 1000,
  testDir: './__tests__',
  outputDir: './test-results',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  maxFailures: process.env.CI ? 3 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: './report' }],
    ['list', { printSteps: true }],
  ],
  snapshotPathTemplate: '{snapshotDir}/{arg}{-projectName}{ext}',
  use: {
    baseURL,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: `cd ../.. && yarn app:dev --port ${PORT}`,
          url: baseURL,
          timeout: 120 * 1000,
          reuseExistingServer: true,
        },
      }),
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'en-US',
        timezoneId: 'Europe/Paris',
        contextOptions: {
          permissions: ['clipboard-read', 'clipboard-write'],
        },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        locale: 'en-US',
        timezoneId: 'Europe/Paris',
        contextOptions: {
          permissions: ['clipboard-read'],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        locale: 'en-US',
        timezoneId: 'Europe/Paris',
        launchOptions: {
          firefoxUserPrefs: {
            'dom.events.asyncClipboard.readText': true,
            'dom.events.testing.asyncClipboard': true,
          },
        },
      },
    },
  ],
});
