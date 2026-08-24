import { expect, test } from "@playwright/test";

import { DEFAULT_TEST_EMAIL, setupAuthenticatedUser } from "./utils-auth";

const BASE_API_URL =
  process.env.BASE_API_URL ?? "http://localhost:9801/api/v1.0";

test("E2E authentication creates an authenticated backend session", async ({
  page,
}) => {
  await setupAuthenticatedUser(page);

  const response = await page.request.get(`${BASE_API_URL}/users/me/`);
  const user = await response.json();

  expect(response.ok()).toBe(true);
  expect(user.email).toBe(DEFAULT_TEST_EMAIL);
});
