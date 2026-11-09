import { expect } from "@playwright/test";

import { HOMESERVER_URL, SYNC_TIMEOUT } from "./env";
import { uniqueId } from "./ids";
import type { MatrixCredentials } from "./matrix-admin";

/** A raw Matrix event, as the client-server API returns it. */
export type MatrixEvent = {
  event_id: string;
  type: string;
  sender: string;
  state_key?: string;
  origin_server_ts: number;
  content: Record<string, unknown>;
  unsigned?: Record<string, unknown>;
};

/** One push rule, as the client-server API returns it. */
export type PushRule = {
  rule_id: string;
  enabled: boolean;
  default?: boolean;
  actions: unknown[];
  conditions?: Record<string, unknown>[];
};

type PushRuleKind = "override" | "room" | "underride";

/** What Tchap writes for All messages, and for a room in Mentions & following. */
export const ALL_MESSAGES_ACTIONS = [
  "notify",
  { set_tweak: "sound", value: "default" },
];
export const MENTIONS_ACTIONS = ["dont_notify"];

export type CreateRoomOptions = {
  name?: string;
  invite?: string[];
  isDirect?: boolean;
  /** Every room Hub creates is encrypted; API rooms are unencrypted by default. */
  encrypted?: boolean;
};

export type SendTextOptions = {
  /** HTML body, sent as `org.matrix.custom.html`. */
  html?: string;
  threadRootId?: string;
  mentions?: string[];
};

export type SendReplyOptions = {
  /** Quote of the answered message that older clients put in the reply. */
  fallback?: { sender: string; body: string; html?: boolean };
  /** Thread of an explicit reply inside it, not the reply it falls back to. */
  threadRootId?: string;
};

type RequestOptions = {
  body?: unknown;
  query?: Record<string, string>;
  raw?: { data: Buffer; contentType: string };
};

/**
 * Client-server API of one device, for everything a test does as "another
 * person" or "another device" without a browser. Unencrypted rooms only:
 * encrypted rooms go through {@link CryptoDevice}.
 */
export class MatrixApi {
  constructor(readonly credentials: MatrixCredentials) {}

  get userId(): string {
    return this.credentials.userId;
  }

