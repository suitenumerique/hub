import { expect, test } from "@playwright/test";

import { setupAuthenticatedUser } from "./utils-auth";
import { expectLeftPanelVisible } from "./utils-left-panel";
import { clearDb } from "./utils-common";

test.describe("Home redirects", () => {
  test("authenticated user is redirected from / to /chat/new", async ({
    page,
  }) => {
    await setupAuthenticatedUser(page);

    await page.goto("/");

    await expect(page).toHaveURL(/\/chat\/new$/);
    await expectLeftPanelVisible(page);
  });

  test("anonymous user is redirected from / to /home", async ({ page }) => {
    await clearDb();

    await page.goto("/");

    await page.waitForURL("**/home");

    await expect(
      page.getByRole("heading", {
        name: "LaSuite Hub, your gateway to the collaborative suite.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });
});
