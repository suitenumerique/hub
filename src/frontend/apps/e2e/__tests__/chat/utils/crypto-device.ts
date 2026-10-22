import { expect } from "@playwright/test";
import {
  ClientEvent,
  createClient,
  EventType,
  MatrixClient,
  MatrixEvent,
  MsgType,
  RelationType,
  Preset,
  SyncState,
  Visibility,
} from "matrix-js-sdk";
import {
  CryptoEvent,
  type GeneratedSecretStorageKey,
  type ShowSasCallbacks,
  VerificationPhase,
  type VerificationRequest,
  VerificationRequestEvent,
  type Verifier,
  VerifierEvent,
} from "matrix-js-sdk/lib/crypto-api";
import { logger as sdkLogger, type Logger } from "matrix-js-sdk/lib/logger";

import { HOMESERVER_URL, SYNC_TIMEOUT } from "./env";
import { issueDevice, type TestIdentity } from "./matrix-admin";

const DEBUG = Boolean(process.env.E2E_MATRIX_DEBUG);

const quietLogger: Logger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: (...args: unknown[]) => DEBUG && console.warn(...args),
  error: (...args: unknown[]) => DEBUG && console.error(...args),
  getChild: () => quietLogger,
};

type LoglevelLogger = {
  methodFactory: (method: string, level: number, name: string) => unknown;
  rebuild: () => void;
};

// Some SDK modules log through the global logger rather than the client's.
// Child loggers copy the root factory, so this also covers later ones.
if (!DEBUG) {
  const root = sdkLogger as unknown as LoglevelLogger;
  const factory = root.methodFactory;
  root.methodFactory = (method, level, name) =>
    method === "warn" || method === "error"
      ? factory(method, level, name)
      : () => {};
  root.rebuild();
}

let rustTracingQuieted = false;

/** The Rust crypto logs every request at debug level by default. */
const quietRustTracing = async (): Promise<void> => {
  if (rustTracingQuieted || DEBUG) return;
  rustTracingQuieted = true;
  const wasm = await import("@matrix-org/matrix-sdk-crypto-wasm");
  new wasm.Tracing(wasm.LoggerLevel.Warn).turnOn();
};

export type CreateEncryptedRoomOptions = {
  name?: string;
  invite?: string[];
  isDirect?: boolean;
};

/** One SAS verification, seen from the headless device. */
export type SasVerification = {
  /** The 7 emojis, in display order. */
  emojis: string[];
  confirm: () => Promise<void>;
  mismatch: () => void;
  /** Settles when the verification is done or cancelled. */
  finished: Promise<VerificationPhase>;
};

/**
 * The person's other device: a matrix-js-sdk client with Rust crypto running in
 * the test process, like Element would be. It sets up cross-signing and key
 * backup, answers the Hub's verification, and reads or sends encrypted
 * messages.
 */
export class CryptoDevice {
  private recoveryKey: GeneratedSecretStorageKey | null = null;
  private readonly requests: VerificationRequest[] = [];

  private constructor(
    readonly identity: TestIdentity,
    readonly client: MatrixClient,
  ) {
    client.on(CryptoEvent.VerificationRequestReceived, (request) => {
      this.requests.push(request);
    });
  }

  get userId(): string {
    return this.client.getSafeUserId();
  }

  get deviceId(): string {
    return this.client.getDeviceId()!;
  }

  /** Signs a new device in and waits for its first sync. */
  static async start(identity: TestIdentity): Promise<CryptoDevice> {
    const credentials = await issueDevice(identity);
    let device: CryptoDevice | undefined = undefined;
    const client = createClient({
      baseUrl: HOMESERVER_URL,
      accessToken: credentials.accessToken,
      userId: credentials.userId,
      deviceId: credentials.deviceId,
      logger: quietLogger,
      cryptoCallbacks: {
        getSecretStorageKey: async ({ keys }) => {
          const key = device?.recoveryKey;
          const keyId = Object.keys(keys)[0];
          return key ? [keyId, key.privateKey] : null;
        },
      },
    });
    device = new CryptoDevice(identity, client);
    await client.initRustCrypto({ useIndexedDB: false });
    await quietRustTracing();
    const prepared = new Promise<void>((resolve, reject) => {
      const onSync = (state: SyncState) => {
        if (state === SyncState.Prepared || state === SyncState.Syncing) {
          client.off(ClientEvent.Sync, onSync);
          resolve();
        } else if (state === SyncState.Error) {
          reject(new Error("The headless device could not sync."));
        }
      };
      client.on(ClientEvent.Sync, onSync);
    });
    await client.startClient({ initialSyncLimit: 20, threadSupport: true });
    await prepared;
    return device;
  }

