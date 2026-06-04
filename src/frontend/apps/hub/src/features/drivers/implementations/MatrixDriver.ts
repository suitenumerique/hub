import {
  ClientEvent,
  EventType,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  RoomEvent,
} from "matrix-js-sdk/lib/matrix";

import { type IdTokenClaims } from "oidc-client-ts";

import { initClient, startClient } from "@/features/matrix/initMatrix";
import { MatrixUserInterface } from "@/features/matrix/types";
import {
  buildOidcTokenRefreshFunction,
  completeOidcLogin,
  getOIDCAuthUrl,
  getUserIdFromAccessToken,
} from "@/features/matrix/utils/auth";
import { fetchHomeserverForEmail } from "@/features/matrix/utils/autodiscovery";
import {
  AVATAR_COLORS,
  AvatarColor,
} from "@/features/ui/components/avatar/palette";

import {
  ChatConnectionState,
  ChatEvent,
  ChatEventListener,
  GetChatMessagesParams,
} from "../Driver";
import {
  AccountId,
  ChatLocalUser,
  ChatMessage,
  ChatMessageAuthor,
  ChatMessagesPage,
  ChatThreadMutationResult,
  LocalChat,
  LocalChatSections,
  User,
} from "../types";
import { MockDriver } from "./MockDriver";

/** Matches `getChatMessages`'s default; the homeserver may clamp it lower. */
const DEFAULT_CHAT_PAGE_SIZE = 50;

// localStorage keys owned by this driver. Token persistence lives in the
// driver itself — there is no separate store module; everything else flows
// through React Query.
const STORAGE = {
  user: "matrixUser",
  // Everything needed to refresh the OIDC access token on a later page load.
  oidc: "matrixOidc",
  oidcState: "oidc_state",
} as const;

/** OIDC session data persisted so tokens can be refreshed after a reload. */
type StoredOidc = {
  clientId: string;
  issuer: string;
  idToken: string;
  idTokenClaims: IdTokenClaims;
  redirectUri: string;
};
const OIDC_HS_KEY = "oidc_hs";
const SYNC_STORE_DB_NAME = "matrix-web-sync-store";
const CRYPTO_STORE_DB_NAME = "crypto-store";

const storageKey = (accountId: AccountId, key: string): string =>
  accountId === "default" ? key : `${key}:${accountId}`;

const toChatUser = (user: MatrixUserInterface): ChatLocalUser => ({
  userId: user.mxId,
  accessToken: user.accessToken,
  refreshToken: user.refreshToken,
});

const matrixRoomToLocalChat = (
  room: Room,
  currentUserId: string | undefined,
): LocalChat => {
  const participantIds = room
    .getMembers()
    .map((member) => member.userId)
    .filter((userId) => userId !== currentUserId);
  const kind: LocalChat["kind"] =
    room.getJoinedMemberCount() === 2 ? "direct" : "group";
  const timestamp = room.getLastActiveTimestamp();

  return {
    id: room.roomId,
    name: room.name || participantIds[0] || room.roomId,
    ...(timestamp > 0
      ? { lastActivityAt: new Date(timestamp).toISOString() }
      : {}),
    section: "all",
    kind,
    participantIds,
    visual:
      kind === "direct"
        ? { kind: "initials" }
        : { kind: "icon", icon: "groups" },
  };
};

/**
 * Deterministic avatar identity for a Matrix sender, mirroring the `Avatar`
 * component's own hashing so a member keeps the same colour everywhere it is
 * rendered. The driver depends only on the palette, not on the React component.
 */
const hashString = (value: string): number => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
};

const colorFor = (seed: string): AvatarColor =>
  AVATAR_COLORS[hashString(seed) % AVATAR_COLORS.length];

const initialsFor = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return letters || "?";
};

/**
 * The chat UI marks a message as "sent by me" when its `authorId` is the
 * literal `"me"` (see `ChatVirtualList`). Matrix has no notion of the Hub user,
 * and the two identities are not linked yet, so the driver simply folds the
 * connected Matrix user onto that sentinel: whoever is logged into Matrix *is*
 * "me" for display purposes. Everyone else keeps their raw `mxId`.
 */
