import { expect, test } from "./utils/fixtures";
import { matrixSessionKey, readMatrixSession } from "./utils/hub-session";
import { uniqueText } from "./utils/ids";
import { MatrixApi } from "./utils/matrix-api";
import {
  completeFirstMasSignIn,
  signInToHub,
  watchMasNavigations,
} from "./utils/oidc";
import { ChatPage } from "./utils/pages/chat-page";

/**
 * The only tests through the real OIDC chain: Hub → Keycloak, then the chat
 * through MAS → Keycloak. Every other test injects a Matrix session.
 */
test.describe("Real sign-in", () => {
  test("signs a new person in to the Hub and the chat", async ({
    page,
    people,
  }) => {
    const erin = await people.createNewcomer("Erin");

    await signInToHub(page, erin);
    // The chat sign-in starts on its own and reuses the Keycloak session.
    await completeFirstMasSignIn(page);

    const chat = new ChatPage(page, erin);
    await chat.leftPanel.expectReady();
    await expect(page).toHaveURL(/\/chat\/new$/);
    expect(new URL(page.url()).searchParams.has("code")).toBe(false);
    await expect(
      chat.leftPanel.allChats.getByRole("link", { name: "New chat" }),
    ).toBeVisible();

    const session = await readMatrixSession(page, erin);
    expect(session?.mxId).toBe(erin.userId);
    expect(session?.refreshToken).toBeTruthy();
  });

  /**
   * E2E-19, scoped: an expired access token and an unknown one look the same
   * to the homeserver, so the stored one is replaced by a revoked value
   * instead of waiting for MAS's 5-minute lifetime.
   */
  test("refreshes an expired access token without signing in again", async ({
    page,
    people,
  }) => {
    const erin = await people.createNewcomer("Erin");
    const bob = await people.create("Bob");
    await signInToHub(page, erin);
    await completeFirstMasSignIn(page);
    const chat = new ChatPage(page, erin);
    await chat.leftPanel.expectReady();
    const signedIn = (await readMatrixSession(page, erin))!;

    await page.evaluate(
      ({ key, session }) =>
        window.localStorage.setItem(
          key,
          JSON.stringify({ ...session, accessToken: "mat_expired_token" }),
        ),
      { key: matrixSessionKey(erin), session: signedIn },
    );
    const masPages = watchMasNavigations(page);
    await chat.reload();

    await test.step("the session goes on with rotated tokens", async () => {
      await expect
        .poll(async () => (await readMatrixSession(page, erin))?.accessToken)
        .not.toBe("mat_expired_token");
      const refreshed = (await readMatrixSession(page, erin))!;
      expect(refreshed.deviceId).toBe(signedIn.deviceId);
      expect(refreshed.refreshToken).not.toBe(signedIn.refreshToken);
      expect(masPages).toEqual([]);
    });

    await test.step("the refreshed session syncs and sends", async () => {
      const roomId = await bob.api.createRoom({
        invite: [erin.userId],
        isDirect: true,
      });
      await chat.leftPanel.expectConversation(bob.displayName);
      await chat.leftPanel.open(bob.displayName);
      await chat.page.getByRole("button", { name: "Accept" }).click();
      const text = uniqueText("After refresh");
      await chat.composer.send(text);
      await bob.api.waitForText(roomId, text);
    });

    await test.step("the rotated tokens survive a reload", async () => {
      await chat.reload();
      await chat.leftPanel.expectConversation(bob.displayName);
      const stored = (await readMatrixSession(page, erin))!;
      const whoami = await new MatrixApi({
        userId: erin.userId,
        deviceId: stored.deviceId!,
        accessToken: stored.accessToken,
      }).request<{ user_id: string }>(
        "GET",
        "/_matrix/client/v3/account/whoami",
      );
      expect(whoami.user_id).toBe(erin.userId);
      expect(masPages).toEqual([]);
    });
  });
});