  private get crypto() {
    return this.client.getCrypto()!;
  }

  /**
   * Creates the cross-signing identity, secret storage and key backup, like a
   * first Element sign-in. Only for a person who has none yet: under MAS, the
   * first cross-signing upload needs no extra authentication.
   */
  async setUpEncryption(): Promise<void> {
    await this.crypto.bootstrapCrossSigning({
      setupNewCrossSigning: true,
      authUploadDeviceSigningKeys: async (makeRequest) => {
        await makeRequest(null);
      },
    });
    this.recoveryKey = await this.crypto.createRecoveryKeyFromPassphrase();
    await this.crypto.bootstrapSecretStorage({
      createSecretStorageKey: async () => this.recoveryKey!,
      setupNewSecretStorage: true,
      setupNewKeyBackup: true,
    });
    await this.crypto.checkKeyBackupAndEnable();
    await expect
      .poll(() => this.crypto.getActiveSessionBackupVersion(), {
        timeout: SYNC_TIMEOUT,
      })
      .not.toBeNull();
  }

  // --- Verification ----------------------------------------------------

  /**
   * Accepts the next verification request (the Hub's "Verify this device") and
   * resolves once both sides show the emojis. The test then confirms or
   * rejects on this side, as the person would on their other device.
   */
  async acceptVerification(): Promise<SasVerification> {
    let request: VerificationRequest | undefined;
    await expect
      .poll(
        () => {
          request = this.requests.find(
            (candidate) => candidate.phase === VerificationPhase.Requested,
          );
          return Boolean(request);
        },
        { timeout: SYNC_TIMEOUT, message: "No verification request arrived." },
      )
      .toBe(true);
    const current = request!;
    const finished = new Promise<VerificationPhase>((resolve) => {
      const onChange = () => {
        if (
          current.phase === VerificationPhase.Done ||
          current.phase === VerificationPhase.Cancelled
        ) {
          current.off(VerificationRequestEvent.Change, onChange);
          resolve(current.phase);
        }
      };
      current.on(VerificationRequestEvent.Change, onChange);
    });
    await current.accept();

    // The Hub starts SAS itself once the request is ready: starting it here
    // too would race with it.
    let verifier: Verifier | undefined;
    await expect
      .poll(
        () => {
          verifier = current.verifier;
          return Boolean(verifier);
        },
        { timeout: SYNC_TIMEOUT, message: "The Hub did not start SAS." },
      )
      .toBe(true);

    const sas = new Promise<ShowSasCallbacks>((resolve) => {
      const shown = verifier!.getShowSasCallbacks();
      if (shown) resolve(shown);
      else verifier!.once(VerifierEvent.ShowSas, resolve);
    });
    verifier!.verify().catch(() => {
      // A mismatch or a cancellation rejects verify(): `finished` reports it.
    });
    const callbacks = await sas;
    return {
      emojis: (callbacks.sas.emoji ?? []).map(([emoji]) => emoji),
      confirm: () => callbacks.confirm(),
      mismatch: () => callbacks.mismatch(),
      finished,
    };
  }

  /**
   * Waits until the room keys of `roomId` are in the server key backup, where
   * a newly verified device can restore them from.
   */
  async waitForBackedUpKeys(roomId: string): Promise<void> {
    const version = await this.crypto.getActiveSessionBackupVersion();
    await expect
      .poll(
        async () => {
          const response = await fetch(
            `${HOMESERVER_URL}/_matrix/client/v3/room_keys/keys/${encodeURIComponent(roomId)}?version=${version}`,
            {
              headers: {
                Authorization: `Bearer ${this.client.getAccessToken()}`,
              },
            },
          );
          if (!response.ok) return 0;
          const { sessions = {} } = (await response.json()) as {
            sessions?: Record<string, unknown>;
          };
          return Object.keys(sessions).length;
        },
        { timeout: 30_000, message: "The room key was not backed up." },
      )
      .toBeGreaterThan(0);
  }

