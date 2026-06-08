import {
  EventType,
  type MatrixEvent
} from "matrix-js-sdk/lib/matrix";

import { type IdTokenClaims } from "oidc-client-ts";

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

import { createAuthenticationClient, restoreClient, validateNativeSlidingSync } from "@/features/matrix/clientBuilder";
import { loadMembers, updatedRooms } from "@/features/matrix/utils/room";
import { applyTimelineDiff, getEventContent, getEventSender, getEventTimestamp, getInternalId } from "@/features/matrix/utils/timeline";
import { ClientLike, ClientSessionDelegate, EventTimelineItem, LatestEventValue_Tags, RoomLike, RoomListEntriesUpdate, RoomListServiceLike, Session, SyncServiceLike, TimelineDiff, TimelineItem } from "@/index.web";
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
  // Rust SDK session data
  session: "matrixSession",
  storeId: "matrixStoreId",
  passphrase: "matrixPassphrase",
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

const matrixRoomToLocalChat = async (
  room: RoomLike,
  currentUserId: string | undefined,
): Promise<LocalChat> => {
  const members = await loadMembers(room);
  const participantIds = members.map(m => m.userId);
  const kind: LocalChat["kind"] =
    members.length === 2 ? "direct" : "group";
  const latestEvent = await room.latestEvent();
  let timestamp = 0
  if (latestEvent.tag == LatestEventValue_Tags.Remote) {
    timestamp = Number(latestEvent.inner.timestamp);
  }

  return {
    id: room.id(),
    name: room.displayName()|| room.id(),
    ...(timestamp > 0
      ? { lastActivityAt: new Date(timestamp).toISOString() }
      : {}),
    section: "all",
    kind,
    participantIds,
    visual:
      kind === "direct"
        ? { kind: "initials" as const }
        : { kind: "icon" as const, icon: "groups" },
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
const buildAuthors = async (
  room: RoomLike,
  events: EventTimelineItem[],
  selfUserId: string | undefined,
): Promise<ChatMessageAuthor[]> => {
  const senderIds = [
    ...new Set(
      events
        .map((event) => event.sender)
        .filter((id): id is string => Boolean(id) && id !== selfUserId),
    ),
  ];

  const getDisplayName = async (id: string) => {
    const name = await room.memberDisplayName(id);
    return { id, name: name || id };
  }
  const allDisplayName = await Promise.all(senderIds.map(getDisplayName));

  return allDisplayName.map(displayNameObject => {
    const name = displayNameObject.name;
    const id = displayNameObject.id;
    return { id, name, initials: initialsFor(name), color: colorFor(id) }
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
  private mx: ClientLike | null = null;
  /** Subscribers to the single global event stream. */
  private eventListeners = new Set<ChatEventListener>();
  /** Detaches the Matrix `/sync` listeners; set when the client is bootstrapped. */
  private detachSync: () => void = () => {};

  private roomListService: RoomListServiceLike | null = null;
  private roomListEntries: RoomListEntriesUpdate[] | null = null;
  private syncService: SyncServiceLike | null = null;
  /** Detaches the RoomListService listeners. */
  private detachRoomListListeners: () => void = () => {};

  /** Detaches the SyncService listeners. */
  private detachSyncListeners: () => void = () => { };

  constructor(
    accountId: AccountId = "default",
    settings: Record<string, unknown> = {},
  ) {
    super(accountId, settings);
  }

  private async initializeRoomListListener(): Promise<void> {
    if (!this.roomListService) return;
    const roomListLike = await this.roomListService.allRooms();
    // initialize room list listenner
    roomListLike.entriesWithDynamicAdapters(
      200,
      {
        onUpdate: (entries: RoomListEntriesUpdate[]) => {
          this.roomListEntries = entries;
          this.emit({ type: "chats:changed" })
        }
      }
    );
  }

  async getChats(): Promise<LocalChatSections> {
    // MOCK — replace this block with `fetchAPI('chats/')` when the backend
    // exposes a conversation-list endpoint. The driver returns account-local
    // chats; hooks decorate them with the global account identity.

    if (this.roomListEntries) return {
      favourites: [],
      all: [],
    };

    const currentUserId = this.mx?.userId() ?? undefined;

    // Get the current entries
    const entries = updatedRooms(this.roomListEntries || []);
    // Map room entries to local chats
    const localChats = await Promise.all(entries
      .map((roomEntry) => matrixRoomToLocalChat(roomEntry, currentUserId)));

    console.log(
      `[MatrixDriver.getChats] Loaded ${localChats.length} chats`,
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
      if (!this.mx) {
        throw new Error("MatrixDriver.getChatMessages: client is not connected.");
      }
      // Get room from client
      const room = this.mx.getRoom(chatId);
      if (!room) {
        throw new Error(
          `MatrixDriver.getChatMessages: room "${chatId}" not found.`,
        );
      }

        // Get the timeline for the room
      const timeline = await room.timeline();
      if (!timeline) {
        throw new Error(
          `MatrixDriver.getChatMessages: failed to get timeline for room "${chatId}".`,
        );
      }

      const selfUserId = this.mx.userId() ?? undefined;
      const items: TimelineItem[] = [];
      let reachedStart = false;

      // Create a temporary listener to capture timeline items
      const timelineListener = {
        onUpdate: (diffs: TimelineDiff[]): void => {
          for (const diff of diffs) {
            applyTimelineDiff(items, diff);
          }
        }
      };

      try {
        // Add listener to get current items
        const listener = await timeline.addListener(timelineListener);

        // Paginate backwards to load more items
        while (
          items.length < limit &&
          !reachedStart
        ) {
          const hasMore = await timeline.paginateBackwards(limit);
          if (!hasMore) {
            reachedStart = true;
          }
        }

        // Clean up listener
        listener.cancel();

        // Find cursor position
        let endIndex = items.length;
        if (cursor) {
          endIndex = items.findIndex(
            (item) => getInternalId(item) === cursor,
          );

          if (endIndex < 0) {
            throw new Error(
              `MatrixDriver.getChatMessages: cursor "${cursor}" not found in room "${chatId}".`,
            );
          }
        }

        const startIndex = Math.max(0, endIndex - limit);
        const pageItems = items.slice(startIndex, endIndex);
        const pageEvents: EventTimelineItem[] = pageItems.filter(i => i.asEvent()).map(i => i.asEvent()!) || [];

        // Map timeline items to chat messages
        const messages: ChatMessage[] = pageItems
          .map((item) => {
            try {
              const eventId = getInternalId(item);
              const event = item.asEvent()!;
              const timestamp = getEventTimestamp(event);
              const content = getEventContent(event);
              const sender = getEventSender(event);

              return {
                id: eventId,
                authorId: toAuthorId(sender || "", selfUserId),
                content,
                timestamp,
              };
            } catch (e) {
              console.warn(
                "[MatrixDriver.getChatMessages] Failed to map event:",
                e,
              );
              return null;
            }
          })
          .filter((msg): msg is ChatMessage => msg !== null);

        // Build authors map from events
        const authors = await buildAuthors(room, pageEvents, selfUserId);

        // Determine next cursor for pagination
        const nextCursor =
          startIndex === 0 && reachedStart ? null : (messages[0]?.id ?? null);

        console.log(
          `[MatrixDriver.getChatMessages] Loaded ${messages.length} messages for room ${chatId}`,
        );

        return { messages, authors, nextCursor };
      } catch (error) {
        console.error(
          "[MatrixDriver.getChatMessages] Error fetching messages:",
          error,
        );
        throw error;
      }
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
    if (this.mx && this.mx.userId() === user.mxId) {
      return;
    }

    // Create a session delegate to handle session updates
    const sessionDelegate: ClientSessionDelegate = {
      retrieveSessionFromKeychain: (userId: string): Session => {
             console.log(
               `[MatrixDriver.SessionDelegate] Retrieving session for user: ${userId}`,
             );

             const savedSession = this.readStoredSession();
             if (!savedSession) {
               throw new Error(
                 `[MatrixDriver.SessionDelegate] No session found for user ${userId}`,
               );
             }

             console.log(
               `[MatrixDriver.SessionDelegate] Session retrieved: userId=${savedSession.userId()}`,
             );
             return savedSession;
           },

           saveSessionInKeychain: (session: Session): void => {
             console.log(
               `[MatrixDriver.SessionDelegate] Saving session for user: ${session.userId}`,
             );
             console.log(
               `[MatrixDriver.SessionDelegate] Session details: ` +
                 `hasAccessToken=${!!session.accessToken}, ` +
                 `hasRefreshToken=${!!session.refreshToken}`,
             );

             // Persist the session to localStorage
             this.persistSession(session);
             console.log(
               `[MatrixDriver.SessionDelegate] Session saved successfully`,
             );
           },
    };

    // Try to restore from saved session first
    const savedSession = this.readStoredSession();
    const storeId = this.readStoredStoreId();
    const passphrase = this.readStoredPassphrase();

    try {
      if (savedSession && storeId && passphrase) {
        console.log("[bootstrapClient] Attempting to restore session");
        const client = await restoreClient(
          savedSession,
          passphrase,
          storeId,
          sessionDelegate,
        );
        validateNativeSlidingSync(client);
        this.mx = client;
        console.log("[bootstrapClient] Session restored successfully");
      } else {
        console.log("[bootstrapClient] Creating new authentication client");
        // Create new client for authentication
        const { client, passphrase: newPassphrase, storeId: newStoreId } =
          await createAuthenticationClient(user.homeserverUrl, sessionDelegate);

        // TODO: Build client with proper configuration
        // const finalClient = await client
        //   .homeserverUrl(user.homeserverUrl)
        //   .build();

        validateNativeSlidingSync(client);
        this.mx = client;

        // TODO: Save session after login completion
        // const session = await finalClient.getSession();
        // this.persistSession(session);
        this.persistStoreId(newStoreId);
        this.persistPassphrase(newPassphrase);
      }

      // TODO: Wire up event listeners once SDK provides event system
      // const onTimelineEvent = (event: RoomTimelineEvent) => {
      //   this.emit({ type: "chat:changed", chatId: event.roomId });
      // };
      // const onRoomUpdate = () => {
      //   this.emit({ type: "chats:changed" });
      // };
      // this.detachSync = () => {
      //   this.mx?.offRoomTimelineEvent(onTimelineEvent);
      //   this.mx?.offRoomUpdate(onRoomUpdate);
      // };
    } catch (error) {
      console.error("[bootstrapClient] Failed to bootstrap client:", error);
      this.mx = null;
      throw error;
    }

    // Bridge Matrix `/sync` onto the generic event stream, once, for the
    // client's lifetime. The handlers fan out to whatever subscribers exist at
    // the time (an empty set is a harmless no-op). Until the Matrix → generic
    // data mapping lands, only COARSE events are emitted (per-room
    // `chat:changed`, list-level `chats:changed`); fine-grained payload events
    // (`message:new`, `reaction:updated`) get emitted here once it does.
    // Set up RoomListService
    this.detachRoomListListeners();
    this.syncService = await this.mx.syncService().withOfflineMode().finish();
    this.roomListService = this.syncService.roomListService();
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


  private readStoredSession(): Session | null {
    const raw = localStorage.getItem(this.key(STORAGE.session));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as Session;
    } catch {
      localStorage.removeItem(this.key(STORAGE.session));
      return null;
    }
  }

  private persistSession(session: Session): void {
    localStorage.setItem(this.key(STORAGE.session), JSON.stringify(session));
  }

  private readStoredStoreId(): string | null {
    return localStorage.getItem(this.key(STORAGE.storeId));
  }

  private persistStoreId(storeId: string): void {
    localStorage.setItem(this.key(STORAGE.storeId), storeId);
  }

  private readStoredPassphrase(): string | null {
    return localStorage.getItem(this.key(STORAGE.passphrase));
  }

  private persistPassphrase(passphrase: string): void {
    localStorage.setItem(this.key(STORAGE.passphrase), passphrase);
  }

  private key(key: string): string {
    return storageKey(this.accountId, key);
  }
}