  async request<T = Record<string, unknown>>(
    method: string,
    path: string,
    { body, query, raw }: RequestOptions = {},
  ): Promise<T> {
    const url = new URL(`${HOMESERVER_URL}${path}`);
    Object.entries(query ?? {}).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.credentials.accessToken}`,
          ...(raw
            ? { "Content-Type": raw.contentType }
            : body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
        },
        body: raw
          ? new Uint8Array(raw.data)
          : body !== undefined
            ? JSON.stringify(body)
            : null,
      });
      if (response.status === 429 && attempt < 8) {
        const { retry_after_ms: retryAfter = 1000 } = (await response
          .json()
          .catch(() => ({}))) as { retry_after_ms?: number };
        await new Promise((resolve) => setTimeout(resolve, retryAfter + 200));
        continue;
      }
      if (!response.ok) {
        throw new Error(
          `${method} ${path} → ${response.status} ${await response.text()}`,
        );
      }
      return (await response.json()) as T;
    }
  }

  // --- Rooms -----------------------------------------------------------

  async createRoom({
    name,
    invite = [],
    isDirect = false,
    encrypted = false,
  }: CreateRoomOptions = {}): Promise<string> {
    const { room_id: roomId } = await this.request<{ room_id: string }>(
      "POST",
      "/_matrix/client/v3/createRoom",
      {
        body: {
          preset: isDirect ? "trusted_private_chat" : "private_chat",
          visibility: "private",
          is_direct: isDirect,
          invite,
          ...(name ? { name } : {}),
          ...(encrypted
            ? {
                initial_state: [
                  {
                    type: "m.room.encryption",
                    state_key: "",
                    content: { algorithm: "m.megolm.v1.aes-sha2" },
                  },
                ],
              }
            : {}),
        },
      },
    );
    if (isDirect && invite.length > 0) {
      await this.markDirect(invite[0], roomId);
    }
    return roomId;
  }

  /** Records the room in `m.direct`, as clients do for a direct chat. */
  async markDirect(otherUserId: string, roomId: string): Promise<void> {
    const path = `/_matrix/client/v3/user/${encodeURIComponent(this.userId)}/account_data/m.direct`;
    const current = await this.request<Record<string, string[]>>(
      "GET",
      path,
    ).catch(() => ({}) as Record<string, string[]>);
    const rooms = new Set([...(current[otherUserId] ?? []), roomId]);
    await this.request("PUT", path, {
      body: { ...current, [otherUserId]: Array.from(rooms) },
    });
  }

  /** This person's account data on a room, or `null` when never set. */
  async roomAccountData(
    roomId: string,
    type: string,
  ): Promise<Record<string, unknown> | null> {
    const path = `/_matrix/client/v3/user/${encodeURIComponent(this.userId)}/rooms/${roomId}/account_data/${type}`;
    return this.request("GET", path).catch((error: Error) => {
      if (error.message.includes("→ 404")) return null;
      throw error;
    });
  }

  /** Sets account data on a room, as another client of this person does. */
  async setRoomAccountData(
    roomId: string,
    type: string,
    content: Record<string, unknown>,
  ): Promise<void> {
    const path = `/_matrix/client/v3/user/${encodeURIComponent(this.userId)}/rooms/${roomId}/account_data/${type}`;
    await this.request("PUT", path, { body: content });
  }

  async join(roomId: string): Promise<void> {
    await this.request(
      "POST",
      `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`,
      { body: {} },
    );
  }

  async invite(roomId: string, userId: string): Promise<void> {
    await this.request("POST", `/_matrix/client/v3/rooms/${roomId}/invite`, {
      body: { user_id: userId },
    });
  }

  async leave(roomId: string): Promise<void> {
    await this.request("POST", `/_matrix/client/v3/rooms/${roomId}/leave`, {
      body: {},
    });
  }

  /** Current membership of `userId`, or null when it never joined. */
  async membershipOf(roomId: string, userId: string): Promise<string | null> {
    try {
      const { membership } = await this.request<{ membership: string }>(
        "GET",
        `/_matrix/client/v3/rooms/${roomId}/state/m.room.member/${encodeURIComponent(userId)}`,
      );
      return membership;
    } catch {
      return null;
    }
  }

  async waitForMembership(
    roomId: string,
    userId: string,
    membership: string,
  ): Promise<void> {
    await expect
      .poll(() => this.membershipOf(roomId, userId), {
        timeout: SYNC_TIMEOUT,
      })
      .toBe(membership);
  }

  async joinedRooms(): Promise<string[]> {
    const { joined_rooms: rooms } = await this.request<{
      joined_rooms: string[];
    }>("GET", "/_matrix/client/v3/joined_rooms");
    return rooms;
  }

  /** Room ids this user is invited to, from a one-shot `/sync`. */
  async invitedRooms(): Promise<string[]> {
    const sync = await this.request<{
      rooms?: { invite?: Record<string, unknown> };
    }>("GET", "/_matrix/client/v3/sync", {
      query: { timeout: "0", filter: '{"room":{"timeline":{"limit":1}}}' },
    });
    return Object.keys(sync.rooms?.invite ?? {});
  }

  // --- Profile ---------------------------------------------------------

  /**
   * Changes the global profile, as Tchap's settings do: the server repeats it
   * in a membership event in every room of this person.
   */
  async setProfile({
    displayName,
    avatarUrl,
  }: {
    displayName?: string;
    avatarUrl?: string;
  }): Promise<void> {
    const path = `/_matrix/client/v3/profile/${encodeURIComponent(this.userId)}`;
    if (avatarUrl !== undefined) {
      await this.request("PUT", `${path}/avatar_url`, {
        body: { avatar_url: avatarUrl },
      });
    }
    if (displayName !== undefined) {
      await this.request("PUT", `${path}/displayname`, {
        body: { displayname: displayName },
      });
    }
  }

  // --- Messages --------------------------------------------------------

  async sendEvent(
    roomId: string,
    type: string,
    content: Record<string, unknown>,
  ): Promise<string> {
    const { event_id: eventId } = await this.request<{ event_id: string }>(
      "PUT",
      `/_matrix/client/v3/rooms/${roomId}/send/${type}/${uniqueId()}`,
      { body: content },
    );
    return eventId;
  }

  async sendText(
    roomId: string,
    body: string,
    { html, threadRootId, mentions }: SendTextOptions = {},
  ): Promise<string> {
    return this.sendEvent(roomId, "m.room.message", {
      msgtype: "m.text",
      body,
      ...(html
        ? { format: "org.matrix.custom.html", formatted_body: html }
        : {}),
      ...(mentions ? { "m.mentions": { user_ids: mentions } } : {}),
      ...(threadRootId
        ? {
            "m.relates_to": {
              rel_type: "m.thread",
              event_id: threadRootId,
              "m.in_reply_to": { event_id: threadRootId },
              is_falling_back: true,
            },
          }
        : {}),
    });
  }

  /** A reply to `replyToId`, as Tchap sends one with "Reply". */
  async sendReply(
    roomId: string,
    replyToId: string,
    body: string,
    { fallback, threadRootId }: SendReplyOptions = {},
  ): Promise<string> {
    return this.sendEvent(roomId, "m.room.message", {
      msgtype: "m.text",
      body: fallback
        ? `> <${fallback.sender}> ${fallback.body}\n\n${body}`
        : body,
      ...(fallback?.html
        ? {
            format: "org.matrix.custom.html",
            formatted_body:
              `<mx-reply><blockquote><a href="https://matrix.to/#/${roomId}/${replyToId}">In reply to</a> ` +
              `<a href="https://matrix.to/#/${fallback.sender}">${fallback.sender}</a><br>` +
              `${fallback.body}</blockquote></mx-reply>${body}`,
          }
        : {}),
      "m.relates_to": {
        "m.in_reply_to": { event_id: replyToId },
        ...(threadRootId
          ? {
              rel_type: "m.thread",
              event_id: threadRootId,
              is_falling_back: false,
            }
          : {}),
      },
    });
  }

  /** Sets a piece of room state, such as `m.room.topic`. */
  async sendState(
    roomId: string,
    type: string,
    content: Record<string, unknown>,
  ): Promise<void> {
    await this.request(
      "PUT",
      `/_matrix/client/v3/rooms/${roomId}/state/${type}/`,
      { body: content },
    );
  }

  /**
   * Sends `count` messages numbered `prefix [1]`… in order: the brackets keep
   * "[1]" from also matching "[10]".
   */
  async sendMany(roomId: string, prefix: string, count: number) {
    const eventIds: string[] = [];
    for (let index = 1; index <= count; index++) {
      eventIds.push(await this.sendText(roomId, `${prefix} [${index}]`));
    }
    return eventIds;
  }

  async edit(roomId: string, eventId: string, body: string): Promise<string> {
    return this.sendEvent(roomId, "m.room.message", {
      msgtype: "m.text",
      body: `* ${body}`,
      "m.new_content": { msgtype: "m.text", body },
      "m.relates_to": { rel_type: "m.replace", event_id: eventId },
    });
  }

  async redact(roomId: string, eventId: string): Promise<void> {
    await this.request(
      "PUT",
      `/_matrix/client/v3/rooms/${roomId}/redact/${eventId}/${uniqueId()}`,
      { body: {} },
    );
  }

  async react(roomId: string, eventId: string, key: string): Promise<string> {
    return this.sendEvent(roomId, "m.reaction", {
      "m.relates_to": { rel_type: "m.annotation", event_id: eventId, key },
    });
  }

  // --- Push rules ------------------------------------------------------

  private pushRulePath(kind: PushRuleKind, ruleId: string): string {
    return `/_matrix/client/v3/pushrules/global/${kind}/${encodeURIComponent(ruleId)}`;
  }

  /** The rule of that kind and id, or null. */
  async pushRule(kind: PushRuleKind, ruleId: string): Promise<PushRule | null> {
    const { global } = await this.request<{
      global: Record<PushRuleKind, PushRule[] | undefined>;
    }>("GET", "/_matrix/client/v3/pushrules/");
    return global[kind]?.find((rule) => rule.rule_id === ruleId) ?? null;
  }

  /** Sets the room's level, as Tchap does: no mute rule, one room rule. */
  async setRoomRule(roomId: string, actions: unknown[]): Promise<void> {
    await this.deleteMuteRule(roomId);
    await this.request("PUT", this.pushRulePath("room", roomId), {
      body: { actions },
    });
  }

  /** Mutes the room, as Tchap does: no room rule, one override rule. */
  async setMuteRule(roomId: string): Promise<void> {
    await this.deleteRoomRule(roomId);
    await this.request("PUT", this.pushRulePath("override", roomId), {
      body: {
        conditions: [{ kind: "event_match", key: "room_id", pattern: roomId }],
        actions: ["dont_notify"],
      },
    });
  }

  async deleteRoomRule(roomId: string): Promise<void> {
    if (await this.pushRule("room", roomId)) {
      await this.request("DELETE", this.pushRulePath("room", roomId));
    }
  }

  async deleteMuteRule(roomId: string): Promise<void> {
    if (await this.pushRule("override", roomId)) {
      await this.request("DELETE", this.pushRulePath("override", roomId));
    }
  }

  async setPushRuleEnabled(
    kind: PushRuleKind,
    ruleId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.request("PUT", `${this.pushRulePath(kind, ruleId)}/enabled`, {
      body: { enabled },
    });
  }

  async setPushRuleActions(
    kind: PushRuleKind,
    ruleId: string,
    actions: unknown[],
  ): Promise<void> {
    await this.request("PUT", `${this.pushRulePath(kind, ruleId)}/actions`, {
      body: { actions },
    });
  }

  /** Read receipt, as when this device reads the conversation. */
  async markRead(
    roomId: string,
    eventId: string,
    threadId?: string,
  ): Promise<void> {
    await this.request(
      "POST",
      `/_matrix/client/v3/rooms/${roomId}/receipt/m.read/${eventId}`,
      { body: threadId ? { thread_id: threadId } : {} },
    );
  }

  /** Latest room events, newest first. */
  async messages(roomId: string, limit = 50): Promise<MatrixEvent[]> {
    const { chunk } = await this.request<{ chunk: MatrixEvent[] }>(
      "GET",
      `/_matrix/client/v3/rooms/${roomId}/messages`,
      { query: { dir: "b", limit: String(limit) } },
    );
    return chunk;
  }

  /** Waits until the room holds an event matching `predicate`. */
  async waitForEvent(
    roomId: string,
    predicate: (event: MatrixEvent) => boolean,
    timeout = SYNC_TIMEOUT,
  ): Promise<MatrixEvent> {
    let found: MatrixEvent | undefined;
    await expect
      .poll(
        async () => {
          found = (await this.messages(roomId)).find(predicate);
          return Boolean(found);
        },
        { timeout },
      )
      .toBe(true);
    return found!;
  }

  /** Waits for a text message whose body is exactly `body`. */
  waitForText(roomId: string, body: string): Promise<MatrixEvent> {
    return this.waitForEvent(
      roomId,
      (event) => event.type === "m.room.message" && event.content.body === body,
    );
  }

  // --- Media -----------------------------------------------------------

  async upload(
    data: Buffer,
    contentType: string,
    fileName: string,
  ): Promise<string> {
    const { content_uri: uri } = await this.request<{ content_uri: string }>(
      "POST",
      "/_matrix/media/v3/upload",
      { query: { filename: fileName }, raw: { data, contentType } },
    );
    return uri;
  }

  async download(mxcUri: string): Promise<Buffer> {
    const [, serverName, mediaId] = /^mxc:\/\/([^/]+)\/(.+)$/.exec(mxcUri)!;
    const response = await fetch(
      `${HOMESERVER_URL}/_matrix/client/v1/media/download/${serverName}/${mediaId}`,
      { headers: { Authorization: `Bearer ${this.credentials.accessToken}` } },
    );
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  /** Uploads a file and posts it as an image or file message. */
  async sendFile(
    roomId: string,
    file: { name: string; mimeType: string; data: Buffer },
    info: Record<string, unknown> = {},
  ): Promise<string> {
    const url = await this.upload(file.data, file.mimeType, file.name);
    return this.sendEvent(roomId, "m.room.message", {
      msgtype: file.mimeType.startsWith("image/") ? "m.image" : "m.file",
      body: file.name,
      url,
      info: { mimetype: file.mimeType, size: file.data.length, ...info },
    });
  }
}