const SELF_AUTHOR_ID = "me";

const toAuthorId = (
  sender: string | undefined,
  selfUserId: string | undefined,
): string =>
  sender && sender === selfUserId ? SELF_AUTHOR_ID : (sender ?? "");

/** Timeline entries the chat UI renders as message bubbles. */
const isMessageEvent = (event: MatrixEvent): boolean =>
  event.getType() === EventType.RoomMessage && !event.isRedacted();

const matrixEventToChatMessage = (
  event: MatrixEvent,
  selfUserId: string | undefined,
): ChatMessage => {
  const body = event.getContent<{ body?: string }>().body;
  return {
    id: event.getId() ?? "",
    authorId: toAuthorId(event.getSender(), selfUserId),
    content: typeof body === "string" ? body : "",
    timestamp: new Date(event.getTs()).toISOString(),
    // Reactions and thread summaries come from relation aggregation — wired in
    // a later step, once the timeline mapping is in place.
    reactions: [],
  };
};

/**
 * One `ChatMessageAuthor` per distinct *other* sender across the given events.
 * The current user is omitted: their messages render as "sent" bubbles, which
 * never look an author up (see `ChatVirtualList`).
 */
const buildAuthors = (
  room: Room,
  events: MatrixEvent[],
  selfUserId: string | undefined,
): ChatMessageAuthor[] => {
  const senderIds = [
    ...new Set(
      events
        .map((event) => event.getSender())
        .filter((id): id is string => Boolean(id) && id !== selfUserId),
    ),
  ];
  return senderIds.map((id) => {
    const name = room.getMember(id)?.name ?? id;
    return { id, name, initials: initialsFor(name), color: colorFor(id) };
  });
};

/**
 * Resolves the OIDC `login_hint`. In production this is the authenticated Hub
 * user's email; in development a fixed test account can be injected through
 * `NEXT_PUBLIC_MATRIX_DEV_LOGIN_HINT` (instead of the previously hard-coded
 * address) so demos do not require a real Tchap mailbox.
 */
const resolveLoginHint = (user: User | null | undefined): string => {
  const devHint = process.env.NEXT_PUBLIC_MATRIX_DEV_LOGIN_HINT;
  if (process.env.NODE_ENV === "development" && devHint) {
    return devHint;
  }
  return user?.email ?? "";
};

/**
 * Matrix-backed chat driver. All Matrix specifics — the OIDC handshake, client
 * bootstrap and `/sync` long-polling — live here, behind the generic `Driver`
 * contract, so the UI never imports anything Matrix.
 *
 * Chat *data* is currently still served by the mock methods inherited from
 * `MockDriver`: the Matrix → generic data mapping (timeline → ChatMessage…) is
 * the next step. The connection lifecycle and the real-time bridge below are
 * the real plumbing that mapping will hang off.
 */
export class MatrixDriver extends MockDriver {
  override readonly supportsComposition: boolean = false;

  private mx: MatrixClient | null = null;
  /** Subscribers to the single global event stream. */
  private eventListeners = new Set<ChatEventListener>();
  /** Detaches the Matrix `/sync` listeners; set when the client is bootstrapped. */
  private detachSync: () => void = () => {};

  constructor(
    accountId: AccountId = "default",
    settings: Record<string, unknown> = {},
  ) {
    super(accountId, settings);
  }

  async getChats(): Promise<LocalChatSections> {
    // MOCK — replace this block with `fetchAPI('chats/')` when the backend
    // exposes a conversation-list endpoint. The driver returns account-local
    // chats; hooks decorate them with the global account identity.
    const matrixChats = this.mx?.getVisibleRooms() ?? [];
    const currentUserId = this.mx?.getUserId() ?? undefined;
    const localChats = matrixChats.map((room) =>
      matrixRoomToLocalChat(room, currentUserId),
    );

    return {
      favourites: [],
      all: localChats,
    };
    // return super.getChats();
  }

