import { Page } from "@playwright/test";

import { clearDb, login } from "./utils-common";

export const DEFAULT_TEST_EMAIL = "user.test@chromium.test";

export const setupAuthenticatedUser = async (
  page: Page,
  email: string = DEFAULT_TEST_EMAIL,
) => {
  await clearDb();
  await login(page, email);
};
