import { expect, Locator, Page } from "@playwright/test";

import { CHAT_ACCOUNT_ID, SYNC_TIMEOUT } from "../env";
import type { TestIdentity } from "../matrix-admin";
import { AccountMenu } from "./account-menu";
import { AttachmentPreview } from "./attachment-preview";
import { ChatHeader } from "./chat-header";
import { Composer } from "./composer";
import { EncryptionDialog } from "./encryption-dialog";
import { Invitation } from "./invitation";
import { LeftPanel, type RowTarget } from "./left-panel";
import { NewChat } from "./new-chat";
import { SearchDialog } from "./search-dialog";
import { ThreadsPanel } from "./threads-panel";
import { Timeline } from "./timeline";

/** URL of a conversation (`chatHref` in the Hub). */
export const chatPath = (roomId: string): string =>
  `/chat?account=${CHAT_ACCOUNT_ID}&chat=${encodeURIComponent(roomId)}`;

/**
 * The Hub chat of one person in one browser tab, split by area of the screen
 * so tests read like what the person does.
 */
export class ChatPage {
  readonly leftPanel: LeftPanel;
  readonly header: ChatHeader;
  readonly timeline: Timeline;
  readonly composer: Composer;
  readonly threads: ThreadsPanel;
  readonly newChat: NewChat;
  readonly search: SearchDialog;
  readonly encryption: EncryptionDialog;
  readonly accountMenu: AccountMenu;
  readonly invitation: Invitation;
  readonly preview: AttachmentPreview;
  /** "… is typing a message…", without the avatars. */
  readonly typingIndicator: Locator;

  constructor(
    readonly page: Page,
    readonly person: TestIdentity,
  ) {
    const main = page.locator(".hub__chat-view__main");
    this.leftPanel = new LeftPanel(page);
    this.header = new ChatHeader(page);
    this.timeline = new Timeline(
      page,
      main.locator(".hub__chat-view__content"),
    );
    this.composer = new Composer(main);
    this.threads = new ThreadsPanel(page);
    this.newChat = new NewChat(page);
    this.search = new SearchDialog(page);
    this.encryption = new EncryptionDialog(page);
    this.accountMenu = new AccountMenu(page);
    this.invitation = new Invitation(page);
    this.preview = new AttachmentPreview(page);
    this.typingIndicator = page.locator(".hub__typing-indicator__label");
  }

  /** Opens a page of the Hub and waits for the chat to be connected. */
  async goto(path = "/chat/new"): Promise<void> {
    await this.page.goto(path);
    await this.leftPanel.expectReady();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.leftPanel.expectReady();
  }

  /** Opens a conversation from the side panel. */
  async openConversation(target: RowTarget): Promise<void> {
    await this.leftPanel.expectConversation(target);
    await this.leftPanel.open(target);
    if (typeof target === "string") await this.header.expectTitle(target);
  }

  /** Opens a conversation by its URL. */
  async gotoConversation(roomId: string): Promise<void> {
    await this.goto(chatPath(roomId));
  }

  /** Room id of the open conversation, from the URL. */
  currentRoomId(): string | null {
    return new URL(this.page.url()).searchParams.get("chat");
  }

  async expectConversationUrl(roomId?: string): Promise<string> {
    await expect(this.page).toHaveURL(/\/chat\?account=.+&chat=.+/, {
      timeout: SYNC_TIMEOUT,
    });
    const current = this.currentRoomId()!;
    if (roomId) expect(current).toBe(roomId);
    return current;
  }

  /**
   * Messages are marked read only while the page is visible and focused.
   * Acting in another person's browser takes the focus away from this one.
   */
  async focus(): Promise<void> {
    await this.page.bringToFront();
  }

  /** The person reads the open conversation, which then shows as read. */
  async readOpenConversation(target: RowTarget): Promise<void> {
    await this.focus();
    await this.leftPanel.expectRead(target);
  }
}
