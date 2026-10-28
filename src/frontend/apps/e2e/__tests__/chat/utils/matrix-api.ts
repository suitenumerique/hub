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
