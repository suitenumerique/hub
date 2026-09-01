import {
  ClientEvent,
  EventTimeline,
  EventStatus,
  EventType,
  type IRoomTimelineData,
  KnownMembership,
  MatrixError,
  type MatrixClient,
  type MatrixEvent,
  MatrixEventEvent,
  MsgType,
  Preset,
  ReceiptType,
  RelationType,
  type Room,
  RoomEvent,
  type RoomMember,
  RoomMemberEvent,
  RoomStateEvent,
  SyncState,
  type SyncStateData,
  type Thread,
  ThreadEvent,
} from "matrix-js-sdk/lib/matrix";
import { HttpApiEvent } from "matrix-js-sdk/lib/http-api";
import { TimelineWindow } from "matrix-js-sdk/lib/timeline-window";
import {
  type ReactionEventContent,
  type RoomMessageEventContent,
} from "matrix-js-sdk/lib/types";

import { type IdTokenClaims } from "oidc-client-ts";

import { emojiToCodepoints } from "@/features/chat/fluentEmoji";
import { toggleReaction } from "@/features/chat/reactions";
import {
  MATRIX_LOCAL_SETTINGS,
  type MatrixDriverSettings,
  parseMatrixDriverSettings,
} from "@/features/matrix/config";
import { initClient, startClient } from "@/features/matrix/initMatrix";
import { MatrixUserInterface } from "@/features/matrix/types";
import {
  buildOidcTokenRefreshFunction,
  completeOidcLogin,
  getOIDCAuthUrl,
  getUserIdFromAccessToken,
} from "@/features/matrix/utils/auth";
import {
  AdvanceMainReadParams,
  ChatConnectionState,
  ChatEvent,
  ChatEventListener,
  ChatTypingListener,
  ChatUserFilters,
  DeleteChatMessageParams,
  Driver,
  EditChatMessageParams,
  GetChatThreadParams,
  MarkChatReadResult,
  MarkChatThreadReadParams,
  OpenChatMessageWindowParams,
  PaginateChatMessageWindowParams,
  RemoveChatFromHistoryResult,
  SendChatMessageParams,
  SendChatTypingParams,
  SendChatThreadReplyParams,
  StartChatThreadParams,
  ToggleChatReactionParams,
  ToggleChatThreadReactionParams,
} from "../Driver";
import {
  AccountId,
  ChatLocalUser,
  ChatMessage,
  ChatMember,
  ChatMembers,
  ChatMessageWindow,
  ChatThread,
  ChatThreadDetail,
  ChatThreadMutationResult,
  ChatTypingUser,
  ChatUnread,
  ChatUser,
  LocalChat,
  LocalChatSections,
  User,
} from "../types";
import {
  authorForSender,
  buildAuthors,
  fetchReactionSnapshot,
  forgetThreadReply,
  getThreadReplyCounter,
  isMainTimelineMessage,
  isMessageEvent,
  isOwnEcho,
  matrixEventToChatMessage,
  observeThreadReply,
  ownReactionEvents,
  reactionUpdateEventsForTarget,
  receiptMentionsUser,
  reconcileMessageReactions,
  rememberThreadReplyCount,
  roomUnread,
  SELF_AUTHOR_ID,
  sendResponseToChatMessage,
  sortedThreadReplyEvents,
  threadReplyCount,
  threadReplyEventKey,
  threadToChatThread,
  threadToChatThreadDetail,
  timelineEventToChatEvent,
} from "./matrixEventMapping";
import { matrixDirectoryUserToChatUser } from "./matrixIdentity";
import {
  isFavouriteRoom,
  MATRIX_FAVOURITE_TAG,
  matrixJoinedRoomToLocalChat,
  matrixRoomToLocalChat,
  participantSetKey,
  roomOtherMembers,
} from "./matrixRoomMapping";
/** Matches Matrix pagination requests; the homeserver may clamp it lower. */
const DEFAULT_CHAT_PAGE_SIZE = 50;
const INITIAL_TIMELINE_WINDOW_SIZE = 30;
const MAX_TIMELINE_WINDOW_SIZE = 1000;
const MATRIX_TYPING_TIMEOUT_MS = 30_000;

// A generous fetch limit is requested from the user directory and the filtered
// list sliced to a small display count, so removing self/excluded never starves
// the New Chat dropdown.
const PEOPLE_SEARCH_FETCH_LIMIT = 20;
const PEOPLE_SEARCH_DISPLAY_LIMIT = 8;

// localStorage keys owned by this driver. Token persistence lives in the
// driver itself — there is no separate store module; everything else flows
// through React Query.
const STORAGE = {
  user: "matrixUser",
  // Everything needed to refresh the OIDC access token on a later page load.
  oidc: "matrixOidc",
  oidcState: "oidc_state",
  redactedThreads: "matrixRedactedThreads",
} as const;

/** OIDC session data persisted so tokens can be refreshed after a reload. */
type StoredOidc = {
  clientId: string;
  issuer: string;
  idToken: string;
  idTokenClaims: IdTokenClaims;
  redirectUri: string;
};
const SYNC_STORE_DB_NAME = "matrix-web-sync-store";
const CRYPTO_STORE_DB_NAME = "crypto-store";

const storageKey = (
  accountId: AccountId,
  key: string,
  owner?: string | null,
): string => {
  const ownedKey = owner ? `${key}:${owner}` : key;
  return accountId === "default" ? ownedKey : `${ownedKey}:${accountId}`;
};

const isMatrixSessionInvalidError = (error: unknown): boolean => {
  if (!(error instanceof MatrixError)) {
    return false;
  }
  return (
    error.errcode === "M_UNKNOWN_TOKEN" ||
    error.httpStatus === 401 ||
    (error.httpStatus === 503 &&
      /introspect the access token/i.test(error.message))
  );
};

const isRecoverableMatrixPaginationError = (error: unknown): boolean => {
  if (!(error instanceof MatrixError) || isMatrixSessionInvalidError(error)) {
    return false;
  }
  return error.httpStatus === 403 || error.httpStatus === 404;
};

const toChatUser = (user: MatrixUserInterface): ChatLocalUser => ({
  userId: user.mxId,
  accessToken: user.accessToken,
  refreshToken: user.refreshToken,
});

const toChatMember = (member: RoomMember): ChatMember => ({
  id: member.userId,
  name: member.name || member.userId,
  secondaryText: member.userId,
});

