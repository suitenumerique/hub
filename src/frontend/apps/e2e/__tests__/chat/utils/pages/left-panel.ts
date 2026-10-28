import { expect, Locator, Page } from "@playwright/test";

import { CHAT_ACCOUNT_ID, SYNC_TIMEOUT } from "../env";

/**
 * A row, by its name, or by its room when the name is not stable (a group is
 * named after its members, in no guaranteed order).
 */
export type RowTarget = string | { roomId: string };

/** The side panel: quick actions and the conversation list. */
export class LeftPanel {
  readonly root: Locator;
  readonly newChatLink: Locator;
  readonly searchButton: Locator;
  readonly allChats: Locator;
  readonly favourites: Locator;

  constructor(readonly page: Page) {
    this.root = page.getByRole("complementary", { name: "Side panel" });
    const actions = this.root.getByRole("navigation", {
      name: "Quick actions",
    });
    this.newChatLink = actions.getByRole("link", { name: "New" });
    this.searchButton = actions.getByRole("button", { name: "Search" });
    this.allChats = this.root.getByRole("region", { name: "All chats" });
    this.favourites = this.root.getByRole("region", { name: "Favourites" });
  }

  /** Waits until the chat is connected and its list is shown. */
  async expectReady(): Promise<void> {
    await expect(this.allChats).toBeVisible({ timeout: SYNC_TIMEOUT });
  }

  /** Row of a conversation; a direct one is named after the other person. */
  conversation(target: RowTarget): Locator {
    if (typeof target === "string") {
      return this.root.getByRole("link", { name: target, exact: true });
    }
    const query = new URLSearchParams({
      account: CHAT_ACCOUNT_ID,
      chat: target.roomId,
    });
    return this.root.locator(`a[href="/chat?${query.toString()}"]`);
  }

  /** Every conversation row of "All chats", in display order. */
  rows(): Locator {
    return this.allChats.getByRole("listitem");
  }

  async open(target: RowTarget): Promise<void> {
    await this.conversation(target).click();
    await expect(this.conversation(target)).toHaveAttribute(
      "aria-current",
      "page",
    );
  }

  /** The quick access menu of a row, opened with a right click. */
  async openContextMenu(target: RowTarget): Promise<Locator> {
    await this.conversation(target).click({ button: "right" });
    const menu = this.page.getByRole("menu", { name: "Context menu" });
    await expect(menu).toBeVisible();
    return menu;
  }

  /** The "more" button of a row, shown while it is hovered or focused. */
  moreButton(name: string): Locator {
    return this.root.getByRole("button", {
      name: `More options for ${name}`,
      exact: true,
    });
  }

  /** The same quick access menu, from the "more" button of the row. */
  async openMoreMenu(name: string): Promise<Locator> {
    await this.conversation(name).hover();
    await this.moreButton(name).click();
    const menu = this.page.getByRole("menu");
    await expect(menu).toBeVisible();
    return menu;
  }

  async openNewChat(): Promise<void> {
    await this.newChatLink.click();
    await expect(this.page).toHaveURL(/\/chat\/new$/);
  }

  async expectConversation(target: RowTarget): Promise<void> {
    await expect(this.conversation(target)).toBeVisible({
      timeout: SYNC_TIMEOUT,
    });
  }

  async expectFavourite(name: string): Promise<void> {
    await expect(
      this.favourites.getByRole("link", { name, exact: true }),
    ).toBeVisible({ timeout: SYNC_TIMEOUT });
  }

  async expectNoConversation(target: RowTarget): Promise<void> {
    await expect(this.conversation(target)).toHaveCount(0, {
      timeout: SYNC_TIMEOUT,
    });
  }

  private dot(target: RowTarget): Locator {
    return this.conversation(target).locator(".hub__left-panel__chat__dot");
  }

  async expectUnread(target: RowTarget): Promise<void> {
    await expect(this.dot(target)).toHaveClass(
      /hub__left-panel__chat__dot--visible/,
      { timeout: SYNC_TIMEOUT },
    );
  }

  async expectRead(target: RowTarget): Promise<void> {
    await expect(this.dot(target)).not.toHaveClass(
      /hub__left-panel__chat__dot--visible/,
      { timeout: SYNC_TIMEOUT },
    );
  }

  /** The stronger dot of a mention. */
  async expectMention(target: RowTarget): Promise<void> {
    await expect(this.dot(target)).toHaveClass(
      /hub__left-panel__chat__dot--highlight/,
      { timeout: SYNC_TIMEOUT },
    );
  }

  /** The conversation is the first row: the most recently active one. */
  async expectFirst(name: string): Promise<void> {
    await expect(this.rows().first().getByRole("link")).toHaveAccessibleName(
      name,
      { timeout: SYNC_TIMEOUT },
    );
  }
}
