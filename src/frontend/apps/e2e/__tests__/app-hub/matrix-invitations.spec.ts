import { expect, test } from "@playwright/test";

import { getChatComposerInput } from "./utils-chat-conversation";
import {
  connectMatrixLocal,
  getAcceptInvitationButton,
  getInvitationDetail,
  getInviteRow,
  getRefuseInvitationButton,
  loginHubViaKeycloak,
  resetMatrixInvite,
  seedMatrixAll,
  SEEDED_INVITE_HISTORY,
  SEEDED_INVITE_NAME,
  SEEDED_INVITE_REASON,
} from "./utils-matrix";

// Matrix invitation e2e: exercises the real `matrix-local` scope against the
// local Synapse + MAS + Keycloak stack. This is NOT part of the default
// mock-driven suite or CI — it needs the full dev stack up (`make run-matrix`)
// and the fixtures seeded (`make seed-matrix`). Unlike the rest of the suite it
// logs in through real Keycloak rather than the e2e auth bypass, because the
// `make run-backend-e2e` flow stops Keycloak, which the Matrix OIDC handshake
// needs. Gated behind `RUN_MATRIX_E2E` so `yarn test --project=chromium` stays
// green without the Matrix stack; set the flag to run these:
//
//   RUN_MATRIX_E2E=1 yarn test --project=chromium matrix-invitations
const describeMatrix = process.env.RUN_MATRIX_E2E
  ? test.describe
  : test.describe.skip;

describeMatrix("Matrix incoming invitations", () => {
  // The OIDC handshake plus the Matrix `/sync` are slow; give them room.
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    // Provision identities, rooms, and the pending invitation once.
    await seedMatrixAll();
  });

  test.beforeEach(async ({ page }) => {
    // Restore a fresh pending invite, undoing a prior accept/refuse.
    await resetMatrixInvite();
    await loginHubViaKeycloak(page);
    await page.goto("/chat/new");
    await connectMatrixLocal(page);
  });

  test("shows an invitation, opens it, accepts it, and lands in the conversation", async ({
    page,
  }) => {
    await getInviteRow(page).click();

    // The invitation detail replaces the timeline/composer until accepted.
    await expect(getInvitationDetail(page)).toBeVisible();
    await expect(page.getByText("You have been invited")).toBeVisible();
    await expect(page.getByText(SEEDED_INVITE_REASON)).toBeVisible();
    await expect(getChatComposerInput(page)).toHaveCount(0);

    await getAcceptInvitationButton(page).click();

    // Accepting keeps the route and switches to the normal conversation view,
    // with the room's prior history loaded (the room is `shared`).
    await expect(getInvitationDetail(page)).toHaveCount(0);
    await expect(getChatComposerInput(page)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/account=matrix-local/);
    await expect(page.getByText(SEEDED_INVITE_HISTORY)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("shows an invitation, opens it, refuses it, and returns to a neutral view", async ({
    page,
  }) => {
    await getInviteRow(page).click();

    await expect(getInvitationDetail(page)).toBeVisible();

    await getRefuseInvitationButton(page).click();

    // Refusing leaves the room, navigates away, and removes the invitation row.
    await page.waitForURL((url) => url.pathname === "/chat/new", {
      timeout: 30_000,
    });
    await expect(getInvitationDetail(page)).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: new RegExp(SEEDED_INVITE_NAME) }),
    ).toHaveCount(0, { timeout: 30_000 });
  });
});