  /**
   * Reads a page of timeline history for a room, oldest-message-first. Backed by
   * the Matrix live timeline rather than a raw `/messages` call so events are
   * decrypted and de-duplicated by the SDK. The cursor is the oldest message id
   * of the previous page (see `nextCursor` below); the live timeline is
   * paginated backwards until enough history is in memory to fill the page, or
   * the start of the room is reached.
   */
  async getChatMessages({
    chatId,
    cursor,
    limit = DEFAULT_CHAT_PAGE_SIZE,
  }: GetChatMessagesParams): Promise<ChatMessagesPage> {
    const mx = this.mx;
    if (!mx) {
      throw new Error("MatrixDriver.getChatMessages: client is not connected.");
    }
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(
        `MatrixDriver.getChatMessages: room "${chatId}" not found.`,
      );
    }

    const timeline = room.getLiveTimeline();
    const loaded = () => timeline.getEvents().filter(isMessageEvent);

    // Number of message events strictly older than the cursor currently in
    // memory; without a cursor every loaded message counts (latest page).
    let events = loaded();
    const eventsBeforeCursor = () =>
      cursor
        ? events.findIndex((event) => event.getId() === cursor)
        : events.length;

    let reachedStart = false;
    while (eventsBeforeCursor() < limit) {
      const more = await mx.paginateEventTimeline(timeline, {
        backwards: true,
        limit,
      });
      events = loaded();
      if (!more) {
        reachedStart = true;
        break;
      }
    }

    let endIndex = events.length;
    if (cursor) {
      endIndex = events.findIndex((event) => event.getId() === cursor);
      if (endIndex < 0) {
        throw new Error(
          `MatrixDriver.getChatMessages: cursor "${cursor}" not found in room "${chatId}".`,
        );
      }
    }
    const startIndex = Math.max(0, endIndex - limit);
    const pageEvents = events.slice(startIndex, endIndex);

