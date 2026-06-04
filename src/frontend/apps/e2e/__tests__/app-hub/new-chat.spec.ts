import { expect, test } from "@playwright/test";

import {
  getChatBubbles,
  getChatComposerInput,
  getChatComposerSendButton,
  getChatScroller,
} from "./utils-chat-conversation";
import { setupAuthenticatedUser } from "./utils-auth";
import { waitForChatUrl } from "./utils-left-panel";
import {
  getCreateGroupButton,
  getNewChatSearchInput,
  getNewChatUserOption,
  getRemoveSelectedUserButton,
  getSelectedUserChip,
} from "./utils-new-chat";

const DIDIER_CHAT = {
  id: "a3f1b2c0-1d2e-4f5a-9c8b-7d6e5f4a3b2c",
  name: "Didier Salambo",
};

test.describe("New chat", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page);
    await page.goto("/chat/new");
  });

  test("starts on the placeholder and exposes people search", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "New chat" })).toBeVisible();
    await expect(page.getByText("Add people to get started")).toBeVisible();
    await expect(getNewChatSearchInput(page)).toBeVisible();
    await expect(getChatComposerInput(page)).toBeVisible();
  });

  test("shows an existing direct conversation after selecting its user", async ({
    page,
  }) => {
    await getNewChatSearchInput(page).fill("didier");
    await expect(getNewChatUserOption(page, "Didier Salambo")).toBeVisible();

    await getNewChatUserOption(page, "Didier Salambo").click();

    await expect(page).toHaveURL(/\/chat\/new$/);
    await expect(getSelectedUserChip(page, "Didier Salambo")).toBeVisible();
    await expect(getChatBubbles(page).first()).toBeVisible();
    await expect(
      page
        .locator(".hub__new-chat-search__tool-selector")
        .getByRole("button", { name: "Threads", exact: true }),
    ).toBeVisible();
  });

  test("keeps the placeholder when the selected users have no conversation", async ({
    page,
  }) => {
    await getNewChatSearchInput(page).fill("amandine korsgaard");
    await expect(
      getNewChatUserOption(page, "Amandine Korsgaard"),
    ).toBeVisible();

    await getNewChatUserOption(page, "Amandine Korsgaard").click();

    await expect(getSelectedUserChip(page, "Amandine Korsgaard")).toBeVisible();
    await expect(page.getByText("Add people to get started")).toBeVisible();
    await expect(getChatBubbles(page)).toHaveCount(0);
  });

  test("resolves an existing group after adding another participant", async ({
    page,
  }) => {
    await getNewChatSearchInput(page).fill("amandine salambo");
    await expect(getNewChatUserOption(page, "Amandine Salambo")).toBeVisible();
    await getNewChatUserOption(page, "Amandine Salambo").click();

    await expect(page.getByText("Add people to get started")).toBeVisible();

    await getNewChatSearchInput(page).fill("daniel");
    await expect(getNewChatUserOption(page, "Daniel Ferioux")).toBeVisible();
    await getNewChatUserOption(page, "Daniel Ferioux").click();

    await expect(getSelectedUserChip(page, "Amandine Salambo")).toBeVisible();
    await expect(getSelectedUserChip(page, "Daniel Ferioux")).toBeVisible();
    await expect(getChatBubbles(page).first()).toBeVisible();
  });

  test("lets selected users be removed and leaves create group disabled", async ({
    page,
  }) => {
    await getNewChatSearchInput(page).fill("am");
    await expect(getCreateGroupButton(page)).toBeDisabled();

    await expect(getNewChatUserOption(page, "Amandine Salambo")).toBeVisible();
    await getNewChatUserOption(page, "Amandine Salambo").click();
    await expect(getSelectedUserChip(page, "Amandine Salambo")).toBeVisible();

    await getRemoveSelectedUserButton(page, "Amandine Salambo").click();
    await expect(getSelectedUserChip(page, "Amandine Salambo")).toHaveCount(0);
    await expect(page.getByText("Add people to get started")).toBeVisible();
  });

  test("adds the first suggestion when pressing Enter", async ({ page }) => {
    await getNewChatSearchInput(page).fill("am");
    await expect(getNewChatUserOption(page, "Amandine Aminoff")).toBeVisible();

    await getNewChatSearchInput(page).press("Enter");

    await expect(getSelectedUserChip(page, "Amandine Aminoff")).toBeVisible();
    await expect(page.locator(".hub__new-chat-dropdown")).toHaveCount(0);
  });

  test("arms then removes selected users with Backspace on an empty input", async ({
    page,
  }) => {
    await getNewChatSearchInput(page).fill("amandine aminoff");
    await expect(getNewChatUserOption(page, "Amandine Aminoff")).toBeVisible();
    await getNewChatSearchInput(page).press("Enter");
    await expect(getSelectedUserChip(page, "Amandine Aminoff")).toBeVisible();

    await getNewChatSearchInput(page).fill("berangere");
    await expect(getNewChatUserOption(page, "Bérangère Becker")).toBeVisible();
    await getNewChatSearchInput(page).press("Enter");
    await expect(getSelectedUserChip(page, "Bérangère Becker")).toBeVisible();

    // First Backspace arms the last chip without removing it.
    await getNewChatSearchInput(page).press("Backspace");
    await expect(getSelectedUserChip(page, "Bérangère Becker")).toHaveAttribute(
      "data-armed",
      "true",
    );
    await expect(getSelectedUserChip(page, "Amandine Aminoff")).toHaveAttribute(
      "data-armed",
      "false",
    );
    await expect(
      page.locator(".hub__new-chat-search__backspace-status"),
    ).toContainText("Press Backspace again to remove Bérangère Becker");

    // Second Backspace removes the armed chip.
    await getNewChatSearchInput(page).press("Backspace");
    await expect(getSelectedUserChip(page, "Bérangère Becker")).toHaveCount(0);
    await expect(getSelectedUserChip(page, "Amandine Aminoff")).toBeVisible();

    // The sequence repeats for the previous chip.
    await getNewChatSearchInput(page).press("Backspace");
    await expect(getSelectedUserChip(page, "Amandine Aminoff")).toHaveAttribute(
      "data-armed",
      "true",
    );
    await getNewChatSearchInput(page).press("Backspace");
    await expect(getSelectedUserChip(page, "Amandine Aminoff")).toHaveCount(0);
  });

  test("keeps chips intact when Backspace clears typed text", async ({
    page,
  }) => {
    await getNewChatSearchInput(page).fill("amandine aminoff");
    await expect(getNewChatUserOption(page, "Amandine Aminoff")).toBeVisible();
    await getNewChatSearchInput(page).press("Enter");
    await expect(getSelectedUserChip(page, "Amandine Aminoff")).toBeVisible();

    await getNewChatSearchInput(page).fill("x");
    await getNewChatSearchInput(page).press("Backspace");

    await expect(getNewChatSearchInput(page)).toHaveValue("");
    await expect(getSelectedUserChip(page, "Amandine Aminoff")).toBeVisible();
    await expect(getSelectedUserChip(page, "Amandine Aminoff")).toHaveAttribute(
      "data-armed",
      "false",
    );
  });

  test("navigates people search with the keyboard before selecting", async ({
    page,
  }) => {
    const input = getNewChatSearchInput(page);

    await input.fill("am");
    await expect(getNewChatUserOption(page, "Amandine Aminoff")).toBeVisible();
    await expect(input).toHaveAttribute("aria-expanded", "true");

    await input.press("ArrowDown");
    await input.press("ArrowDown");
    await input.press("Enter");

    await expect(getSelectedUserChip(page, "Amandine Korsgaard")).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("keeps search editable after previewing an existing conversation", async ({
    page,
  }) => {
    const input = getNewChatSearchInput(page);

    await input.fill("didier");
    await expect(getNewChatUserOption(page, "Didier Salambo")).toBeVisible();
    await input.press("Enter");

    await expect(getSelectedUserChip(page, "Didier Salambo")).toBeVisible();
    await expect(getChatBubbles(page).first()).toBeVisible();
    await expect(input).toBeFocused();

    await input.fill("berangere");
    await expect(getNewChatUserOption(page, "Bérangère Becker")).toBeVisible();
    await input.press("Enter");

    await expect(getSelectedUserChip(page, "Didier Salambo")).toBeVisible();
    await expect(getSelectedUserChip(page, "Bérangère Becker")).toBeVisible();
    await expect(getChatBubbles(page).first()).toBeVisible();
    await expect(page).toHaveURL(/\/chat\/new$/);
  });

  test("opens the existing conversation in place when sending from the search", async ({
    page,
  }) => {
    // Resolve Didier's existing conversation inline — the URL stays on
    // /chat/new until the user actually sends.
    await getNewChatSearchInput(page).fill("didier");
    await getNewChatUserOption(page, "Didier Salambo").click();
    await expect(getSelectedUserChip(page, "Didier Salambo")).toBeVisible();
    await expect(getChatBubbles(page).first()).toBeVisible();
    await expect(page).toHaveURL(/\/chat\/new$/);

    // Tag the virtualized scroller's DOM node: a remount during the redirect
    // would replace the node and drop the marker, so its survival proves the
    // conversation list stayed mounted (no flicker).
    await getChatScroller(page).evaluate((el) => {
      (el as HTMLElement).dataset.persistMarker = "kept";
    });

    await getChatComposerInput(page).fill("Opening you up");
    await getChatComposerSendButton(page).click();

    // The URL commits to the real conversation…
    await waitForChatUrl(page, DIDIER_CHAT.id);

    // …the sent message is visible…
    await expect(
      page.locator(".hub__chat-bubble--sent", { hasText: "Opening you up" }),
    ).toBeVisible();

    // …and the scroller is the very same DOM node (no remount, no skeleton).
    await expect(getChatScroller(page)).toHaveAttribute(
      "data-persist-marker",
      "kept",
    );
  });
});
