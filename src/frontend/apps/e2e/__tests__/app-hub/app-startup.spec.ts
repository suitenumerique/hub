import { expect, test } from "@playwright/test";

test("application starts and displays its default page", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByRole("heading", {
      name: "LaSuite Tchap, one place to chat, share documents and meet.",
    }),
  ).toBeVisible();
});
