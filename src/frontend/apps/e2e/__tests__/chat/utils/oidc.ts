import { expect, Page } from "@playwright/test";

import { keyCloakSignIn } from "../../app-hub/utils-common";
import { HUB_URL, MAS_URL } from "./env";
import type { TestIdentity } from "./matrix-admin";

/** Signs in to the Hub from its home page, through Keycloak. */
export const signInToHub = async (
  page: Page,
  identity: TestIdentity,
): Promise<void> => {
  await page.goto("/home");
  await keyCloakSignIn(page, identity.localpart, identity.password);
};

/**
 * First chat sign-in of a person: MAS creates the Matrix account from the
 * Keycloak identity, then asks to allow the Hub.
 */
export const completeFirstMasSignIn = async (page: Page): Promise<void> => {
  await expect(page).toHaveURL(new RegExp(`^${MAS_URL}/`), { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Import your data" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(
    page.getByRole("heading", { name: "Allow access to your account?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(new RegExp(`^${HUB_URL}/`), { timeout: 30_000 });
};

/** Records every page of MAS the browser navigates to. */
export const watchMasNavigations = (page: Page): string[] => {
  const urls: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && frame.url().startsWith(MAS_URL)) {
      urls.push(frame.url());
    }
  });
  return urls;
};
