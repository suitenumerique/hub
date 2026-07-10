import {
  ClientEvent,
  EventType,
  KnownMembership,
  MatrixError,
  type MatrixClient,
  type MatrixEvent,
  Preset,
  RelationType,
  type Room,
  RoomEvent,
  SyncState,
  type SyncStateData,
} from "matrix-js-sdk/lib/matrix";
import { HttpApiEvent } from "matrix-js-sdk/lib/http-api";

import { type IdTokenClaims } from "oidc-client-ts";

import {
  type MatrixDriverSettings,
  parseMatrixDriverSettings,
  TCHAP_HOMESERVER_LIST,
} from "@/features/matrix/config";
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
  ChatUserFilters,
  GetChatMessagesParams,
  SendChatMessageParams,
} from "../Driver";
import {
  AccountId,
  ChatLocalUser,
  ChatMessage,
  ChatMessageAuthor,
  ChatMessagesPage,
  ChatThreadMutationResult,
  ChatUser,
  LocalChat,
  LocalChatSections,
  User,
} from "../types";
import { MockDriver } from "./MockDriver";

/** Matches `getChatMessages`'s default; the homeserver may clamp it lower. */
const DEFAULT_CHAT_PAGE_SIZE = 50;

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

/**
 * The members that make up a conversation: everyone except the connected user
 * whose membership is `join` or `invite`. Left/banned members are excluded so
 * they neither inflate a group nor linger in its name; invited members are kept
 * so a just-created conversation already shows its counterpart(s) before they
 * accept. Single source for `kind`/`name` in `matrixRoomToLocalChat` and the set
 * `getChatForUsers` matches against, so the two can never disagree.
 */
const roomOtherMembers = (room: Room, currentUserId: string | undefined) =>
  room
    .getMembers()
    .filter(
      (member) =>
        member.userId !== currentUserId &&
        (member.membership === KnownMembership.Join ||
          member.membership === KnownMembership.Invite),
    );

const roomParticipantIds = (
  room: Room,
  currentUserId: string | undefined,
): string[] =>
  roomOtherMembers(room, currentUserId).map((member) => member.userId);

/** Order- and duplicate-independent key for comparing two participant sets. */
const participantSetKey = (userIds: string[]): string =>
  [...new Set(userIds)].sort().join(" ");

/** The room's explicit `m.room.name`, when set to a non-empty value. */
const explicitRoomName = (room: Room): string | undefined => {
  const name = room.currentState
    ?.getStateEvents(EventType.RoomName, "")
    ?.getContent<{ name?: string }>()?.name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
};