  /** Whether this device considers `deviceId` of its own user verified. */
  async isOwnDeviceVerified(deviceId: string): Promise<boolean> {
    const status = await this.crypto.getDeviceVerificationStatus(
      this.userId,
      deviceId,
    );
    return Boolean(status?.crossSigningVerified);
  }

  // --- Rooms and messages ---------------------------------------------

  async createEncryptedRoom({
    name,
    invite = [],
    isDirect = false,
  }: CreateEncryptedRoomOptions = {}): Promise<string> {
    const { room_id: roomId } = await this.client.createRoom({
      preset: isDirect ? Preset.TrustedPrivateChat : Preset.PrivateChat,
      visibility: Visibility.Private,
      is_direct: isDirect,
      invite,
      ...(name ? { name } : {}),
      initial_state: [
        {
          type: EventType.RoomEncryption,
          state_key: "",
          content: { algorithm: "m.megolm.v1.aes-sha2" },
        },
      ],
    });
    if (isDirect && invite[0]) {
      await this.client.setAccountData(EventType.Direct, {
        [invite[0]]: [roomId],
      });
    }
    await this.waitForRoom(roomId);
    return roomId;
  }

  async join(roomId: string): Promise<void> {
    await this.client.joinRoom(roomId);
    await this.waitForRoom(roomId);
  }

  private async waitForRoom(roomId: string): Promise<void> {
    await expect
      .poll(() => this.client.getRoom(roomId)?.getMyMembership(), {
        timeout: SYNC_TIMEOUT,
      })
      .toBe("join");
  }

  /** Waits until `userId` joined, so the room key is shared with them. */
  async waitForMember(roomId: string, userId: string): Promise<void> {
    await expect
      .poll(() => this.client.getRoom(roomId)?.getMember(userId)?.membership, {
        timeout: SYNC_TIMEOUT,
      })
      .toBe("join");
  }

  async sendText(roomId: string, body: string): Promise<string> {
    const { event_id: eventId } = await this.client.sendMessage(roomId, {
      msgtype: MsgType.Text,
      body,
    });
    return eventId;
  }

  /**
   * Sends a reaction encrypted, as some clients do (matrix-js-sdk never
   * encrypts reactions). Its relation, emoji included, stays in clear.
   */
  async sendEncryptedReaction(
    roomId: string,
    eventId: string,
    key: string,
  ): Promise<string> {
    const client = this.client as unknown as {
      shouldEncryptEventForRoom: () => boolean;
    };
    const shouldEncrypt = client.shouldEncryptEventForRoom;
    client.shouldEncryptEventForRoom = () => true;
    try {
      const { event_id: reactionId } = await this.client.sendEvent(
        roomId,
        EventType.Reaction,
        {
          "m.relates_to": {
            rel_type: RelationType.Annotation,
            event_id: eventId,
            key,
          },
        },
      );
      return reactionId;
    } finally {
      client.shouldEncryptEventForRoom = shouldEncrypt;
    }
  }

  /** Decrypted messages of the live timeline, oldest first. */
  async messages(roomId: string): Promise<MatrixEvent[]> {
    const events =
      this.client.getRoom(roomId)?.getLiveTimeline().getEvents() ?? [];
    await Promise.all(
      events.map((event) => this.client.decryptEventIfNeeded(event)),
    );
    return events.filter((event) => event.getType() === EventType.RoomMessage);
  }

  /** Waits until a message with exactly `body` is received and decrypted. */
  async waitForText(roomId: string, body: string): Promise<MatrixEvent> {
    let found: MatrixEvent | undefined;
    await expect
      .poll(
        async () => {
          found = (await this.messages(roomId)).find(
            (event) => event.getContent().body === body,
          );
          return found?.isEncrypted() ? "decrypted" : found ? "plain" : null;
        },
        {
          timeout: SYNC_TIMEOUT,
          message: `"${body}" was not decrypted by ${this.identity.displayName}'s other device.`,
        },
      )
      .toBe("decrypted");
    return found!;
  }

  stop(): void {
    this.client.stopClient();
  }
}