const sortChatMembers = (
  members: ChatMember[],
  currentUserId: string | undefined,
): ChatMember[] =>
  members.toSorted((left, right) => {
    const leftIsCurrent = left.id === currentUserId;
    const rightIsCurrent = right.id === currentUserId;
    if (leftIsCurrent !== rightIsCurrent) {
      return leftIsCurrent ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

type RedactedThreadReply = {
  chatId: string;
  threadId: string;
  eventId: string;
  rootEvent: MatrixEvent;
  event: MatrixEvent;
  /** Filled once RoomEvent.Redaction has applied the tombstone shape. */
  message?: ChatMessage;
};

type PersistedRedactedThreadReply = Pick<
  RedactedThreadReply,
  "chatId" | "threadId" | "eventId"
> & { rootEventId: string };

type TimelineDirection = "older" | "newer";
type TimelineEventOrdering = "before" | "same" | "after" | "unknown";
type MessageWindowGeneration = {
  generation: number;
  windowId: string;
  readMarkerEventId: string | null;
  exhausted: Set<TimelineDirection>;
  atLiveEnd: boolean;
};
type MessageWindowSession = {
  client: MatrixClient;
  room: Room;
  window: TimelineWindow;
  requestedGeneration: number;
  current: MessageWindowGeneration | null;
  operation: Promise<void>;
};

/**
 * Matrix-backed chat driver. All Matrix specifics — the OIDC handshake, client
 * bootstrap and `/sync` long-polling — live here, behind the generic `Driver`
 * contract, so the UI never imports anything Matrix.
 *
 * Rooms, messages, unread state, threads, and reactions are Matrix-backed,
 * while `/sync` is bridged onto the generic real-time event stream.
 */
export class MatrixDriver extends Driver {
  override readonly supportsComposition: boolean = true;
  override readonly supportsThreadComposition: boolean = true;
  override readonly supportsConversationHistoryRemoval: boolean = true;
  override readonly supportsConversationCreation: boolean = true;

  private mx: MatrixClient | null = null;
  /** Subscribers to the single global event stream. */
  private eventListeners = new Set<ChatEventListener>();
  /** Per-room subscribers to volatile typing state (never persisted/cached). */
  private typingListeners = new Map<string, Set<ChatTypingListener>>();
  private typingSignatures = new Map<string, string>();
  private typingRoomPreparations = new Map<string, Promise<void>>();
  /** Server ids sent by this driver, used to pair local and remote echoes. */
  private sentThreadReplyEventIds = new Set<string>();
  /**
   * Matrix redaction strips `m.thread`, so the SDK moves a deleted reply onto
   * the main timeline and can delete the Thread object entirely. Preserve the
   * association for this client session: it keeps the tombstone in an already
   * opened thread and prevents it leaking into the room timeline.
   */
  private redactedThreadReplies = new Map<string, RedactedThreadReply>();
  /** Persisted reply identities, even before their thread root is hydrated. */
  private redactedThreadReplyKeys = new Set<string>();
  /** Detaches the Matrix `/sync` listeners; set when the client is bootstrapped. */
  private detachSync: () => void = () => {};
  /** Parsed per-account config; source of truth for the fixed server and OIDC. */
  private readonly settings: MatrixDriverSettings;
  /**
   * Server-confirmed joined rooms. `getVisibleRooms()` can include stale rooms
   * restored from IndexedDB after the local homeserver was reset.
   */
  private joinedRoomIds: Set<string> | null = null;
  /**
   * Storage namespace for the Hub/Matrix login context currently being
   * connected. `matrix-local` may be used by several seeded users in the same
   * browser, so credentials must not be keyed only by account id.
   */
  private storageOwner: string | null = null;
  /** One SDK timeline window per room/client; only its snapshots cross Driver. */
  private messageWindowSessions = new Map<string, MessageWindowSession>();
  private nextMessageWindowGeneration = 0;
  /** Serializes per-room read writes so stale requests cannot win a race. */
  private mainReadMarkerQueues = new Map<string, Promise<MarkChatReadResult>>();
  /**
   * Successful local markers waiting for their room account-data echo. They
   * stay authoritative over a delayed echo of an older `m.fully_read`.
   */
  private pendingMainFullyRead = new Map<string, string>();

  constructor(
    accountId: AccountId = "matrix-local",
    settings: Record<string, unknown> = MATRIX_LOCAL_SETTINGS,
  ) {
    super(accountId);
    this.settings = parseMatrixDriverSettings(settings);
  }

  /**
   * Resolves the OIDC `login_hint` from account config, then the authenticated
   * Hub user's email.
   */
  private resolveLoginHint(user: User | null | undefined): string {
    if (this.settings.loginHint) {
      return this.settings.loginHint;
    }
    return user?.email ?? "";
  }

  async getChats(): Promise<LocalChatSections> {
    const mx = this.mx;
    if (!mx) {
      return {
        favourites: [],
        all: [],
      };
    }
    // Joined conversations (server-confirmed, so stale rooms restored from
    // IndexedDB after a homeserver reset don't linger) plus pending incoming
    // invitations, which aren't in `/joined_rooms` and are surfaced by their
    // membership instead.
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    const currentUserId = mx.getUserId() ?? undefined;
    const localChats = mx
      .getVisibleRooms()
      .filter(
        (room) =>
          joinedRoomIds.has(room.roomId) ||
          room.getMyMembership() === KnownMembership.Invite,
      )
      .map((room) =>
        joinedRoomIds.has(room.roomId)
          ? matrixJoinedRoomToLocalChat(room, currentUserId)
          : matrixRoomToLocalChat(room, currentUserId),
      );

    return {
      favourites: localChats.filter((chat) => chat.section === "favourites"),
      all: localChats.filter((chat) => chat.section === "all"),
    };
  }

  /** Initial read-state snapshot for server-confirmed joined rooms. */
  async getUnread(): Promise<Record<string, ChatUnread>> {
    const mx = this.mx;
    if (!mx) {
      return {};
    }
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    const selfUserId = mx.getUserId() ?? undefined;
    return Object.fromEntries(
      mx
        .getVisibleRooms()
        .filter((room) => joinedRoomIds.has(room.roomId))
        .map((room) => [room.roomId, this.unreadSnapshot(room, selfUserId)]),
    );
  }

  async getChat(chatId: string): Promise<LocalChat> {
    const { mx, room } = this.requireRoom("getChat", chatId);
    // A joined room (server-confirmed) or a pending invitation is addressable;
    // anything else (left/banned) is not.
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    if (
      !joinedRoomIds.has(chatId) &&
      room.getMyMembership() !== KnownMembership.Invite
    ) {
      throw new Error(`MatrixDriver.getChat: room "${chatId}" is not joined.`);
    }
    const currentUserId = mx.getUserId() ?? undefined;
    return joinedRoomIds.has(chatId)
      ? matrixJoinedRoomToLocalChat(room, currentUserId)
      : matrixRoomToLocalChat(room, currentUserId);
  }

  async getChatMembers(chatId: string): Promise<ChatMembers> {
    const { mx, room } = this.requireRoom("getChatMembers", chatId);
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    if (!joinedRoomIds.has(chatId)) {
      throw new Error(
        `MatrixDriver.getChatMembers: room "${chatId}" is not joined.`,
      );
    }
    await room.loadMembersIfNeeded();
    const currentUserId = mx.getUserId() ?? undefined;
    const members = room.getMembers();

    return {
      present: sortChatMembers(
        members
          .filter((member) => member.membership === KnownMembership.Join)
          .map(toChatMember),
        currentUserId,
      ),
      pendingInvites: sortChatMembers(
        members
          .filter((member) => member.membership === KnownMembership.Invite)
          .map(toChatMember),
        currentUserId,
      ),
    };
  }

  async setChatFavourite(chatId: string, favourite: boolean): Promise<void> {
    const { mx, room } = this.requireRoom("setChatFavourite", chatId);
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    if (!joinedRoomIds.has(chatId)) {
      throw new Error(
        `MatrixDriver.setChatFavourite: room "${chatId}" is not joined.`,
      );
    }
    if (isFavouriteRoom(room) === favourite) {
      return;
    }
    if (favourite) {
      await mx.setRoomTag(chatId, MATRIX_FAVOURITE_TAG, {});
      return;
    }
    await mx.deleteRoomTag(chatId, MATRIX_FAVOURITE_TAG);
  }

  /**
   * People available when composing a new chat, from the homeserver user
   * directory. The connected user and the already-selected participants
   * (`excludeIds`) are filtered out; an empty/whitespace term returns nothing
   * without hitting the network (the hook already gates on a non-empty query).
   */
  async getChatUsers(filters?: ChatUserFilters): Promise<ChatUser[]> {
    const mx = this.mx;
    const term = filters?.q?.trim() ?? "";
    if (!mx || term.length === 0) {
      return [];
    }
    const selfUserId = mx.getUserId() ?? undefined;
    const excluded = new Set(filters?.excludeIds ?? []);
    const { results } = await mx.searchUserDirectory({
      term,
      limit: PEOPLE_SEARCH_FETCH_LIMIT,
    });
    return results
      .filter(
        (user) => user.user_id !== selfUserId && !excluded.has(user.user_id),
      )
      .slice(0, PEOPLE_SEARCH_DISPLAY_LIMIT)
      .map(matrixDirectoryUserToChatUser);
  }

  /**
   * The existing conversation for exactly this participant set, or `null`. A
   * joined room matches when its members (excluding the connected user) equal
   * the requested Matrix ids — order- and duplicate-independent. One rule
   * serves both direct (one other member) and group (several) conversations.
   * `null` lets the UI keep the placeholder for a genuinely new conversation.
   */
  async getChatForUsers(userIds: string[]): Promise<LocalChat | null> {
    const mx = this.mx;
    if (!mx || userIds.length === 0) {
      return null;
    }
    const selfUserId = mx.getUserId() ?? undefined;
    const wanted = participantSetKey(userIds);
    // Gate on the server-confirmed joined set (like getChats/getChat/
    // openChatMessageWindow), not `getMyMembership()`: a stale room restored
    // from IndexedDB after a homeserver reset can still report membership
    // "join" locally, and must not resolve as an existing conversation (its
    // getChat would then throw "not joined" and block creating a fresh one).
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    const match = mx
      .getVisibleRooms()
      .filter((room) => joinedRoomIds.has(room.roomId))
      .find(
        (room) =>
          participantSetKey(
            roomOtherMembers(room, selfUserId).map((member) => member.userId),
          ) === wanted,
      );
    return match ? matrixRoomToLocalChat(match, selfUserId) : null;
  }

  /**
   * Starts a brand-new conversation for the given participants: a private room
   * with each one invited (a direct chat for a single participant, a group for
   * several). Idempotent — a joined room already matching the set is returned
   * instead of creating a duplicate. Waits until the SDK knows the new room so
   * the returned chat id is immediately usable for the first send and the
   * navigation that follows.
   */
  async createChatForUsers(userIds: string[]): Promise<LocalChat> {
    const mx = this.requireClient("createChatForUsers");
    const participantIds = [...new Set(userIds)].filter(Boolean);
    if (participantIds.length === 0) {
      throw new Error(
        "MatrixDriver.createChatForUsers: at least one participant is required.",
      );
    }
    const existing = await this.getChatForUsers(participantIds);
    if (existing) {
      return existing;
    }

    const selfUserId = mx.getUserId() ?? undefined;
    const isDirect = participantIds.length === 1;
    const { room_id: roomId } = await mx.createRoom({
      preset: Preset.PrivateChat,
      is_direct: isDirect,
      invite: participantIds,
    });

    const room = await this.waitForRoom(mx, roomId);
    if (room) {
      return matrixRoomToLocalChat(room, selfUserId);
    }
    // Fallback if the room has not surfaced through /sync within the timeout: a
    // minimal chat built from what we already know, so the UI can navigate; the
    // real name/kind firm up once `getChat` reads the synced room.
    return {
      id: roomId,
      name: participantIds[0],
      section: "all",
      kind: isDirect ? "direct" : "group",
      participantIds,
      visual: isDirect
        ? { kind: "initials" }
        : { kind: "icon", icon: "groups" },
    };
  }

  /**
   * Resolves once the client knows `roomId` (or after `timeoutMs`). `createRoom`
   * returns before the room necessarily appears in the client's room list, so
   * this bridges that gap before the first send / navigation reads the room.
   */
  private waitForRoom(
    mx: MatrixClient,
    roomId: string,
    timeoutMs = 5000,
  ): Promise<Room | null> {
    const existing = mx.getRoom(roomId);
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise<Room | null>((resolve) => {
      const cleanup = () => {
        mx.off(ClientEvent.Room, onRoom);
        clearTimeout(timer);
      };
      const onRoom = (room: Room) => {
        if (room.roomId === roomId) {
          cleanup();
          resolve(room);
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve(mx.getRoom(roomId));
      }, timeoutMs);
      mx.on(ClientEvent.Room, onRoom);
    });
  }

  // --- Incoming invitations -----------------------------------------------
  // Accept joins the room and maps it as a joined conversation; refuse leaves
  // it. Both drop the cached joined-room set and emit `chats:changed` so the
  // list reflects the change at once, alongside the `RoomEvent.MyMembership`
  // bridge (see {@link bootstrapClient}).

  /**
   * Accepts an incoming invitation by joining its room, then maps the result as
   * a joined conversation so the open route can switch from the invitation
   * detail view to the normal timeline. Mapped through
   * {@link matrixJoinedRoomToLocalChat} directly (not the membership-branching
   * mapper) so the returned chat is `membership: "join"` even before `/sync` has
   * flipped the local membership.
   */
  async acceptChatInvitation(chatId: string): Promise<LocalChat> {
    const mx = this.requireClient("acceptChatInvitation");
    await mx.joinRoom(chatId);
    // Drop the cached joined set so the first `openChatMessageWindow`
    // re-reads `/joined_rooms` and sees the room as joined (it isn't in the
    // stale cache captured while the room was still an invite).
    this.joinedRoomIds = null;
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(
        `MatrixDriver.acceptChatInvitation: room "${chatId}" not found after join.`,
      );
    }
    this.emit({ type: "chats:changed" });
    return matrixJoinedRoomToLocalChat(room, mx.getUserId() ?? undefined);
  }

  /** Refuses an incoming invitation by leaving its room. */
  async refuseChatInvitation(chatId: string): Promise<void> {
    const mx = this.requireClient("refuseChatInvitation");
    await mx.leave(chatId);
    this.joinedRoomIds = null;
    this.emit({ type: "chats:changed" });
  }

  /**
   * Leaves a joined room, then forgets it for the connected account. Retrying
   * after a partial failure skips the already-completed leave and only calls
   * `/forget` again.
   */
  async removeChatFromHistory(
    chatId: string,
  ): Promise<RemoveChatFromHistoryResult> {
    const mx = this.requireClient("removeChatFromHistory");
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    if (joinedRoomIds.has(chatId)) {
      await mx.leave(chatId);
      this.joinedRoomIds = null;
      this.emit({ type: "chats:changed" });
    }

    const automaticallyForgotten =
      mx.getCachedCapabilities()?.["m.forget_forced_upon_leave"]?.enabled ===
      true;
    if (automaticallyForgotten) {
      return { status: "forgotten" };
    }

    try {
      await mx.forget(chatId);
      return { status: "forgotten" };
    } catch (cause) {
      return { status: "left_only", cause };
    }
  }

  private redactedThreadReplyKey(chatId: string, eventId: string): string {
    return `${chatId}\u0000${eventId}`;
  }

  private isRedactedThreadReply(chatId: string, event: MatrixEvent): boolean {
    const eventId = event.getId();
    return Boolean(
      eventId &&
      this.redactedThreadReplyKeys.has(
        this.redactedThreadReplyKey(chatId, eventId),
      ),
    );
  }

  private redactedRepliesForThread(
    chatId: string,
    threadId: string,
  ): Array<RedactedThreadReply & { message: ChatMessage }> {
    return [...this.redactedThreadReplies.values()].filter(
      (
        reply,
      ): reply is RedactedThreadReply & {
        message: ChatMessage;
      } =>
        reply.chatId === chatId &&
        reply.threadId === threadId &&
        reply.message !== undefined,
    );
  }

  private persistRedactedThreadReplies(removed?: {
    chatId: string;
    eventId: string;
  }): void {
    // Some persisted replies may not be hydrated in the SDK's current timeline
    // window yet. Merge instead of rebuilding from the in-memory overlay so a
    // later redaction cannot silently discard those older associations.
    const stored = this.readStoredJson<PersistedRedactedThreadReply[]>(
      STORAGE.redactedThreads,
    );
    const entriesByKey = new Map<string, PersistedRedactedThreadReply>();
    if (Array.isArray(stored)) {
      stored.forEach((entry) => {
        if (
          typeof entry?.chatId === "string" &&
          typeof entry.threadId === "string" &&
          typeof entry.eventId === "string" &&
          typeof entry.rootEventId === "string"
        ) {
          entriesByKey.set(
            this.redactedThreadReplyKey(entry.chatId, entry.eventId),
            entry,
          );
        }
      });
    }
    if (removed) {
      const removedKey = this.redactedThreadReplyKey(
        removed.chatId,
        removed.eventId,
      );
      entriesByKey.delete(removedKey);
      this.redactedThreadReplyKeys.delete(removedKey);
    }
    this.redactedThreadReplies.forEach((reply) => {
      entriesByKey.set(
        this.redactedThreadReplyKey(reply.chatId, reply.eventId),
        {
          chatId: reply.chatId,
          threadId: reply.threadId,
          eventId: reply.eventId,
          rootEventId: reply.rootEvent.getId() ?? reply.threadId,
        },
      );
    });
    this.redactedThreadReplyKeys = new Set(entriesByKey.keys());
    this.writeStoredJson(STORAGE.redactedThreads, [...entriesByKey.values()]);
  }

  private restoreRedactedThreadReplies(mx: MatrixClient): void {
    const entries = this.readStoredJson<PersistedRedactedThreadReply[]>(
      STORAGE.redactedThreads,
    );
    if (!Array.isArray(entries)) {
      return;
    }
    const selfUserId = mx.getUserId() ?? undefined;
    entries.forEach((entry) => {
      if (
        typeof entry?.chatId !== "string" ||
        typeof entry.eventId !== "string" ||
        typeof entry.rootEventId !== "string"
      ) {
        return;
      }
      const replyKey = this.redactedThreadReplyKey(entry.chatId, entry.eventId);
      this.redactedThreadReplyKeys.add(replyKey);
      const room = mx.getRoom(entry.chatId);
      const event = room?.findEventById(entry.eventId);
      const rootEvent = room?.findEventById(entry.rootEventId);
      if (!room || !event || !rootEvent) {
        return;
      }
      this.redactedThreadReplies.set(replyKey, {
        ...entry,
        rootEvent,
        event,
        message: matrixEventToChatMessage(event, room, selfUserId),
      });
    });
  }

  private messageWithThreadOverlay(
    room: Room,
    event: MatrixEvent,
    selfUserId: string | undefined,
  ): ChatMessage {
    const mappedMessage = matrixEventToChatMessage(event, room, selfUserId);
    const message = event.status
      ? { ...mappedMessage, isPending: true }
      : mappedMessage;
    const eventId = event.getId();
    if (!eventId) {
      return message;
    }
    const redactedReplies = this.redactedRepliesForThread(room.roomId, eventId);
    if (redactedReplies.length === 0) {
      return message;
    }
    const activeThread = room.getThread(eventId);
    const activeReplyIds = new Set(
      activeThread
        ? sortedThreadReplyEvents(activeThread).map((reply) => reply.getId())
        : [],
    );
    const missingTombstones = redactedReplies.filter(
      ({ eventId: replyId }) => !activeReplyIds.has(replyId),
    ).length;
    return {
      ...message,
      thread: {
        id: eventId,
        replyCount:
          (activeThread ? threadReplyCount(activeThread) : 0) +
          missingTombstones,
        unreadCount: message.thread?.unreadCount ?? 0,
      },
    };
  }

  private getMessageWindowSession(
    mx: MatrixClient,
    room: Room,
  ): MessageWindowSession {
    const existing = this.messageWindowSessions.get(room.roomId);
    if (existing?.client === mx && existing.room === room) {
      return existing;
    }
    const session: MessageWindowSession = {
      client: mx,
      room,
      window: new TimelineWindow(mx, room.getUnfilteredTimelineSet(), {
        windowLimit: MAX_TIMELINE_WINDOW_SIZE,
      }),
      requestedGeneration: 0,
      current: null,
      operation: Promise.resolve(),
    };
    this.messageWindowSessions.set(room.roomId, session);
    return session;
  }

  private serializeMessageWindowOperation<T>(
    session: MessageWindowSession,
    operation: () => Promise<T>,
  ): Promise<T> {
    const request = session.operation.then(operation, operation);
    session.operation = request.then(
      () => undefined,
      () => undefined,
    );
    return request;
  }

  private visibleMessageEvents(
    chatId: string,
    rawEvents: MatrixEvent[],
  ): Array<{ event: MatrixEvent; rawIndex: number }> {
    const seen = new Set<string>();
    return rawEvents.flatMap((event, rawIndex) => {
      const eventId = event.getId();
      if (
        !eventId ||
        seen.has(eventId) ||
        (event.status && event.status !== EventStatus.SENT) ||
        !isMainTimelineMessage(event) ||
        this.isRedactedThreadReply(chatId, event)
      ) {
        return [];
      }
      seen.add(eventId);
      return [{ event, rawIndex }];
    });
  }

  private async snapshotMessageWindow(
    session: MessageWindowSession,
    generation: MessageWindowGeneration,
  ): Promise<ChatMessageWindow> {
    const { client: mx, room, window } = session;
    const rawEvents = window.getEvents();
    const visibleEvents = this.visibleMessageEvents(room.roomId, rawEvents);
    const pageEvents = visibleEvents.map(({ event }) => event);
    const selfUserId = mx.getUserId() ?? undefined;
    const mappedMessages = pageEvents.map((event) =>
      this.messageWithThreadOverlay(room, event, selfUserId),
    );
    const messages = await Promise.all(
      mappedMessages.map((message, index) =>
        reconcileMessageReactions(
          mx,
          room,
          pageEvents[index],
          message,
          selfUserId,
        ),
      ),
    );
    const markerRawIndex = generation.readMarkerEventId
      ? rawEvents.findIndex(
          (event) => event.getId() === generation.readMarkerEventId,
        )
      : -1;
    const matrixOlder = EventTimeline.BACKWARDS;
    const matrixNewer = EventTimeline.FORWARDS;
    const hasOlder =
      !generation.exhausted.has("older") && window.canPaginate(matrixOlder);
    const hasNewer =
      !generation.exhausted.has("newer") && window.canPaginate(matrixNewer);
    generation.atLiveEnd = !hasNewer;
    const markerInsertionIndex =
      markerRawIndex >= 0
        ? visibleEvents.filter(({ rawIndex }) => rawIndex <= markerRawIndex)
            .length
        : -1;
    return {
      windowId: generation.windowId,
      messages,
      authors: buildAuthors(room, pageEvents, selfUserId),
      readMarker:
        generation.readMarkerEventId &&
        markerInsertionIndex >= 0
          ? {
              eventId: generation.readMarkerEventId,
              insertionIndex: markerInsertionIndex,
            }
          : null,
      hasOlder,
      hasNewer,
    };
  }

  async openChatMessageWindow({
    chatId,
    anchorEventId,
    readMarkerEventId,
    limit = INITIAL_TIMELINE_WINDOW_SIZE,
  }: OpenChatMessageWindowParams): Promise<ChatMessageWindow> {
    const mx = this.requireClient("openChatMessageWindow");
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    if (!joinedRoomIds.has(chatId)) {
      throw new Error(
        `MatrixDriver.openChatMessageWindow: room "${chatId}" is not joined.`,
      );
    }
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(
        `MatrixDriver.openChatMessageWindow: room "${chatId}" not found.`,
      );
    }
    const session = this.getMessageWindowSession(mx, room);
    const generationNumber = this.nextMessageWindowGeneration + 1;
    this.nextMessageWindowGeneration = generationNumber;
    session.requestedGeneration = generationNumber;
    const generation: MessageWindowGeneration = {
      generation: generationNumber,
      windowId: `${this.accountId}:${chatId}:${generationNumber}`,
      readMarkerEventId,
      exhausted: new Set(),
      atLiveEnd: anchorEventId === undefined,
    };
    const windowSize = Math.min(MAX_TIMELINE_WINDOW_SIZE, Math.max(1, limit));
    return this.serializeMessageWindowOperation(session, async () => {
      const previousGeneration = session.current;
      session.current = generation;
      try {
        await session.window.load(anchorEventId, windowSize);
      } catch (error) {
        if (
          session.current === generation &&
          session.requestedGeneration === generation.generation
        ) {
          session.current = previousGeneration;
          session.requestedGeneration = previousGeneration?.generation ?? 0;
        }
        throw error;
      }
      if (
        this.mx !== mx ||
        this.messageWindowSessions.get(chatId) !== session
      ) {
        throw new Error(
          "MatrixDriver.openChatMessageWindow: the Matrix client changed during the request.",
        );
      }
      this.restoreRedactedThreadReplies(mx);
      return this.snapshotMessageWindow(session, generation);
    });
  }

  async paginateChatMessageWindow({
    chatId,
    windowId,
    direction,
    limit = DEFAULT_CHAT_PAGE_SIZE,
  }: PaginateChatMessageWindowParams): Promise<ChatMessageWindow | null> {
    const mx = this.requireClient("paginateChatMessageWindow");
    const session = this.messageWindowSessions.get(chatId);
    const generation = session?.current;
    if (
      !session ||
      session.client !== mx ||
      !generation ||
      generation.windowId !== windowId ||
      session.requestedGeneration !== generation.generation
    ) {
      return null;
    }
    return this.serializeMessageWindowOperation(session, async () => {
      if (
        this.mx !== mx ||
        session.current !== generation ||
        session.requestedGeneration !== generation.generation ||
        generation.windowId !== windowId
      ) {
        return null;
      }
      const matrixDirection =
        direction === "older"
          ? EventTimeline.BACKWARDS
          : EventTimeline.FORWARDS;
      if (
        !generation.exhausted.has(direction) &&
        session.window.canPaginate(matrixDirection)
      ) {
        try {
          const advanced = await session.window.paginate(
            matrixDirection,
            Math.min(MAX_TIMELINE_WINDOW_SIZE, Math.max(1, limit)),
          );
          if (!advanced) {
            generation.exhausted.add(direction);
          }
        } catch (error) {
          if (!isRecoverableMatrixPaginationError(error)) {
            throw error;
          }
          generation.exhausted.add(direction);
        }
        this.restoreRedactedThreadReplies(mx);
      }
      if (
        this.mx !== mx ||
        session.current !== generation ||
        session.requestedGeneration !== generation.generation
      ) {
        return null;
      }
      const snapshot = await this.snapshotMessageWindow(session, generation);
      return session.current === generation &&
        session.requestedGeneration === generation.generation
        ? snapshot
        : null;
    });
  }

  /** Latest public/private receipt scoped to the room main timeline. */
  private latestMainReadReceiptId(room: Room, userId: string): string | null {
    const receipts = [
      room.getReadReceiptForUserId(userId, false, ReceiptType.Read),
      room.getReadReceiptForUserId(userId, false, ReceiptType.ReadPrivate),
    ].flatMap((receipt) => {
      if (
        !receipt ||
        (receipt.data.thread_id && receipt.data.thread_id !== "main")
      ) {
        return [];
      }
      const event = room.findEventById(receipt.eventId);
      return !event || !event.threadRootId || event.isThreadRoot
        ? [receipt]
        : [];
    });
    return (
      receipts.reduce<(typeof receipts)[number] | null>((latest, candidate) => {
        if (!latest) {
          return candidate;
        }
        const ordering = room.compareEventOrdering(
          latest.eventId,
          candidate.eventId,
        );
        if (ordering === null) {
          return candidate.data.ts > latest.data.ts ? candidate : latest;
        }
        return ordering < 0 ? candidate : latest;
      }, null)?.eventId ?? null
    );
  }

  private mainReadReceiptIds(room: Room, userId: string): string[] {
    return [ReceiptType.Read, ReceiptType.ReadPrivate]
      .flatMap((receiptType) => {
        const receipt = room.getReadReceiptForUserId(
          userId,
          false,
          receiptType,
        );
        return receipt &&
          (!receipt.data.thread_id || receipt.data.thread_id === "main")
          ? [receipt.eventId]
          : [];
      })
      .filter((eventId, index, all) => all.indexOf(eventId) === index);
  }

  private async compareTimelineEventOrdering(
    mx: MatrixClient,
    room: Room,
    leftEventId: string,
    rightEventId: string,
  ): Promise<TimelineEventOrdering> {
    if (leftEventId === rightEventId) {
      return "same";
    }

    const timelineSet = room.getUnfilteredTimelineSet();
    for (const eventId of [leftEventId, rightEventId]) {
      if (timelineSet.findEventById(eventId)) {
        continue;
      }
      try {
        const timeline = await mx.getEventTimeline(timelineSet, eventId);
        if (!timeline || this.mx !== mx) {
          return "unknown";
        }
        this.restoreRedactedThreadReplies(mx);
      } catch (error) {
        if (isRecoverableMatrixPaginationError(error)) {
          return "unknown";
        }
        throw error;
      }
    }

    const ordering = room.compareEventOrdering(leftEventId, rightEventId);
    if (ordering === null) {
      return "unknown";
    }
    return ordering < 0 ? "before" : ordering > 0 ? "after" : "same";
  }

  private async reconcilePendingMainFullyRead(
    mx: MatrixClient,
    room: Room,
    echoedMarker: string,
  ): Promise<boolean> {
    const pendingMarker = this.pendingMainFullyRead.get(room.roomId);
    if (!pendingMarker) {
      return false;
    }
    const ordering = await this.compareTimelineEventOrdering(
      mx,
      room,
      pendingMarker,
      echoedMarker,
    );
    if (
      this.mx === mx &&
      this.pendingMainFullyRead.get(room.roomId) === pendingMarker &&
      (ordering === "before" || ordering === "same")
    ) {
      this.pendingMainFullyRead.delete(room.roomId);
      return true;
    }
    return false;
  }

  /**
   * Element's marker source: pending local write, then `m.fully_read`, then the
   * latest main-timeline receipt when no persistent marker exists. A window
   * captures this value when it opens, so later receipts cannot move its row.
   */
  private mainTimelineReadMarkerId(
    room: Room,
    userId: string | undefined,
  ): string | null {
    if (!userId) {
      return null;
    }
    const persistentMarker = this.persistentMainReadMarkerId(room);
    if (persistentMarker) {
      return persistentMarker;
    }
    return this.latestMainReadReceiptId(room, userId);
  }

  private persistentMainReadMarkerId(room: Room): string | null {
    return (
      this.pendingMainFullyRead.get(room.roomId) ??
      room
        .getAccountData(ReceiptType.FullyRead)
        ?.getContent<{ event_id?: string }>().event_id ??
      null
    );
  }

  private unreadSnapshot(
    room: Room,
    selfUserId: string | undefined,
  ): ChatUnread {
    return roomUnread(
      room,
      selfUserId,
      this.mainTimelineReadMarkerId(room, selfUserId),
    );
  }

  private extendLiveMessageWindow(room: Room, data: IRoomTimelineData): void {
    const session = this.messageWindowSessions.get(room.roomId);
    const generation = session?.current;
    if (
      !session ||
      !generation ||
      !generation.atLiveEnd ||
      session.client !== this.mx ||
      data.timeline.getTimelineSet() !== room.getUnfilteredTimelineSet()
    ) {
      return;
    }
    void this.serializeMessageWindowOperation(session, async () => {
      if (
        session.current === generation &&
        session.requestedGeneration === generation.generation &&
        generation.atLiveEnd
      ) {
        session.window.extend(EventTimeline.FORWARDS, 1);
      }
    }).catch(() => undefined);
  }

  /** Resolves a connected client for Matrix-only operations. */
  private requireClient(method: string): MatrixClient {
    const mx = this.mx;
    if (!mx) {
      throw new Error(`MatrixDriver.${method}: client is not connected.`);
    }
    return mx;
  }

  /** Resolves a connected client and a known room for Matrix-only operations. */
  private requireRoom(
    method: string,
    chatId: string,
  ): { mx: MatrixClient; room: Room } {
    const mx = this.requireClient(method);
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(`MatrixDriver.${method}: room "${chatId}" not found.`);
    }
    return { mx, room };
  }

  /** Resolves an active message on the main timeline or inside one thread. */
  private requireMessage(
    method: "editChatMessage" | "deleteChatMessage",
    {
      chatId,
      messageId,
      threadId,
    }: Pick<EditChatMessageParams, "chatId" | "messageId" | "threadId">,
  ): { mx: MatrixClient; room: Room; event: MatrixEvent } {
    const { mx, room } = this.requireRoom(method, chatId);
    const thread = threadId ? room.getThread(threadId) : undefined;
    const event = thread
      ? (thread.findEventById(messageId) ??
        (messageId === thread.id ? thread.rootEvent : undefined))
      : room.findEventById(messageId);
    const validTarget = threadId
      ? Boolean(event && isMessageEvent(event))
      : Boolean(event && isMainTimelineMessage(event));
    if (!event || !validTarget) {
      throw new Error(
        `MatrixDriver.${method}: message "${messageId}" not found${
          threadId ? ` in thread "${threadId}"` : " on the main timeline"
        }.`,
      );
    }
    if (event.isRedacted()) {
      throw new Error(
        `MatrixDriver.${method}: message "${messageId}" is already deleted.`,
      );
    }
    return { mx, room, event };
  }

  /** Adds or removes the current user's annotation on one Matrix message. */
  private async toggleReactionOnMessage(
    method: "toggleChatReaction" | "toggleChatThreadReaction",
    chatId: string,
    messageId: string,
    emoji: string,
    threadId?: string,
  ): Promise<ChatMessage> {
    const { mx, room } = this.requireRoom(method, chatId);
    const selfUserId = mx.getUserId();
    if (!selfUserId) {
      throw new Error(`MatrixDriver.${method}: connected user is not known.`);
    }

    const thread = threadId ? room.getThread(threadId) : undefined;
    if (threadId && !thread) {
      throw new Error(
        `MatrixDriver.${method}: thread "${threadId}" not found in room "${chatId}".`,
      );
    }
    const target = thread
      ? (thread.findEventById(messageId) ??
        (messageId === thread.id ? thread.rootEvent : undefined))
      : room.findEventById(messageId);
    const validTarget = threadId
      ? Boolean(target && isMessageEvent(target))
      : Boolean(target && isMainTimelineMessage(target));
    if (!target || !validTarget) {
      throw new Error(
        `MatrixDriver.${method}: message "${messageId}" not found${
          threadId ? ` in thread "${threadId}"` : " on the main timeline"
        }.`,
      );
    }

    const snapshot = await fetchReactionSnapshot(
      mx,
      chatId,
      messageId,
      selfUserId,
    );
    const previousReactions = snapshot.reactions;
    const ownReactions = ownReactionEvents(snapshot.events, emoji, selfUserId);

    if (ownReactions.length > 0) {
      const eventIds = [
        ...new Set(
          ownReactions
            .map((event) => event.getId())
            .filter((eventId): eventId is string => Boolean(eventId)),
        ),
      ];
      if (eventIds.length === 0) {
        throw new Error(
          "MatrixDriver.toggleChatReaction: own reaction has no event id.",
        );
      }
      await Promise.all(
        eventIds.map((eventId) =>
          threadId
            ? mx.redactEvent(chatId, threadId, eventId)
            : mx.redactEvent(chatId, eventId),
        ),
      );
    } else {
      const key = emojiToCodepoints(emoji);
      if (
        previousReactions.some(
          (reaction) =>
            reaction.reactedByMe && emojiToCodepoints(reaction.emoji) === key,
        )
      ) {
        throw new Error(
          "MatrixDriver.toggleChatReaction: own annotation is missing from the relation store.",
        );
      }
      // Annotated: an untyped literal widens `rel_type` to `RelationType`, which
      // no `sendEvent` overload accepts.
      const content: ReactionEventContent = {
        "m.relates_to": {
          rel_type: RelationType.Annotation,
          event_id: messageId,
          key: emoji,
        },
      };
      await (threadId
        ? mx.sendEvent(chatId, threadId, EventType.Reaction, content)
        : mx.sendEvent(chatId, EventType.Reaction, content));
    }

    return {
      ...matrixEventToChatMessage(target, room, selfUserId),
      reactions: toggleReaction(previousReactions, emoji),
    };
  }

  /** Toggles a reaction on a main-timeline message. */
  async toggleChatReaction({
    chatId,
    messageId,
    emoji,
  }: ToggleChatReactionParams): Promise<ChatMessage> {
    return this.toggleReactionOnMessage(
      "toggleChatReaction",
      chatId,
      messageId,
      emoji,
    );
  }

  /** Toggles a reaction on a root or reply inside a Matrix thread. */
  async toggleChatThreadReaction({
    chatId,
    threadId,
    messageId,
    emoji,
  }: ToggleChatThreadReactionParams): Promise<ChatMessage> {
    return this.toggleReactionOnMessage(
      "toggleChatThreadReaction",
      chatId,
      messageId,
      emoji,
      threadId,
    );
  }

  /** Back-paginates a thread so detail and first-unread use its full history. */
  private async loadAllThreadReplies(
    mx: MatrixClient,
    thread: Thread,
  ): Promise<void> {
    const seenTokens = new Set<string>();
    while (true) {
      const token = thread.liveTimeline.getPaginationToken(
        EventTimeline.BACKWARDS,
      );
      if (token === null || seenTokens.has(token)) {
        return;
      }
      seenTokens.add(token);
      const hasMore = await mx.paginateEventTimeline(thread.liveTimeline, {
        backwards: true,
        limit: DEFAULT_CHAT_PAGE_SIZE,
      });
      if (!hasMore) {
        return;
      }
    }
  }

  /** Loads every page of the server-side room thread list. */
  private async loadAllRoomThreads(
    mx: MatrixClient,
    room: Room,
  ): Promise<void> {
    await room.fetchRoomThreads();
    const allThreadsTimeline = room.threadsTimelineSets[0]?.getLiveTimeline();
    if (!allThreadsTimeline) {
      return;
    }
    const seenTokens = new Set<string>();
    while (true) {
      const token = allThreadsTimeline.getPaginationToken(
        EventTimeline.BACKWARDS,
      );
      if (token === null || seenTokens.has(token)) {
        return;
      }
      seenTokens.add(token);
      const hasMore = await mx.paginateEventTimeline(allThreadsTimeline, {
        backwards: true,
        limit: DEFAULT_CHAT_PAGE_SIZE,
      });
      if (!hasMore) {
        return;
      }
    }
  }

  /** All known room threads, ordered by their latest reply. */
  async getChatThreads(chatId: string): Promise<ChatThread[]> {
    const { mx, room } = this.requireRoom("getChatThreads", chatId);
    // Idempotent in the SDK and required even when one thread arrived via sync:
    // otherwise `getThreads()` can be a partial list.
    await this.loadAllRoomThreads(mx, room);
    this.restoreRedactedThreadReplies(mx);
    const selfUserId = mx.getUserId() ?? undefined;
    const overlaysByThreadId = new Map<
      string,
      Array<RedactedThreadReply & { message: ChatMessage }>
    >();
    for (const reply of this.redactedThreadReplies.values()) {
      if (reply.chatId !== chatId || !reply.message) {
        continue;
      }
      const replies = overlaysByThreadId.get(reply.threadId) ?? [];
      replies.push({ ...reply, message: reply.message });
      overlaysByThreadId.set(reply.threadId, replies);
    }

    const liveThreadIds = new Set<string>();
    const threads = room.getThreads().map((thread) => {
      liveThreadIds.add(thread.id);
      const summary = threadToChatThread(room, thread, selfUserId);
      const activeIds = new Set(
        sortedThreadReplyEvents(thread).map((event) => event.getId()),
      );
      const missingTombstones = (
        overlaysByThreadId.get(thread.id) ?? []
      ).filter(({ eventId }) => !activeIds.has(eventId));
      const latestTombstone = missingTombstones.sort((left, right) =>
        right.message.timestamp.localeCompare(left.message.timestamp),
      )[0];
      return {
        ...summary,
        ...(latestTombstone &&
        latestTombstone.message.timestamp > summary.lastReplyAt
          ? {
              author: authorForSender(
                room,
                latestTombstone.event.getSender() ?? "",
                selfUserId,
              ),
              lastReplyAt: latestTombstone.message.timestamp,
              lastReplyPreview: "",
              lastReplyDeleted: true,
            }
          : {}),
        replyCount: summary.replyCount + missingTombstones.length,
      };
    });

    for (const [threadId, replies] of overlaysByThreadId) {
      if (liveThreadIds.has(threadId) || replies.length === 0) {
        continue;
      }
      const latest = [...replies].sort((left, right) =>
        right.message.timestamp.localeCompare(left.message.timestamp),
      )[0];
      threads.push({
        id: threadId,
        rootMessageId: threadId,
        author: authorForSender(
          room,
          latest.event.getSender() ?? "",
          selfUserId,
        ),
        lastReplyAt: latest.message.timestamp,
        lastReplyPreview: "",
        lastReplyDeleted: true,
        replyCount: replies.length,
        unreadCount: 0,
      });
    }

    return threads.sort((left, right) =>
      right.lastReplyAt.localeCompare(left.lastReplyAt),
    );
  }

  /** Root + every reply, with a receipt-derived first-unread boundary. */
  async getChatThread({
    chatId,
    threadId,
  }: GetChatThreadParams): Promise<ChatThreadDetail> {
    const { mx, room } = this.requireRoom("getChatThread", chatId);
    await this.loadAllRoomThreads(mx, room);
    this.restoreRedactedThreadReplies(mx);
    const thread = room.getThread(threadId);
    const selfUserId = mx.getUserId() ?? undefined;
    const redactedReplies = this.redactedRepliesForThread(chatId, threadId);
    if (!thread) {
      const rootEvent =
        room.findEventById(threadId) ?? redactedReplies[0]?.rootEvent;
      if (!rootEvent || redactedReplies.length === 0) {
        throw new Error(
          `MatrixDriver.getChatThread: thread "${threadId}" not found in room "${chatId}".`,
        );
      }
      const overlayEvents = redactedReplies.map(({ event }) => event);
      return {
        id: threadId,
        rootMessageId: threadId,
        messages: [
          this.messageWithThreadOverlay(room, rootEvent, selfUserId),
          ...redactedReplies
            .map(({ message }) => message)
            .sort((left, right) =>
              left.timestamp.localeCompare(right.timestamp),
            ),
        ],
        authors: buildAuthors(room, [rootEvent, ...overlayEvents], selfUserId),
        firstUnreadIndex: null,
      };
    }
    await this.loadAllThreadReplies(mx, thread);
    this.restoreRedactedThreadReplies(mx);
    const detail = threadToChatThreadDetail(room, thread, selfUserId);
    const firstUnreadMessageId =
      detail.firstUnreadIndex === null
        ? null
        : (detail.messages[detail.firstUnreadIndex]?.id ?? null);
    const replies = sortedThreadReplyEvents(thread);
    const events = thread.rootEvent ? [thread.rootEvent, ...replies] : replies;
    const activeMessages = await Promise.all(
      detail.messages.map((message, index) => {
        const event = events[index];
        const projectedMessage =
          event?.getId() === threadId
            ? this.messageWithThreadOverlay(room, event, selfUserId)
            : message;
        return reconcileMessageReactions(
          mx,
          room,
          event,
          projectedMessage,
          selfUserId,
        );
      }),
    );
    const activeIds = new Set(activeMessages.map(({ id }) => id));
    const rootMessage = activeMessages.find(({ id }) => id === threadId);
    const messages = [
      ...(rootMessage ? [rootMessage] : []),
      ...[
        ...activeMessages.filter(({ id }) => id !== threadId),
        ...redactedReplies
          .map(({ message }) => message)
          .filter(({ id }) => !activeIds.has(id)),
      ].sort((left, right) => left.timestamp.localeCompare(right.timestamp)),
    ];
    const overlayAuthors = buildAuthors(
      room,
      redactedReplies.map(({ event }) => event),
      selfUserId,
    );
    const authors = [
      ...detail.authors,
      ...overlayAuthors.filter(
        (author) => !detail.authors.some((current) => current.id === author.id),
      ),
    ];
    const firstUnreadIndex = firstUnreadMessageId
      ? messages.findIndex(({ id }) => id === firstUnreadMessageId)
      : -1;
    return {
      ...detail,
      messages,
      authors,
      firstUnreadIndex: firstUnreadIndex >= 0 ? firstUnreadIndex : null,
    };
  }

  /** Advances only this thread's receipt to its latest reply. */
  async markChatThreadRead({
    chatId,
    threadId,
  }: MarkChatThreadReadParams): Promise<void> {
    const { mx, room } = this.requireRoom("markChatThreadRead", chatId);
    const thread = room.getThread(threadId);
    const lastReply = thread?.replyToEvent;
    if (lastReply) {
      await mx.sendReadReceipt(lastReply);
    }
  }

  /** Advances each known thread receipt independently. */
  async markAllChatThreadsRead(chatId: string): Promise<void> {
    const { mx, room } = this.requireRoom("markAllChatThreadsRead", chatId);
    await this.loadAllRoomThreads(mx, room);
    await Promise.all(
      room.getThreads().map((thread) => {
        const lastReply = thread.replyToEvent;
        return lastReply ? mx.sendReadReceipt(lastReply) : Promise.resolve();
      }),
    );
  }

  private queueMainReadUpdate(
    chatId: string,
    update: () => Promise<MarkChatReadResult>,
  ): Promise<MarkChatReadResult> {
    const previous = this.mainReadMarkerQueues.get(chatId);
    const ready =
      previous?.then(
        () => undefined,
        () => undefined,
      ) ?? Promise.resolve();
    const queued = ready.then(update);
    this.mainReadMarkerQueues.set(chatId, queued);
    const release = () => {
      if (this.mainReadMarkerQueues.get(chatId) === queued) {
        this.mainReadMarkerQueues.delete(chatId);
      }
    };
    void queued.then(release, release);
    return queued;
  }

  private mainReadTarget(
    room: Room,
    messageId: string | undefined,
    selfUserId: string,
    excludeOwn: boolean,
  ): MatrixEvent | null {
    const isValid = (
      event: MatrixEvent | undefined | null,
    ): event is MatrixEvent => {
      const eventId = event?.getId();
      return Boolean(
        event &&
        eventId &&
        isMainTimelineMessage(event) &&
        !event.isRedacted() &&
        !event.status &&
        !room.hasPendingEvent(eventId!) &&
        !this.isRedactedThreadReply(room.roomId, event) &&
        (!excludeOwn || event.getSender() !== selfUserId),
      );
    };
    if (messageId) {
      const event = room.findEventById(messageId);
      return isValid(event) ? event : null;
    }
    return room.getLiveTimeline().getEvents().findLast(isValid) ?? null;
  }

  private emitMainUnread(
    mx: MatrixClient,
    room: Room,
    selfUserId: string,
  ): void {
    if (this.mx === mx) {
      this.emit({
        type: "unread:changed",
        chatId: room.roomId,
        unread: this.unreadSnapshot(room, selfUserId),
      });
    }
  }

  async advanceMainReadReceipt(
    params: AdvanceMainReadParams,
  ): Promise<MarkChatReadResult> {
    const scheduledClient = this.requireClient("advanceMainReadReceipt");
    return this.queueMainReadUpdate(params.chatId, () =>
      this.mx === scheduledClient
        ? this.advanceMainReadReceiptNow(params)
        : Promise.resolve({ status: "unavailable" }),
    );
  }

  private async advanceMainReadReceiptNow({
    chatId,
    messageId,
  }: AdvanceMainReadParams): Promise<MarkChatReadResult> {
    const { mx, room } = this.requireRoom("advanceMainReadReceipt", chatId);
    const selfUserId = mx.getUserId();
    if (!selfUserId) {
      return { status: "unavailable" };
    }
    const target = this.mainReadTarget(room, messageId, selfUserId, true);
    const targetId = target?.getId();
    if (!target || !targetId) {
      return { status: "unavailable" };
    }
    if (room.hasUserReadEvent(selfUserId, targetId)) {
      return { status: "unchanged" };
    }
    for (const receiptId of this.mainReadReceiptIds(room, selfUserId)) {
      const ordering = await this.compareTimelineEventOrdering(
        mx,
        room,
        receiptId,
        targetId,
      );
      if (this.mx !== mx || ordering === "unknown") {
        return { status: "unavailable" };
      }
      if (ordering === "same" || ordering === "after") {
        return { status: "unchanged" };
      }
    }
    if (this.mx !== mx) {
      return { status: "unavailable" };
    }
    await mx.sendReadReceipt(target);
    if (this.mx !== mx) {
      throw new Error(
        "MatrixDriver.advanceMainReadReceipt: the Matrix client changed during the request.",
      );
    }
    this.emitMainUnread(mx, room, selfUserId);
    return { status: "updated" };
  }

  async advanceMainFullyRead(
    params: AdvanceMainReadParams,
  ): Promise<MarkChatReadResult> {
    const scheduledClient = this.requireClient("advanceMainFullyRead");
    return this.queueMainReadUpdate(params.chatId, () =>
      this.mx === scheduledClient
        ? this.advanceMainFullyReadNow(params)
        : Promise.resolve({ status: "unavailable" }),
    );
  }

  private async advanceMainFullyReadNow({
    chatId,
    messageId,
  }: AdvanceMainReadParams): Promise<MarkChatReadResult> {
    const { mx, room } = this.requireRoom("advanceMainFullyRead", chatId);
    const selfUserId = mx.getUserId();
    if (!selfUserId) {
      return { status: "unavailable" };
    }
    const target = this.mainReadTarget(room, messageId, selfUserId, false);
    const targetId = target?.getId();
    if (!target || !targetId) {
      return { status: "unavailable" };
    }
    const previousMarker = this.persistentMainReadMarkerId(room);
    if (previousMarker === targetId) {
      return { status: "unchanged" };
    }
    if (previousMarker) {
      const ordering = await this.compareTimelineEventOrdering(
        mx,
        room,
        previousMarker,
        targetId,
      );
      if (this.mx !== mx || ordering === "unknown") {
        return { status: "unavailable" };
      }
      if (ordering === "same" || ordering === "after") {
        return { status: "unchanged" };
      }
    }

    const previousPending = this.pendingMainFullyRead.get(chatId);
    this.pendingMainFullyRead.set(chatId, targetId);
    try {
      await mx.setRoomReadMarkers(chatId, targetId);
    } catch (error) {
      if (
        this.mx === mx &&
        this.pendingMainFullyRead.get(chatId) === targetId
      ) {
        if (previousPending) {
          this.pendingMainFullyRead.set(chatId, previousPending);
        } else {
          this.pendingMainFullyRead.delete(chatId);
        }
      }
      throw error;
    }
    if (this.mx !== mx) {
      throw new Error(
        "MatrixDriver.advanceMainFullyRead: the Matrix client changed during the request.",
      );
    }
    const echoedMarker = room
      .getAccountData(ReceiptType.FullyRead)
      ?.getContent<{ event_id?: string }>().event_id;
    if (echoedMarker) {
      await this.reconcilePendingMainFullyRead(mx, room, echoedMarker);
      if (this.mx !== mx) {
        throw new Error(
          "MatrixDriver.advanceMainFullyRead: the Matrix client changed during the request.",
        );
      }
    }
    this.emitMainUnread(mx, room, selfUserId);
    return { status: "updated" };
  }

  /**
   * Sends a text message as an `m.room.message` / `m.text` and resolves with the
   * final `ChatMessage`. The id is the REAL server event id, so the composer
   * hook replaces its optimistic bubble with a `/sync`-consistent message (see
   * {@link sendResponseToChatMessage}); the `/sync` echo of this same event is
   * suppressed as our own (see {@link isOwnEcho}), so it never double-renders.
   * The conversation rises in the list for free once the hook invalidates it.
   */
  async sendChatMessage({
    chatId,
    content,
  }: SendChatMessageParams): Promise<ChatMessage> {
    const { mx } = this.requireRoom("sendChatMessage", chatId);
    const { event_id: eventId } = await mx.sendTextMessage(chatId, content);
    return sendResponseToChatMessage(eventId, content);
  }

  /** Sends an `m.replace` relation targeting the stable original event id. */
  async editChatMessage({
    chatId,
    messageId,
    threadId,
    content,
  }: EditChatMessageParams): Promise<ChatMessage> {
    const { mx, room, event } = this.requireMessage("editChatMessage", {
      chatId,
      messageId,
      threadId,
    });
    const selfUserId = mx.getUserId();
    if (!selfUserId || event.getSender() !== selfUserId) {
      throw new Error(
        "MatrixDriver.editChatMessage: only the message author can edit it.",
      );
    }
    if (event.getContent<{ msgtype?: string }>().msgtype !== MsgType.Text) {
      throw new Error(
        "MatrixDriver.editChatMessage: only text messages can be edited.",
      );
    }

    const newContent = { body: content, msgtype: MsgType.Text } as const;
    const editContent: RoomMessageEventContent = {
      body: `* ${content}`,
      msgtype: MsgType.Text,
      "m.new_content": newContent,
      "m.relates_to": {
        rel_type: RelationType.Replace,
        event_id: messageId,
      },
    };
    await (threadId
      ? mx.sendMessage(chatId, threadId, editContent)
      : mx.sendMessage(chatId, editContent));

    return {
      ...matrixEventToChatMessage(event, room, selfUserId),
      content,
      isEdited: true,
    };
  }

  /** Redacts the event for every room member and returns its tombstone shape. */
  async deleteChatMessage({
    chatId,
    messageId,
    threadId,
  }: DeleteChatMessageParams): Promise<ChatMessage> {
    const { mx, room, event } = this.requireMessage("deleteChatMessage", {
      chatId,
      messageId,
      threadId,
    });
    const selfUserId = mx.getUserId();
    if (
      !selfUserId ||
      !room.currentState.maySendRedactionForEvent(event, selfUserId)
    ) {
      throw new Error(
        "MatrixDriver.deleteChatMessage: the connected user cannot delete this message.",
      );
    }

    await (threadId
      ? mx.redactEvent(chatId, threadId, messageId)
      : mx.redactEvent(chatId, messageId));
    return {
      ...matrixEventToChatMessage(event, room, selfUserId),
      content: "",
      reactions: [],
      isDeleted: true,
      isEdited: false,
      canEdit: false,
      canDelete: false,
    };
  }

  async sendChatTyping({
    chatId,
    isTyping,
  }: SendChatTypingParams): Promise<void> {
    const mx = this.requireClient("sendChatTyping");
    await mx.sendTyping(chatId, isTyping, MATRIX_TYPING_TIMEOUT_MS);
  }

  async sendChatThreadReply({
    chatId,
    threadId,
    content,
  }: SendChatThreadReplyParams): Promise<ChatThreadMutationResult> {
    const { mx, room } = this.requireRoom("sendChatThreadReply", chatId);
    if (!threadId.startsWith("$")) {
      throw new Error(
        `MatrixDriver.sendChatThreadReply: invalid Matrix thread id "${threadId}".`,
      );
    }
    const { event_id: eventId } = await mx.sendTextMessage(
      chatId,
      threadId,
      content,
    );
    this.sentThreadReplyEventIds.add(eventId);
    return this.buildThreadMutationResult(mx, room, threadId, eventId, content);
  }

  async startChatThread({
    chatId,
    rootMessageId,
    content,
  }: StartChatThreadParams): Promise<ChatThreadMutationResult> {
    const { mx, room } = this.requireRoom("startChatThread", chatId);
    if (!rootMessageId.startsWith("$")) {
      throw new Error(
        `MatrixDriver.startChatThread: invalid Matrix root message id "${rootMessageId}".`,
      );
    }
    if (!room.findEventById(rootMessageId)) {
      throw new Error(
        `MatrixDriver.startChatThread: root message "${rootMessageId}" not found in room "${chatId}".`,
      );
    }
    const { event_id: eventId } = await mx.sendTextMessage(
      chatId,
      rootMessageId,
      content,
    );
    this.sentThreadReplyEventIds.add(eventId);
    return this.buildThreadMutationResult(
      mx,
      room,
      rootMessageId,
      eventId,
      content,
    );
  }

  /** Builds the exact cache payload expected by the optimistic thread hooks. */
  private buildThreadMutationResult(
    mx: MatrixClient,
    room: Room,
    rootMessageId: string,
    replyEventId: string,
    content: string,
  ): ChatThreadMutationResult {
    const selfUserId = mx.getUserId() ?? undefined;
    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: replyEventId,
      authorId: SELF_AUTHOR_ID,
      content,
      timestamp: now,
      reactions: [],
    };
    const liveThread = room.getThread(rootMessageId);
    const rootEvent =
      liveThread?.rootEvent ?? room.findEventById(rootMessageId);
    if (!rootEvent) {
      throw new Error(
        `MatrixDriver.buildThreadMutationResult: root message "${rootMessageId}" not found.`,
      );
    }
    const previousReplyEvents = liveThread
      ? sortedThreadReplyEvents(liveThread).filter(
          (event) => event.status === null && event.getId() !== replyEventId,
        )
      : [];
    const replyCount = Math.max(
      liveThread ? threadReplyCount(liveThread) : 0,
      previousReplyEvents.length + 1,
    );
    if (liveThread) {
      rememberThreadReplyCount(liveThread, replyCount);
    }
    const rootMessage: ChatMessage = {
      ...matrixEventToChatMessage(rootEvent, room, selfUserId),
      thread: {
        id: rootMessageId,
        replyCount,
        unreadCount: 0,
      },
    };
    const previousReplies = previousReplyEvents.map((event) =>
      matrixEventToChatMessage(event, room, selfUserId),
    );
    const threadDetail: ChatThreadDetail = {
      id: rootMessageId,
      rootMessageId,
      messages: [rootMessage, ...previousReplies, message],
      authors: buildAuthors(
        room,
        [rootEvent, ...previousReplyEvents],
        selfUserId,
      ),
      firstUnreadIndex: null,
    };
    const thread: ChatThread = {
      id: rootMessageId,
      rootMessageId,
      author: authorForSender(room, mx.getUserId() ?? "", selfUserId),
      lastReplyAt: now,
      lastReplyPreview: content,
      replyCount,
      unreadCount: 0,
    };
    return { message, thread, threadDetail, rootMessage };
  }

  /**
   * Establishes the Matrix session and resolves with the connection state.
   * Called through `useChatConnection` (a React Query query), so retries,
   * caching and de-duplication are handled by React Query — no bespoke store.
   */
  async connect(user: User | null | undefined): Promise<ChatConnectionState> {
    // The whole flow touches window/localStorage/IndexedDB. Static export has
    // no server runtime, but guard regardless.
    if (typeof window === "undefined") {
      return { status: "connecting", chatUser: null };
    }
    this.setStorageOwner(user);

    // 1. Returning user — credentials already persisted.
    const stored = this.readStoredJson<MatrixUserInterface>(STORAGE.user);
    if (stored) {
      try {
        await this.bootstrapClient(stored);
        return { status: "connected", chatUser: toChatUser(stored) };
      } catch (error) {
        if (!isMatrixSessionInvalidError(error)) {
          throw error;
        }
        await this.clearStoredSession(stored);
        if (!user?.email) {
          return { status: "idle", chatUser: null };
        }
        const redirectTo = await this.startOidcFlow(user);
        return { status: "connecting", chatUser: null, redirectTo };
      }
    }

    // 2. Back from the identity provider — finish the OIDC code exchange.
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) {
      if (sessionStorage.getItem(this.key(STORAGE.oidcState)) !== state) {
        return { status: "idle", chatUser: null };
      }
      const matrixUser = await this.completeLogin(code, state);
      await this.bootstrapClient(matrixUser);
      this.clearCallbackParams();
      return { status: "connected", chatUser: toChatUser(matrixUser) };
    }

    // 3. Nothing to go on yet — wait until the Hub user is known before
    //    redirecting away, so an anonymous first render does not bounce.
    if (!user?.email) {
      return { status: "idle", chatUser: null };
    }

    const redirectTo = await this.startOidcFlow(user);
    return { status: "connecting", chatUser: null, redirectTo };
  }

  private async startOidcFlow(user: User | null | undefined): Promise<string> {
    const loginHint = this.resolveLoginHint(user);
    const authUrl = await getOIDCAuthUrl(
      this.settings.baseUrl,
      loginHint,
      this.settings.oidcClientId,
    );
    const state = new URL(authUrl).searchParams.get("state");
    if (state) {
      sessionStorage.setItem(this.key(STORAGE.oidcState), state);
    }
    return authUrl;
  }

  private async completeLogin(
    code: string,
    state: string,
  ): Promise<MatrixUserInterface> {
    const oidc = await completeOidcLogin({ code, state });
    const { user_id: mxId, device_id: deviceId } =
      await getUserIdFromAccessToken(oidc.accessToken, this.settings.baseUrl);

    const matrixUser: MatrixUserInterface = {
      homeserverUrl: this.settings.baseUrl,
      mxId,
      deviceId,
      accessToken: oidc.accessToken,
      refreshToken: oidc.refreshToken,
    };
    this.writeStoredJson(STORAGE.user, matrixUser);
    this.writeStoredJson(STORAGE.oidc, {
      clientId: oidc.clientId,
      issuer: oidc.issuer,
      idToken: oidc.idToken,
      idTokenClaims: oidc.idTokenClaims,
      // The IdP redirected back to this exact URL, so origin + pathname is the
      // redirect URI registered for this client.
      redirectUri: new URL(window.location.origin + window.location.pathname)
        .href,
    } satisfies StoredOidc);
    sessionStorage.removeItem(this.key(STORAGE.oidcState));
    return matrixUser;
  }

  private async bootstrapClient(user: MatrixUserInterface): Promise<void> {
    if (this.mx && this.mx.getUserId() === user.mxId) {
      return;
    }
    const mx = await initClient(user, {
      syncStoreDbName: this.key(SYNC_STORE_DB_NAME),
      cryptoStoreDbName: this.cryptoStoreDbName(user),
      tokenRefreshFunction: this.buildTokenRefreshFunction(user),
    });
    this.mx = mx;
    await this.startClientOrFailOnLogout(mx);
    await this.refreshJoinedRoomIds(mx);
    this.restoreRedactedThreadReplies(mx);

    // Bridge Matrix `/sync` onto the generic event stream, once, for the
    // client's lifetime. The handlers fan out to whatever subscribers exist at
    // the time (an empty set is a harmless no-op). Live timeline events become
    // fine-grained `message:new` / `message:updated` (see
    // {@link timelineEventToChatEvent}); reactions are reconciled against the
    // server before their targeted patch; list membership changes and
    // reconnects stay coarse (`chats:changed`, per-room `chat:changed`).
    this.detachSync();
    const selfUserId = mx.getUserId() ?? undefined;
    const emitUnread = (room: Room) =>
      this.emit({
        type: "unread:changed",
        chatId: room.roomId,
        unread: this.unreadSnapshot(room, selfUserId),
      });
    /** Replaces the root bubble so its summary count / unread badge moves live. */
    const emitThreadRootUpdate = (thread: Thread) => {
      if (!thread.rootEvent) {
        return;
      }
      this.emit({
        type: "message:updated",
        chatId: thread.room.roomId,
        message: this.messageWithThreadOverlay(
          thread.room,
          thread.rootEvent,
          selfUserId,
        ),
      });
    };
    const emitThreadChanged = (thread: Thread, event?: MatrixEvent) => {
      // The optimistic mutation owns this session's local/remote echo.
      if (event && isOwnEcho(event)) {
        return;
      }
      this.emit({ type: "threads:changed", chatId: thread.room.roomId });
      emitThreadRootUpdate(thread);
      emitUnread(thread.room);
    };
    const emitThreadsRefresh = (room: Room) => {
      const threads = room.getThreads();
      if (threads.length === 0) {
        return;
      }
      this.emit({ type: "threads:changed", chatId: room.roomId });
      threads.forEach((thread) => emitThreadRootUpdate(thread));
    };
    const pendingLiveThreadReplies = new Set<string>();
    const pendingRedactions = new WeakMap<
      MatrixEvent,
      {
        target: MatrixEvent;
        relationTargetId?: string;
        threadId?: string;
        thread?: Thread;
      }
    >();
    const scopedThreadReplyKey = (
      thread: Thread,
      event: MatrixEvent,
    ): string | undefined => {
      const eventKey = threadReplyEventKey(event);
      return eventKey
        ? `${thread.room.roomId}\u0000${thread.id}\u0000${eventKey}`
        : undefined;
    };
    /**
     * A thread reply this session sent: either still a local echo, or the remote
     * echo of an id the driver just wrote. Both are already on screen through the
     * optimistic mutation, so the bridge must stay silent.
     */
    const isOwnThreadEcho = (event: MatrixEvent): boolean => {
      const eventId = event.getId();
      return (
        isOwnEcho(event) ||
        (eventId !== undefined && this.sentThreadReplyEventIds.has(eventId))
      );
    };
    const stopTypingForMessageAuthor = (room: Room, event: MatrixEvent) => {
      const sender = event.getSender();
      if (!sender || sender === selfUserId || event.isRedacted()) {
        return;
      }
      const member = room.getMember(sender);
      if (!member?.typing) {
        return;
      }
      // A message closes its author's current typing session. Synapse may
      // coalesce a very brief typing=false with the message, leaving the SDK
      // member at true and causing the next identical true snapshot to be
      // deduplicated. Reset the volatile SDK projection explicitly so the next
      // true is observable as a new session.
      member.typing = false;
      this.typingSignatures.delete(room.roomId);
      this.emitTyping(room);
    };
    const onTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
      removed: boolean,
      data: IRoomTimelineData,
    ) => {
      // Backward history is served by `paginateChatMessageWindow`, not the
      // live stream.
      if (!room || removed) {
        return;
      }
      if (data.liveEvent === true) {
        this.extendLiveMessageWindow(room, data);
      }
      if (this.isRedactedThreadReply(room.roomId, event)) {
        return;
      }
      if (
        data.liveEvent === true &&
        event.getType() === EventType.RoomMessage
      ) {
        stopTypingForMessageAuthor(room, event);
      }
      // The Room re-emits its thread timeline. Remember only real live events
      // here (the SDK explicitly labels backfill in `data.liveEvent`), then
      // publish after ThreadEvent.NewReply has refreshed thread metadata.
      if (
        !event.isThreadRoot &&
        event.getRelation()?.rel_type === RelationType.Thread
      ) {
        if (isOwnThreadEcho(event)) {
          return;
        }
        const threadId = event.threadRootId;
        const thread = threadId ? room.getThread(threadId) : null;
        if (thread) {
          const isLive = data.liveEvent === true;
          const isNew = observeThreadReply(thread, event, isLive);
          const replyKey = scopedThreadReplyKey(thread, event);
          if (isLive && isNew && replyKey) {
            pendingLiveThreadReplies.add(replyKey);
          }
        }
        return;
      }
      // Both backward and forward pagination can re-emit historical events on
      // the room timeline. Only `/sync` live events belong on the global event
      // stream; contextual snapshots come from the active TimelineWindow.
      if (toStartOfTimeline || data.liveEvent !== true) {
        return;
      }
      if (event.getType() === EventType.Reaction) {
        // The optimistic mutation owns this session's local/remote echo. Other
        // devices are reconciled against the homeserver because the SDK's
        // IndexedDB relation container may still hold an older local echo.
        if (isOwnEcho(event)) {
          return;
        }
        const relation = event.getRelation();
        if (
          relation?.rel_type !== RelationType.Annotation ||
          !relation.event_id
        ) {
          return;
        }
        const targetId = relation.event_id;
        const threadIdHint = event.threadRootId;
        void fetchReactionSnapshot(mx, room.roomId, targetId, selfUserId)
          .then((snapshot) => {
            if (this.mx !== mx) {
              return;
            }
            for (const chatEvent of reactionUpdateEventsForTarget(
              room,
              targetId,
              snapshot.reactions,
              threadIdHint,
            )) {
              this.emit(chatEvent);
            }
          })
          .catch(() => {
            if (this.mx === mx) {
              this.emit({ type: "chat:changed", chatId: room.roomId });
              if (threadIdHint || room.getThread(targetId)) {
                this.emit({ type: "threads:changed", chatId: room.roomId });
              }
            }
          });
        return;
      }
      for (const chatEvent of timelineEventToChatEvent(
        event,
        room,
        selfUserId,
      )) {
        this.emit(chatEvent);
      }
      emitUnread(room);
    };
    const onReceipt = (event: MatrixEvent, room: Room | undefined) => {
      if (!room || !receiptMentionsUser(event, selfUserId)) {
        return;
      }
      emitUnread(room);
      emitThreadsRefresh(room);
    };
    const onAccountData = (event: MatrixEvent, room: Room) => {
      if (event.getType() !== ReceiptType.FullyRead) {
        return;
      }
      const echoedMarker = event.getContent<{ event_id?: string }>().event_id;
      if (echoedMarker) {
        void this.reconcilePendingMainFullyRead(mx, room, echoedMarker)
          .catch(() => false)
          .then(() => {
            if (this.mx === mx) {
              emitUnread(room);
            }
          });
        return;
      }
      emitUnread(room);
    };
    const onReplaced = (event: MatrixEvent) => {
      const roomId = event.getRoomId();
      const room = roomId ? mx.getRoom(roomId) : null;
      if (!room || !isMessageEvent(event)) {
        return;
      }
      const threadId = event.isThreadRoot ? event.getId() : event.threadRootId;
      this.emit({
        type: "message:updated",
        chatId: room.roomId,
        message: this.messageWithThreadOverlay(room, event, selfUserId),
        ...(threadId ? { threadId } : {}),
      });
      if (threadId) {
        this.emit({
          type: "threads:changed",
          chatId: room.roomId,
          invalidateDetails: false,
        });
      }
    };
    const onBeforeRedaction = (target: MatrixEvent, redaction: MatrixEvent) => {
      const threadId = target.isThreadRoot
        ? target.getId()
        : target.threadRootId;
      const targetRoomId = target.getRoomId();
      const thread =
        threadId && targetRoomId
          ? (mx.getRoom(targetRoomId)?.getThread(threadId) ?? undefined)
          : undefined;
      // The local redaction echo has a sending status and can still fail. Only
      // mutate the durable projection when the server-confirmed echo arrives,
      // matching matrix-js-sdk's own Thread.onBeforeRedaction guard.
      if (thread && target.getId() !== thread.id && !redaction.status) {
        forgetThreadReply(thread, target);
        const eventId = target.getId();
        const rootEvent =
          thread.rootEvent ??
          (targetRoomId
            ? mx.getRoom(targetRoomId)?.findEventById(thread.id)
            : null);
        if (eventId && targetRoomId && rootEvent && isMessageEvent(target)) {
          this.redactedThreadReplies.set(
            this.redactedThreadReplyKey(targetRoomId, eventId),
            {
              chatId: targetRoomId,
              threadId: thread.id,
              eventId,
              rootEvent,
              event: target,
            },
          );
          this.persistRedactedThreadReplies();
        }
      }
      pendingRedactions.set(redaction, {
        target,
        relationTargetId: target.getRelation()?.event_id,
        threadId,
        ...(thread ? { thread } : {}),
      });
    };
    const onRedaction = (
      redaction: MatrixEvent,
      room: Room,
      emittedThreadId?: string,
    ) => {
      const pending = pendingRedactions.get(redaction);
      const targetId = redaction.getAssociatedId();
      const target =
        pending?.target ?? (targetId ? room.findEventById(targetId) : null);
      const threadId = pending?.threadId ?? emittedThreadId;
      if (target?.getType() === EventType.RoomMessage) {
        const message = matrixEventToChatMessage(target, room, selfUserId);
        const redactedTargetId = target.getId();
        if (threadId && redactedTargetId && redactedTargetId !== threadId) {
          const overlay = this.redactedThreadReplies.get(
            this.redactedThreadReplyKey(room.roomId, redactedTargetId),
          );
          if (overlay) {
            overlay.message = message;
          }
        }
        const emitMessageUpdate = () =>
          this.emit({
            type: "message:updated",
            chatId: room.roomId,
            message,
            ...(threadId ? { threadId } : {}),
          });
        // makeRedacted() strips m.thread and the SDK repartitions the event
        // after RoomEvent.Redaction. Publish a reply tombstone one microtask
        // later so the cache removal wins over that transient main-timeline
        // insertion instead of racing it.
        if (threadId && redactedTargetId && redactedTargetId !== threadId) {
          queueMicrotask(() => {
            if (this.mx === mx) {
              emitMessageUpdate();
            }
          });
        } else {
          emitMessageUpdate();
        }
        if (threadId || target.isThreadRoot) {
          if (pending?.thread) {
            emitThreadRootUpdate(pending.thread);
          }
          this.emit({
            type: "threads:changed",
            chatId: room.roomId,
            invalidateDetails: false,
          });
        }
        emitUnread(room);
        return;
      }
      if (
        target?.getType() === EventType.Reaction &&
        pending?.relationTargetId
      ) {
        void fetchReactionSnapshot(
          mx,
          room.roomId,
          pending.relationTargetId,
          selfUserId,
        )
          .then(({ reactions }) => {
            if (this.mx !== mx) {
              return;
            }
            reactionUpdateEventsForTarget(
              room,
              pending.relationTargetId!,
              reactions,
              threadId,
            ).forEach((chatEvent) => this.emit(chatEvent));
          })
          .catch(() => {
            if (this.mx === mx) {
              this.emit({ type: "chat:changed", chatId: room.roomId });
              if (threadId) {
                this.emit({ type: "threads:changed", chatId: room.roomId });
              }
            }
          });
        return;
      }
      this.emit({ type: "chat:changed", chatId: room.roomId });
      if (threadId) {
        this.emit({ type: "threads:changed", chatId: room.roomId });
      }
    };
    const onRedactionCancelled = (event: MatrixEvent, room: Room) => {
      const pending = pendingRedactions.get(event);
      const targetId = pending?.target.getId();
      if (targetId) {
        this.redactedThreadReplies.delete(
          this.redactedThreadReplyKey(room.roomId, targetId),
        );
        this.persistRedactedThreadReplies({
          chatId: room.roomId,
          eventId: targetId,
        });
      }
      this.emit({ type: "chat:changed", chatId: room.roomId });
      this.emit({ type: "threads:changed", chatId: room.roomId });
    };
    // One m.typing EDU updates members sequentially and can emit several
    // RoomMemberEvent.Typing callbacks. Batch them so Alice→Bob never exposes
    // a transient empty snapshot to React between those callbacks.
    const pendingTypingRoomIds = new Set<string>();
    let typingFlushQueued = false;
    const onTyping = (_event: MatrixEvent, member: RoomMember) => {
      pendingTypingRoomIds.add(member.roomId);
      if (typingFlushQueued) {
        return;
      }
      typingFlushQueued = true;
      queueMicrotask(() => {
        typingFlushQueued = false;
        if (this.mx !== mx) {
          pendingTypingRoomIds.clear();
          return;
        }
        pendingTypingRoomIds.forEach((roomId) => {
          const room = mx.getRoom(roomId);
          if (room) {
            this.emitTyping(room);
          }
        });
        pendingTypingRoomIds.clear();
      });
    };
    const onPowerLevel = (_event: MatrixEvent, member: RoomMember) => {
      if (member.userId !== selfUserId) {
        return;
      }
      this.emit({ type: "chat:changed", chatId: member.roomId });
      this.emit({ type: "threads:changed", chatId: member.roomId });
    };
    const onMembers = (
      _event: MatrixEvent,
      _state: unknown,
      member: RoomMember,
    ) => {
      this.emit({ type: "members:changed", chatId: member.roomId });
    };
    // Membership events are applied before the SDK recalculates `room.name`.
    // Wait for this final signal before refreshing the conversation metadata,
    // otherwise a remote leave can leave the header/sidebar on the old DM name
    // until an unrelated event triggers another read.
    const onName = (room: Room) => {
      this.emit({ type: "chat:changed", chatId: room.roomId });
      this.emit({ type: "chats:changed" });
    };
    const onTags = (_event: MatrixEvent, room: Room) => {
      this.emit({ type: "tags:changed", chatId: room.roomId });
    };
    const onThreadNew = (thread: Thread, toStartOfTimeline: boolean) => {
      const reply = thread.replyToEvent ?? undefined;
      if (toStartOfTimeline || !reply) {
        return;
      }
      if (isOwnThreadEcho(reply)) {
        return;
      }
      const replyKey = scopedThreadReplyKey(thread, reply);
      const wasPendingLive = Boolean(
        replyKey && pendingLiveThreadReplies.delete(replyKey),
      );
      if (wasPendingLive || observeThreadReply(thread, reply, true)) {
        emitThreadChanged(thread, reply);
      }
    };
    const onThreadReply = (thread: Thread, event: MatrixEvent) => {
      const replyKey = scopedThreadReplyKey(thread, event);
      if (replyKey && pendingLiveThreadReplies.delete(replyKey)) {
        emitThreadChanged(thread, event);
      }
    };
    const detachThreadListenersByRoomId = new Map<string, () => void>();
    const attachThreadListeners = (room: Room) => {
      if (detachThreadListenersByRoomId.has(room.roomId)) {
        return;
      }
      room.getThreads().forEach(getThreadReplyCounter);
      room.on(ThreadEvent.New, onThreadNew);
      room.on(ThreadEvent.NewReply, onThreadReply);
      room.on(MatrixEventEvent.BeforeRedaction, onBeforeRedaction);
      detachThreadListenersByRoomId.set(room.roomId, () => {
        room.off(ThreadEvent.New, onThreadNew);
        room.off(ThreadEvent.NewReply, onThreadReply);
        room.off(MatrixEventEvent.BeforeRedaction, onBeforeRedaction);
      });
    };
    // A joined / left / created room changes what the list shows; drop the
    // cached joined-room set so `getChats` re-reads it.
    const onRoom = (room: Room) => {
      attachThreadListeners(room);
      if (this.typingListeners.has(room.roomId)) {
        this.prepareTypingRoom(room);
      }
      this.joinedRoomIds = null;
      emitUnread(room);
      this.emit({ type: "chats:changed" });
    };
    // Reconnect / first authentic network sync. A warm start resolves the
    // initial sync from IndexedDB (`fromCache`) before the network catches up,
    // and a dropped connection resumes at `Syncing` from a non-`Syncing` state;
    // both can leave the `staleTime: Infinity` caches behind, so force a coarse
    // re-read of the visible rooms. Steady-state `Syncing → Syncing` and the
    // cache-sourced state are skipped, so this fires rarely.
    const onSync = (
      state: SyncState,
      prevState: SyncState | null,
      data?: SyncStateData,
    ) => {
      if (
        state !== SyncState.Syncing ||
        prevState === SyncState.Syncing ||
        data?.fromCache === true
      ) {
        return;
      }
      this.joinedRoomIds = null;
      for (const room of mx.getVisibleRooms()) {
        this.emit({ type: "chat:changed", chatId: room.roomId });
        emitUnread(room);
        emitThreadsRefresh(room);
      }
      this.emit({ type: "chats:changed" });
    };
    // Our own membership changing (leaving, being kicked/banned, joining) alters
    // the conversation list, but a leave is an ordinary incremental sync: it
    // fires neither `ClientEvent.Room` (the room is not brand-new) nor `onSync`
    // (steady-state `Syncing`). Drop the cached joined set and refresh the list
    // here so a left room does not linger. `onRoom` handles brand-new joins.
    const onMyMembership = (room: Room) => {
      this.joinedRoomIds = null;
      emitUnread(room);
      this.emit({ type: "chats:changed" });
    };
    mx.getRooms().forEach(attachThreadListeners);
    mx.on(RoomEvent.Timeline, onTimeline);
    mx.on(RoomEvent.Receipt, onReceipt);
    mx.on(RoomEvent.AccountData, onAccountData);
    mx.on(RoomEvent.Redaction, onRedaction);
    mx.on(RoomEvent.RedactionCancelled, onRedactionCancelled);
    mx.on(MatrixEventEvent.Replaced, onReplaced);
    mx.on(RoomMemberEvent.Typing, onTyping);
    mx.on(RoomMemberEvent.PowerLevel, onPowerLevel);
    mx.on(RoomStateEvent.Members, onMembers);
    mx.on(RoomEvent.Name, onName);
    mx.on(RoomEvent.Tags, onTags);
    mx.on(ClientEvent.Room, onRoom);
    mx.on(ClientEvent.Sync, onSync);
    mx.on(RoomEvent.MyMembership, onMyMembership);
    this.typingListeners.forEach((_listeners, roomId) => {
      const room = mx.getRoom(roomId);
      if (room) {
        this.prepareTypingRoom(room);
      }
    });
    this.detachSync = () => {
      mx.off(RoomEvent.Timeline, onTimeline);
      mx.off(RoomEvent.Receipt, onReceipt);
      mx.off(RoomEvent.AccountData, onAccountData);
      mx.off(RoomEvent.Redaction, onRedaction);
      mx.off(RoomEvent.RedactionCancelled, onRedactionCancelled);
      mx.off(MatrixEventEvent.Replaced, onReplaced);
      mx.off(RoomMemberEvent.Typing, onTyping);
      mx.off(RoomMemberEvent.PowerLevel, onPowerLevel);
      mx.off(RoomStateEvent.Members, onMembers);
      mx.off(RoomEvent.Name, onName);
      mx.off(RoomEvent.Tags, onTags);
      mx.off(ClientEvent.Room, onRoom);
      mx.off(ClientEvent.Sync, onSync);
      mx.off(RoomEvent.MyMembership, onMyMembership);
      detachThreadListenersByRoomId.forEach((detach) => detach());
      detachThreadListenersByRoomId.clear();
      pendingLiveThreadReplies.clear();
      pendingTypingRoomIds.clear();
    };
  }

  private async startClientOrFailOnLogout(mx: MatrixClient): Promise<void> {
    let cleanup = () => {};
    const loggedOut = new Promise<never>((_, reject) => {
      const onLoggedOut = (error: MatrixError) => {
        cleanup();
        reject(error);
      };
      cleanup = () => mx.off(HttpApiEvent.SessionLoggedOut, onLoggedOut);
      mx.once(HttpApiEvent.SessionLoggedOut, onLoggedOut);
    });

    try {
      await Promise.race([startClient(mx), loggedOut]);
    } finally {
      cleanup();
    }
  }

  /**
   * Wires OIDC token refresh for this session. Returns `undefined` when the
   * pieces needed to refresh are missing (no refresh token, no persisted OIDC
   * session) — the client then behaves as before, just without auto-refresh.
   * On a successful refresh the rotated tokens are persisted so the next page
   * load starts from a valid access token instead of a dead one.
   */
  private buildTokenRefreshFunction(user: MatrixUserInterface) {
    const oidc = this.readStoredJson<StoredOidc>(STORAGE.oidc);
    if (!oidc || !user.refreshToken || !user.deviceId) {
      return undefined;
    }
    return buildOidcTokenRefreshFunction({
      issuer: oidc.issuer,
      clientId: oidc.clientId,
      redirectUri: oidc.redirectUri,
      deviceId: user.deviceId,
      idTokenClaims: oidc.idTokenClaims,
      onTokensRefreshed: ({ accessToken, refreshToken }) => {
        this.writeStoredJson(STORAGE.user, {
          ...user,
          accessToken,
          refreshToken: refreshToken ?? user.refreshToken,
        } satisfies MatrixUserInterface);
      },
    });
  }

  private clearCallbackParams(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());
  }

  /**
   * Detaches the `/sync` bridge and drops every client-scoped cache. Safe to run
   * with no client. Subscribers are left alone: `clearStoredSession` reconnects
   * afterwards, and only {@link destroy} ends the stream for good.
   */
  private teardownClient(): void {
    this.detachSync();
    this.detachSync = () => {};
    this.typingListeners.forEach((listeners) => {
      listeners.forEach((listener) => listener([]));
    });
    this.typingSignatures.clear();
    this.typingRoomPreparations.clear();
    this.mx?.stopClient();
    this.mx = null;
    this.joinedRoomIds = null;
    this.messageWindowSessions.clear();
    this.mainReadMarkerQueues.clear();
    this.pendingMainFullyRead.clear();
    this.sentThreadReplyEventIds.clear();
    this.redactedThreadReplies.clear();
    this.redactedThreadReplyKeys.clear();
  }

  destroy(): void {
    this.teardownClient();
    this.eventListeners.clear();
    this.typingListeners.clear();
  }

  /**
   * Single global real-time stream. Subscribers just join/leave the set; the
   * Matrix `/sync` bridge that feeds them is attached for the client's lifetime
   * in {@link bootstrapClient} (it may not exist yet when the UI subscribes).
   * Events for ALL conversations flow through here, so the UI mounts this once.
   */
  subscribeToEvents(listener: ChatEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private typingUsersForRoom(room: Room): ChatTypingUser[] {
    const selfUserId = this.mx?.getUserId();
    return room
      .getJoinedMembers()
      .filter((member) => member.typing && member.userId !== selfUserId)
      .map((member) => ({ id: member.userId, name: member.name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private emitTyping(room: Room): void {
    const listeners = this.typingListeners.get(room.roomId);
    if (!listeners || listeners.size === 0) {
      return;
    }
    const users = this.typingUsersForRoom(room);
    const signature = users.map(({ id }) => id).join("\u0000");
    if (this.typingSignatures.get(room.roomId) === signature) {
      return;
    }
    this.typingSignatures.set(room.roomId, signature);
    listeners.forEach((listener) => listener(users));
  }

  /**
   * Typing state in matrix-js-sdk is stored on RoomMember instances. With
   * lazy-loaded members, a freshly invited user may initially know only their
   * own member while the inviter already knows both participants. Loading the
   * active room's members before observing typing removes that inviter/invitee
   * asymmetry without disabling lazy loading for every room in the account.
   */
  private prepareTypingRoom(room: Room): void {
    if (this.typingRoomPreparations.has(room.roomId)) {
      return;
    }
    const mx = this.mx;
    const preparation = room
      .loadMembersIfNeeded()
      .then(() => {
        if (this.mx !== mx || mx?.getRoom(room.roomId) !== room) {
          return;
        }
        // Membership hydration can change the snapshot without emitting a
        // typing transition. Force one post-hydration comparison.
        this.typingSignatures.delete(room.roomId);
        this.emitTyping(room);
      })
      // Typing is best-effort ephemeral state. A failed members request must
      // never prevent the rest of the room from loading.
      .catch(() => {})
      .finally(() => {
        if (this.typingRoomPreparations.get(room.roomId) === preparation) {
          this.typingRoomPreparations.delete(room.roomId);
        }
      });
    this.typingRoomPreparations.set(room.roomId, preparation);
  }

  subscribeToChatTyping(
    chatId: string,
    listener: ChatTypingListener,
  ): () => void {
    const listeners = this.typingListeners.get(chatId) ?? new Set();
    listeners.add(listener);
    this.typingListeners.set(chatId, listeners);
    const room = this.mx?.getRoom(chatId);
    listener(room ? this.typingUsersForRoom(room) : []);
    if (room) {
      this.prepareTypingRoom(room);
    }
    return () => {
      const current = this.typingListeners.get(chatId);
      current?.delete(listener);
      if (current?.size === 0) {
        this.typingListeners.delete(chatId);
      }
    };
  }

  private emit(event: ChatEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  // --- Token persistence (driver-owned, no separate store) ----------------

  /** Reads an account-scoped JSON blob, dropping it when it cannot be parsed. */
  private readStoredJson<T>(key: string): T | null {
    const storageKey = this.key(key);
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  private writeStoredJson(key: string, value: unknown): void {
    localStorage.setItem(this.key(key), JSON.stringify(value));
  }

  private async clearStoredSession(user?: MatrixUserInterface): Promise<void> {
    this.teardownClient();

    localStorage.removeItem(this.key(STORAGE.user));
    localStorage.removeItem(this.key(STORAGE.oidc));
    localStorage.removeItem(this.key(STORAGE.redactedThreads));
    sessionStorage.removeItem(this.key(STORAGE.oidcState));

    await Promise.all([
      this.deleteIndexedDb(this.key(SYNC_STORE_DB_NAME)),
      this.deleteIndexedDb(this.key(CRYPTO_STORE_DB_NAME)),
      ...(user ? [this.deleteIndexedDb(this.cryptoStoreDbName(user))] : []),
    ]);
  }

  private deleteIndexedDb(dbName: string): Promise<void> {
    if (typeof indexedDB === "undefined") {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn("MatrixDriver: failed to delete IndexedDB", dbName);
        resolve();
      };
      request.onblocked = () => {
        console.warn("MatrixDriver: IndexedDB deletion blocked", dbName);
        resolve();
      };
    });
  }

  private setStorageOwner(user: User | null | undefined): void {
    const owner = this.resolveLoginHint(user).trim();
    this.storageOwner = owner || null;
  }

  private key(key: string): string {
    return storageKey(this.accountId, key, this.storageOwner);
  }

  private cryptoStoreDbName(user: MatrixUserInterface): string {
    return this.key(
      `${CRYPTO_STORE_DB_NAME}:${user.mxId}:${user.deviceId ?? "no-device"}`,
    );
  }

  private async getJoinedRoomIds(mx: MatrixClient): Promise<Set<string>> {
    return this.joinedRoomIds ?? this.refreshJoinedRoomIds(mx);
  }

  private async refreshJoinedRoomIds(mx: MatrixClient): Promise<Set<string>> {
    const { joined_rooms: joinedRooms } = await mx.getJoinedRooms();
    const joinedRoomIds = new Set(joinedRooms);
    this.joinedRoomIds = joinedRoomIds;
    return joinedRoomIds;
  }
}