const matrixRoomToLocalChat = (
  room: Room,
  currentUserId: string | undefined,
): LocalChat => {
  const others = roomOtherMembers(room, currentUserId);
  const participantIds = others.map((member) => member.userId);
  // Direct = exactly one counterpart (join or invite). Based on the participant
  // set rather than the joined-member count, so a just-created DM stays direct
  // before its invitee accepts.
  const isDirect = participantIds.length === 1;
  const otherNames = others.map((member) => member.name || member.userId);
  const timestamp = room.getLastActiveTimestamp();

  // A 1:1 is identified by the other person and ignores any room name (DMs
  // aren't renameable). A group uses its explicit name when set, otherwise the
  // members' display names so the header/list show everyone — not just the
  // first participant.
  const name = isDirect
    ? otherNames[0] || participantIds[0] || room.roomId
    : explicitRoomName(room) || otherNames.join(", ") || room.roomId;

  return {
    id: room.roomId,
    name,
    ...(timestamp > 0
      ? { lastActivityAt: new Date(timestamp).toISOString() }
      : {}),
    section: "all",
    kind: isDirect ? "direct" : "group",
    participantIds,
    visual: isDirect
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

/** The localpart of `@alice:server` → `alice`; a sensible fallback display name. */
const localpartOf = (userId: string): string =>
  userId.replace(/^@/, "").split(":")[0];

/** One homeserver user-directory result, narrowed to the fields the UI needs. */
type MatrixDirectoryUser = { user_id: string; display_name?: string };

/**
 * A directory search result mapped to the New Chat people shape. The Matrix id
 * is the stable handle the whole flow keys on (search → chip → existing-chat
 * resolution), so it is the `ChatUser.id`; the same id is the secondary line and
 * fills `email` (the directory carries no email, and the New Chat UI does not
 * render it). Initials and colour reuse the driver's own helpers so a person
 * looks identical in search, chips and message bubbles.
 */
const matrixDirectoryUserToChatUser = (user: MatrixDirectoryUser): ChatUser => {
  const name = user.display_name?.trim() || localpartOf(user.user_id);
  return {
    id: user.user_id,
    name,
    initials: initialsFor(name),
    color: colorFor(user.user_id),
    email: user.user_id,
    subtitle: user.user_id,
  };
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
 * A stable `ChatMessage` for a just-sent event, folded onto the `"me"` sentinel
 * with the REAL server event id so the composer hook can swap its optimistic
 * bubble for a `/sync`-consistent message. Kept a pure function so the send
 * mapping is unit-testable without a live server.
 */
const sendResponseToChatMessage = (
  eventId: string,
  content: string,
): ChatMessage => ({
  id: eventId,
  authorId: SELF_AUTHOR_ID,
  content,
  timestamp: new Date().toISOString(),
  reactions: [],
});

/**
 * True when `event` is THIS session's own outgoing echo — a local echo still in
 * flight (`status` set) or the remote echo the homeserver returned to the
 * sending device (`unsigned.transaction_id` / a local `txnId`). Those are
 * reconciled by the composer hook's optimistic→replace flow, so the sync bridge
 * must not re-broadcast them (that would duplicate the bubble).
 *
 * Deliberately NARROWER than "sent by the current user": the same user sending
 * from ANOTHER device (e.g. Element) carries no local txn id here, so that
 * message is delivered live like any other incoming one.
 */
const isOwnEcho = (event: MatrixEvent): boolean =>
  event.status !== null ||
  Boolean(event.getUnsigned()?.transaction_id) ||
  Boolean(event.getTxnId());

/**
 * Translates a single LIVE timeline event into the fine-grained `ChatEvent`s the
 * sync bridge should broadcast — an array, since "broadcast nothing" is a valid
 * outcome. Pure (no client, no driver state) so the mapping is unit-testable.
 *
 * Scope for this step is text messages only: a plain message becomes
 * `message:new` (with its `authors`) and an edit (`m.replace`) becomes
 * `message:updated`. Reactions are ignored (a later step owns them), and
 * everything else — redactions, thread replies, membership, other state — stays
 * coarse (`chat:changed`) so the affected caches refetch. This session's own
 * echo returns `[]`: the optimistic→replace flow already rendered it, so
 * re-broadcasting would duplicate the message.
 */
export const timelineEventToChatEvent = (
  event: MatrixEvent,
  room: Room,
  selfUserId: string | undefined,
): ChatEvent[] => {
  // Reactions reach the UI through a dedicated relation bridge in a later step;
  // ignoring them here avoids a full conversation refetch on every annotation.
  if (event.getType() === EventType.Reaction) {
    return [];
  }

  // Non-text activity (redactions, membership, other state) stays coarse.
  if (!isMessageEvent(event)) {
    return [{ type: "chat:changed", chatId: room.roomId }];
  }

  // Our own echo is already on screen via the optimistic bubble; suppressing it
  // here is what keeps a Hub-sent message from rendering twice.
  if (isOwnEcho(event)) {
    return [];
  }

  // A thread reply does not live in the main timeline. Threads are a later step,
  // so refresh the conversation coarsely rather than mis-appending it as a
  // top-level bubble.
  if (event.threadRootId) {
    return [{ type: "chat:changed", chatId: room.roomId }];
  }

  // An edit (`m.replace`) updates an existing bubble in place.
  const relation = event.getRelation();
  if (relation?.rel_type === RelationType.Replace && relation.event_id) {
    const newBody = event.getContent<{ "m.new_content"?: { body?: string } }>()[
      "m.new_content"
    ]?.body;
    // Keep the ORIGINAL send time. `matrixEventToChatMessage` (history reads)
    // dates an edited message from its original event, so using the edit event's
    // ts here would make the bubble's time jump live, then revert on the next
    // refetch. Fall back to the edit ts only when the original is not loaded.
    const original = room.findEventById(relation.event_id);
    return [
      {
        type: "message:updated",
        chatId: room.roomId,
        message: {
          id: relation.event_id,
          authorId: toAuthorId(event.getSender(), selfUserId),
          content: typeof newBody === "string" ? newBody : "",
          timestamp: new Date(original?.getTs() ?? event.getTs()).toISOString(),
          reactions: [],
        },
      },
    ];
  }

  // A plain new message from anyone else (including the same user on another
  // device) appears live.
  return [
    {
      type: "message:new",
      chatId: room.roomId,
      message: matrixEventToChatMessage(event, selfUserId),
      authors: buildAuthors(room, [event], selfUserId),
    },
  ];
};

/**
 * Matrix-backed chat driver. All Matrix specifics — the OIDC handshake, client
 * bootstrap and `/sync` long-polling — live here, behind the generic `Driver`
 * contract, so the UI never imports anything Matrix.
 *
 * Room and message reads are Matrix-backed, `/sync` is bridged onto the generic
 * real-time event stream, and text messages are sent through the live client.
 * Threads, reactions and documents remain intentionally unimplemented in this
 * step.
 */
export class MatrixDriver extends MockDriver {
  override readonly supportsComposition: boolean = true;
  override readonly supportsConversationCreation: boolean = true;

  private mx: MatrixClient | null = null;
  /** Subscribers to the single global event stream. */
  private eventListeners = new Set<ChatEventListener>();
  /** Detaches the Matrix `/sync` listeners; set when the client is bootstrapped. */
  private detachSync: () => void = () => {};
  /** Parsed per-account config; source of truth for discovery and OIDC. */
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

  constructor(
    accountId: AccountId = "default",
    settings: Record<string, unknown> = {},
  ) {
    super(accountId, settings);
    this.settings = parseMatrixDriverSettings(settings);
  }

  /**
   * Resolves the OIDC `login_hint`. Preference order: account config, dev
   * override, then the authenticated Hub user's email.
   */
  private resolveLoginHint(user: User | null | undefined): string {
    if (this.settings.loginHint) {
      return this.settings.loginHint;
    }
    const devHint = process.env.NEXT_PUBLIC_MATRIX_DEV_LOGIN_HINT;
    if (process.env.NODE_ENV === "development" && devHint) {
      return devHint;
    }
    return user?.email ?? "";
  }

  /**
   * Resolves the homeserver per account strategy. `fixed` uses the configured
   * base URL directly; `tchap-email` keeps the original identity-server lookup.
   */
  private async discoverHomeserver(
    loginHint: string,
  ): Promise<{ base_url: string; server_name: string }> {
    if (this.settings.discovery === "fixed") {
      return {
        base_url: this.settings.baseUrl,
        server_name: this.settings.serverName,
      };
    }
    return fetchHomeserverForEmail(loginHint, TCHAP_HOMESERVER_LIST);
  }

  async getChats(): Promise<LocalChatSections> {
    const mx = this.mx;
    if (!mx) {
      return {
        favourites: [],
        all: [],
      };
    }
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    const matrixChats = mx
      .getVisibleRooms()
      .filter((room) => joinedRoomIds.has(room.roomId));
    const currentUserId = mx.getUserId() ?? undefined;
    const localChats = matrixChats.map((room) =>
      matrixRoomToLocalChat(room, currentUserId),
    );

    return {
      favourites: [],
      all: localChats,
    };
  }

  async getChat(chatId: string): Promise<LocalChat> {
    const mx = this.mx;
    if (!mx) {
      throw new Error("MatrixDriver.getChat: client is not connected.");
    }
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    if (!joinedRoomIds.has(chatId)) {
      throw new Error(`MatrixDriver.getChat: room "${chatId}" is not joined.`);
    }
    const room = mx.getRoom(chatId);
    if (!room) {
      throw new Error(`MatrixDriver.getChat: room "${chatId}" not found.`);
    }
    return matrixRoomToLocalChat(room, mx.getUserId() ?? undefined);
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
   * the requested Matrix ids — order- and duplicate-independent, the same
   * set-equality the mock honours. One rule serves both direct (one other
   * member) and group (several) conversations. `null` lets the UI keep the
   * placeholder for a genuinely new conversation.
   */
  async getChatForUsers(userIds: string[]): Promise<LocalChat | null> {
    const mx = this.mx;
    if (!mx || userIds.length === 0) {
      return null;
    }
    const selfUserId = mx.getUserId() ?? undefined;
    const wanted = participantSetKey(userIds);
    // Gate on the server-confirmed joined set (like getChats/getChat/
    // getChatMessages), not `getMyMembership()`: a stale room restored from
    // IndexedDB after a homeserver reset can still report membership "join"
    // locally, and must not resolve as an existing conversation (its getChat
    // would then throw "not joined" and block creating a fresh one).
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    const match = mx
      .getVisibleRooms()
      .filter((room) => joinedRoomIds.has(room.roomId))
      .find(
        (room) =>
          participantSetKey(roomParticipantIds(room, selfUserId)) === wanted,
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
    const mx = this.mx;
    if (!mx) {
      throw new Error(
        "MatrixDriver.createChatForUsers: client is not connected.",
      );
    }
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
    const joinedRoomIds = await this.getJoinedRoomIds(mx);
    if (!joinedRoomIds.has(chatId)) {
      throw new Error(
        `MatrixDriver.getChatMessages: room "${chatId}" is not joined.`,
      );
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
      let more: boolean;
      try {
        more = await mx.paginateEventTimeline(timeline, {
          backwards: true,
          limit,
        });
      } catch (error) {
        if (!isRecoverableMatrixPaginationError(error)) {
          throw error;
        }
        reachedStart = true;
        break;
      }
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
    const mx = this.mx;
    if (!mx) {
      throw new Error("MatrixDriver.sendChatMessage: client is not connected.");
    }
    if (!mx.getRoom(chatId)) {
      throw new Error(
        `MatrixDriver.sendChatMessage: room "${chatId}" not found.`,
      );
    }
    const { event_id: eventId } = await mx.sendTextMessage(chatId, content);
    return sendResponseToChatMessage(eventId, content);
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
    this.setStorageOwner(user);

    // 1. Returning user — credentials already persisted.
    const stored = this.readStoredUser();
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
    let homeserver = sessionStorage.getItem(this.key(OIDC_HS_KEY));
    if (!homeserver) {
      const discovered = await this.discoverHomeserver(loginHint);
      homeserver = discovered.base_url;
      sessionStorage.setItem(this.key(OIDC_HS_KEY), homeserver);
    }
    const authUrl = await getOIDCAuthUrl(
      homeserver,
      loginHint,
      this.settings.branding,
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
      cryptoStoreDbName: this.cryptoStoreDbName(user),
      tokenRefreshFunction: this.buildTokenRefreshFunction(user),
    });
    this.mx = mx;
    await this.startClientOrFailOnLogout(mx);
    await this.refreshJoinedRoomIds(mx);

    // Bridge Matrix `/sync` onto the generic event stream, once, for the
    // client's lifetime. The handlers fan out to whatever subscribers exist at
    // the time (an empty set is a harmless no-op). Live timeline events become
    // fine-grained `message:new` / `message:updated` (see
    // {@link timelineEventToChatEvent}); list membership changes and reconnects
    // stay coarse (`chats:changed`, per-room `chat:changed`).
    this.detachSync();
    const selfUserId = mx.getUserId() ?? undefined;
    const onTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
    ) => {
      // Backward-pagination history is served by `getChatMessages`, not the
      // live stream.
      if (!room || toStartOfTimeline) {
        return;
      }
      for (const chatEvent of timelineEventToChatEvent(
        event,
        room,
        selfUserId,
      )) {
        this.emit(chatEvent);
      }
    };
    // A joined / left / created room changes what the list shows; drop the
    // cached joined-room set so `getChats` re-reads it.
    const onRoom = () => {
      this.joinedRoomIds = null;
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
      }
      this.emit({ type: "chats:changed" });
    };
    // Our own membership changing (leaving, being kicked/banned, joining) alters
    // the conversation list, but a leave is an ordinary incremental sync: it
    // fires neither `ClientEvent.Room` (the room is not brand-new) nor `onSync`
    // (steady-state `Syncing`). Drop the cached joined set and refresh the list
    // here so a left room does not linger. `onRoom` handles brand-new joins.
    const onMyMembership = () => {
      this.joinedRoomIds = null;
      this.emit({ type: "chats:changed" });
    };
    mx.on(RoomEvent.Timeline, onTimeline);
    mx.on(ClientEvent.Room, onRoom);
    mx.on(ClientEvent.Sync, onSync);
    mx.on(RoomEvent.MyMembership, onMyMembership);
    this.detachSync = () => {
      mx.off(RoomEvent.Timeline, onTimeline);
      mx.off(ClientEvent.Room, onRoom);
      mx.off(ClientEvent.Sync, onSync);
      mx.off(RoomEvent.MyMembership, onMyMembership);
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
    this.joinedRoomIds = null;
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

  private async clearStoredSession(user?: MatrixUserInterface): Promise<void> {
    this.detachSync();
    this.detachSync = () => {};
    this.mx?.stopClient();
    this.mx = null;
    this.joinedRoomIds = null;

    localStorage.removeItem(this.key(STORAGE.user));
    localStorage.removeItem(this.key(STORAGE.oidc));
    sessionStorage.removeItem(this.key(STORAGE.oidcState));
    sessionStorage.removeItem(this.key(OIDC_HS_KEY));

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
