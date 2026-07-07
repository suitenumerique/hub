import { Locator, Page, expect } from "@playwright/test";

import { runTarget } from "./utils-common";
import { getLeftPanel } from "./utils-left-panel";

// The dev-only `matrix-local` chat scope (see `HubApi.ts`): a single real Matrix
// account against the local Synapse, surfaced as its own left-panel scope.
export const MATRIX_LOCAL_SCOPE_ID = "matrix-local";
export const MATRIX_LOCAL_ACCOUNT_ID = "matrix-local";

// Keycloak realm-`hub` credentials of the e2e chromium user (see realm.json).
// Logging into Hub as this user makes the Matrix `login_hint` resolve to the same
// account, which is the one `bin/seed-matrix` invites.
export const MATRIX_E2E_USERNAME = "user-e2e-chromium";
export const MATRIX_E2E_PASSWORD = "password-e2e-chromium";

// The pending invitation seeded by `bin/seed-matrix` (carole → the Hub user).
export const SEEDED_INVITE_NAME = "Invitation de Carole";
export const SEEDED_INVITE_REASON = "Rejoins le salon de test des invitations.";
// A message Carole posted before inviting; it must appear once the invite is
// accepted (the room is `shared`, so a joiner sees prior history).
export const SEEDED_INVITE_HISTORY =
  "Ce message d'historique doit s'afficher après acceptation.";

/** Provision the whole local Matrix stack (users, rooms, the pending invite). */
export const seedMatrixAll = async () => {
  await runTarget("seed-matrix");
};

/** Restore a fresh pending invitation, undoing a previous accept/refuse. */
export const resetMatrixInvite = async () => {
  await runTarget("seed-matrix-invite");
};

export const getChatScopeSelector = (page: Page): Locator =>
  getLeftPanel(page).getByLabel("Chat scope");

export const getInviteRow = (page: Page): Locator =>
  getLeftPanel(page).getByRole("link", { name: new RegExp(SEEDED_INVITE_NAME) });

export const getInvitationDetail = (page: Page): Locator =>
  page.getByRole("region", { name: "Invitation" });

export const getAcceptInvitationButton = (page: Page): Locator =>
  getInvitationDetail(page).getByRole("button", { name: "Accept" });

export const getRefuseInvitationButton = (page: Page): Locator =>
  getInvitationDetail(page).getByRole("button", { name: "Refuse" });

const isVisibleSafe = (locator: Locator): Promise<boolean> =>
  locator
    .first()
    .isVisible()
    .catch(() => false);

/** Fill the Keycloak realm-`hub` login form, when it is the visible page. */
const fillKeycloakLogin = async (
  page: Page,
  username: string,
  password: string,
) => {
  const usernameField = page.locator("#username");
  if (await isVisibleSafe(usernameField)) {
    await usernameField.fill(username);
  }
  await page.locator("#password").fill(password);
  await page
    .getByRole("button", { name: /sign in|log in/i })
    .first()
    .click();
};

/**
 * Log into Hub through the real Keycloak realm-`hub` flow (not the e2e bypass),
 * so the Matrix scope can reuse the resulting SSO session. Anonymous visitors are
 * redirected to `/home`, whose Login button starts the OIDC handshake.
 */
export const loginHubViaKeycloak = async (
  page: Page,
  username = MATRIX_E2E_USERNAME,
  password = MATRIX_E2E_PASSWORD,
) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.locator("#password")).toBeVisible({ timeout: 30_000 });
  await fillKeycloakLogin(page, username, password);
  // Back in the app and authenticated; land on the chat surface.
  await page.waitForURL(
    (url) =>
      url.host === new URL(page.url()).host && !url.pathname.startsWith("/home"),
    { timeout: 30_000 },
  );
};

/**
 * Switch to the `matrix-local` scope and complete whatever the Matrix OIDC
 * handshake surfaces. With a live Keycloak SSO session it usually auto-redirects
 * back; without one it shows the Keycloak login form; a first authorization can
 * interpose a MAS consent screen. Poll for any of these (and the eventual
 * invitation row) so the helper is robust to all three paths.
 */
export const connectMatrixLocal = async (page: Page) => {
  await getChatScopeSelector(page).selectOption(MATRIX_LOCAL_SCOPE_ID);

  const inviteRow = getInviteRow(page);
  const passwordField = page.locator("#password");
  const consentButton = page.getByRole("button", {
    name: /continue|allow|authori[sz]e|approve|grant/i,
  });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await isVisibleSafe(inviteRow)) {
      return;
    }
    if (await isVisibleSafe(passwordField)) {
      await fillKeycloakLogin(
        page,
        MATRIX_E2E_USERNAME,
        MATRIX_E2E_PASSWORD,
      ).catch(() => undefined);
    } else if (await isVisibleSafe(consentButton)) {
      await consentButton
        .first()
        .click()
        .catch(() => undefined);
    }
    await page.waitForTimeout(1_000);
  }

  await expect(inviteRow).toBeVisible({ timeout: 5_000 });
};