    // The connected Matrix user is folded onto the "me" sentinel so their
    // messages render as "sent" (see `toAuthorId`).
    const selfUserId = mx.getUserId() ?? undefined;
    const messages = pageEvents.map((event) =>
      matrixEventToChatMessage(event, selfUserId),
    );
    const authors = buildAuthors(room, pageEvents, selfUserId);
    const nextCursor =
      startIndex === 0 && reachedStart ? null : (messages[0]?.id ?? null);
    return { messages, authors, nextCursor };
  }

  async sendChatMessage(): Promise<ChatMessage> {
    throw new Error(
      "MatrixDriver.sendChatMessage: Matrix composition is not implemented yet.",
    );
  }

  async sendChatThreadReply(): Promise<ChatThreadMutationResult> {
    throw new Error(
      "MatrixDriver.sendChatThreadReply: Matrix composition is not implemented yet.",
    );
  }

  async startChatThread(): Promise<ChatThreadMutationResult> {
    throw new Error(
      "MatrixDriver.startChatThread: Matrix composition is not implemented yet.",
    );
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

    // 1. Returning user — credentials already persisted.
    const stored = this.readStoredUser();
    if (stored) {
      await this.bootstrapClient(stored);
      return { status: "connected", chatUser: toChatUser(stored) };
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
    const email = resolveLoginHint(user);
    let homeserver = sessionStorage.getItem(this.key(OIDC_HS_KEY));
    if (!homeserver) {
      const discovered = await fetchHomeserverForEmail(email);
      homeserver = discovered.base_url;
      sessionStorage.setItem(this.key(OIDC_HS_KEY), homeserver);
    }
    const authUrl = await getOIDCAuthUrl(homeserver, email);
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
    const homeserver = sessionStorage.getItem(this.key(OIDC_HS_KEY));
    if (!homeserver) {
      throw new Error(
        "MatrixDriver: missing homeserver while completing the OIDC callback.",
      );
    }
    const oidc = await completeOidcLogin({ code, state });
    const {
      user_id: mxId,
      device_id: deviceId,
      is_guest: guest,
    } = await getUserIdFromAccessToken(oidc.accessToken, homeserver);

    const matrixUser: MatrixUserInterface = {
      homeserverUrl: homeserver,
      mxId,
      deviceId,
      accessToken: oidc.accessToken,
      refreshToken: oidc.refreshToken,
      guest,
    };
    this.persistUser(matrixUser);
    this.persistOidc({
      clientId: oidc.clientId,
      issuer: oidc.issuer,
      idToken: oidc.idToken,
      idTokenClaims: oidc.idTokenClaims,
      // The IdP redirected back to this exact URL, so origin + pathname is the
      // redirect URI registered for this client.
      redirectUri: new URL(window.location.origin + window.location.pathname)
        .href,
    });
    sessionStorage.removeItem(this.key(STORAGE.oidcState));
    sessionStorage.removeItem(this.key(OIDC_HS_KEY));
    return matrixUser;
  }

  private async bootstrapClient(user: MatrixUserInterface): Promise<void> {
    if (this.mx && this.mx.getUserId() === user.mxId) {
      return;
    }
    const mx = await initClient(user, {
      syncStoreDbName: this.key(SYNC_STORE_DB_NAME),
      cryptoStoreDbName: this.key(CRYPTO_STORE_DB_NAME),
      tokenRefreshFunction: this.buildTokenRefreshFunction(user),
    });
    await startClient(mx);
    this.mx = mx;

    // Bridge Matrix `/sync` onto the generic event stream, once, for the
    // client's lifetime. The handlers fan out to whatever subscribers exist at
    // the time (an empty set is a harmless no-op). Until the Matrix → generic
    // data mapping lands, only COARSE events are emitted (per-room
    // `chat:changed`, list-level `chats:changed`); fine-grained payload events
    // (`message:new`, `reaction:updated`) get emitted here once it does.
    this.detachSync();
    const onTimeline = (_event: MatrixEvent, room?: Room) => {
      if (room) {
        this.emit({ type: "chat:changed", chatId: room.roomId });
      }
    };
    const onRoom = () => this.emit({ type: "chats:changed" });
    mx.on(RoomEvent.Timeline, onTimeline);
    mx.on(ClientEvent.Room, onRoom);
    this.detachSync = () => {
      mx.off(RoomEvent.Timeline, onTimeline);
      mx.off(ClientEvent.Room, onRoom);
    };
  }

  /**
   * Wires OIDC token refresh for this session. Returns `undefined` when the
   * pieces needed to refresh are missing (no refresh token, no persisted OIDC
   * session) — the client then behaves as before, just without auto-refresh.
   * On a successful refresh the rotated tokens are persisted so the next page
   * load starts from a valid access token instead of a dead one.
   */
  private buildTokenRefreshFunction(user: MatrixUserInterface) {
    const oidc = this.readStoredOidc();
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
        this.persistUser({
          ...user,
          accessToken,
          refreshToken: refreshToken ?? user.refreshToken,
        });
      },
    });
  }

  private clearCallbackParams(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());
  }

  destroy(): void {
    this.detachSync();
    this.detachSync = () => {};
    this.eventListeners.clear();
    this.mx?.stopClient();
    this.mx = null;
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

  private emit(event: ChatEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  // --- Token persistence (driver-owned, no separate store) ----------------

  private readStoredUser(): MatrixUserInterface | null {
    const raw = localStorage.getItem(this.key(STORAGE.user));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as MatrixUserInterface;
    } catch {
      localStorage.removeItem(this.key(STORAGE.user));
      return null;
    }
  }

  private persistUser(user: MatrixUserInterface): void {
    localStorage.setItem(this.key(STORAGE.user), JSON.stringify(user));
  }

  private readStoredOidc(): StoredOidc | null {
    const raw = localStorage.getItem(this.key(STORAGE.oidc));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as StoredOidc;
    } catch {
      localStorage.removeItem(this.key(STORAGE.oidc));
      return null;
    }
  }

  private persistOidc(oidc: StoredOidc): void {
    localStorage.setItem(this.key(STORAGE.oidc), JSON.stringify(oidc));
  }

  private key(key: string): string {
    return storageKey(this.accountId, key);
  }
}
