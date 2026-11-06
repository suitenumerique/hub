import {
  type MatrixClient,
  type MatrixEvent,
  MatrixEventEvent,
} from "matrix-js-sdk/lib/matrix";

import {
  type ChatType,
  isAnalyticsEnabled,
  readAnalyticsStorage,
  trackEvent,
  writeAnalyticsStorage,
} from "@/features/analytics/analytics";

/** Same delays as Tchap and Element, so the rates can be compared. */
const GRACE_PERIOD_MS = 4_000;
const MAXIMUM_LATE_DECRYPTION_MS = 60_000;
const CHECK_INTERVAL_MS = 5_000;
const MEGOLM_ALGORITHM = "m.megolm.v1.aes-sha2";
const REPORTED_STORAGE_NAME = "decryption-failures-reported";
/** Enough to outlast a session; the oldest ids leave first. */
const MAXIMUM_REMEMBERED_REPORTS = 2_000;

type TrackedFailure = {
  event: MatrixEvent;
  reason: string;
  failedAt: number;
  userTrustsOwnIdentity: boolean;
  isFederated?: boolean;
  eventLocalAgeMs?: number;
  chatType?: ChatType;
};

const localDay = (date = new Date()): string => date.toDateString();

const serverOf = (userId: string | null | undefined): string | undefined =>
  userId?.split(":")[1];

const loadReported = (): Set<string> => {
  try {
    const stored = readAnalyticsStorage(REPORTED_STORAGE_NAME);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set();
  }
};

/**
 * Measures decryption as Tchap and Element do, on the same method: a message
 * that decrypts within the grace period is not a failure, a key arriving before
 * the maximum delay makes it a late decryption, and beyond it the message counts
 * as undecryptable. Each message is reported once, across reloads.
 */
export class MatrixDecryptionTracker {
  private readonly failures = new Map<string, TrackedFailure>();
  /** Past the maximum delay; a key can still arrive and take them out. */
  private readonly undecryptable = new Map<string, MatrixEvent>();
  private readonly shown = new Set<string>();
  private readonly reported = loadReported();
  private reportedChanged = false;
  private summaryDay = localDay();
  private summarySent = false;
  private readonly timer: number;

  constructor(
    private readonly mx: MatrixClient,
    private readonly userTrustsOwnIdentity: () => boolean,
  ) {
    mx.on(MatrixEventEvent.Decrypted, this.observe);
    this.timer = window.setInterval(this.check, CHECK_INTERVAL_MS);
  }

  noteShown(event: MatrixEvent): void {
    // A local echo gets its final id once sent, and counts then.
    if (!isAnalyticsEnabled() || event.status !== null) return;
    if (!event.isEncrypted() || event.isRedacted()) return;
    const id = event.getId();
    if (id) this.shown.add(id);
  }

  /** The driver stops this tracker when the page goes, too. */

  stop(): void {
    this.mx.off(MatrixEventEvent.Decrypted, this.observe);
    window.clearInterval(this.timer);
    this.saveReported();
    this.sendSummary();
  }

  private readonly observe = (event: MatrixEvent): void => {
    if (!isAnalyticsEnabled()) return;
    if (event.getWireContent().algorithm !== MEGOLM_ALGORITHM) return;
    const id = event.getId();
    if (!id) return;
    const reason = event.decryptionFailureReason;
    if (reason === null) {
      this.undecryptable.delete(id);
      this.resolve(id);
      return;
    }
    if (this.undecryptable.has(id)) return;
    const known = this.failures.get(id);
    // The delays run from the first failure, whatever the later attempts say.
    this.failures.set(id, {
      event,
      reason,
      failedAt: known?.failedAt ?? Date.now(),
      userTrustsOwnIdentity: this.userTrustsOwnIdentity(),
      isFederated: this.isFederated(event),
      eventLocalAgeMs: known?.eventLocalAgeMs ?? event.getLocalAge(),
      chatType: known?.chatType ?? this.chatType(event),
    });
  };

  private resolve(id: string): void {
    const failure = this.failures.get(id);
    if (!failure) return;
    this.failures.delete(id);
    const timeToDecrypt = Date.now() - failure.failedAt;
    if (timeToDecrypt < GRACE_PERIOD_MS) return;
    this.report(
      failure,
      timeToDecrypt <= MAXIMUM_LATE_DECRYPTION_MS ? timeToDecrypt : undefined,
    );
  }

  private readonly check = (): void => {
    const now = Date.now();
    for (const [id, failure] of this.failures) {
      // A failed event also decrypts without any client-level event.
      if (!failure.event.isDecryptionFailure()) {
        this.resolve(id);
      } else if (now - failure.failedAt > MAXIMUM_LATE_DECRYPTION_MS) {
        this.failures.delete(id);
        this.undecryptable.set(id, failure.event);
        this.report(failure);
      }
    }
    this.saveReported();
    if (localDay() !== this.summaryDay) {
      this.sendSummary();
      this.shown.clear();
      this.undecryptable.clear();
      this.summaryDay = localDay();
      this.summarySent = false;
    }
  };

  private report(failure: TrackedFailure, timeToDecryptMs?: number): void {
    const id = failure.event.getId();
    if (!id || this.reported.has(id)) return;
    this.reported.add(id);
    this.reportedChanged = true;
    trackEvent("decryption:failed", {
      reason: failure.reason,
      ...(timeToDecryptMs === undefined
        ? {}
        : { time_to_decrypt_ms: timeToDecryptMs }),
      was_visible_to_user: this.shown.has(id),
      user_trusts_own_identity: failure.userTrustsOwnIdentity,
      is_federated: failure.isFederated,
      event_local_age_ms: failure.eventLocalAgeMs,
      chat_type: failure.chatType,
    });
  }

  /**
   * At most once for each day of this session, when it ends or the day does.
   * It cannot wait for the queue of the SDK, flushed when the page goes.
   */
  private sendSummary(): void {
    const encryptedMessagesShown = this.shown.size;
    if (this.summarySent || encryptedMessagesShown === 0) return;
    this.summarySent = true;
    const undecryptableCount = [...this.undecryptable].filter(
      ([id, event]) => this.shown.has(id) && event.isDecryptionFailure(),
    ).length;
    trackEvent(
      "decryption:summary",
      {
        encrypted_messages_shown: encryptedMessagesShown,
        undecryptable_count: undecryptableCount,
        undecryptable_ratio: undecryptableCount / encryptedMessagesShown,
      },
      { transport: "sendBeacon", send_instantly: true },
    );
  }

  private saveReported(): void {
    if (!this.reportedChanged) return;
    this.reportedChanged = false;
    writeAnalyticsStorage(
      REPORTED_STORAGE_NAME,
      JSON.stringify([...this.reported].slice(-MAXIMUM_REMEMBERED_REPORTS)),
    );
  }

  private isFederated(event: MatrixEvent): boolean | undefined {
    const own = serverOf(this.mx.getUserId());
    const sender = serverOf(event.getSender());
    return own && sender ? own !== sender : undefined;
  }

  private chatType(event: MatrixEvent): ChatType | undefined {
    const room = this.mx.getRoom(event.getRoomId());
    if (!room) return undefined;
    return room.getInvitedAndJoinedMemberCount() <= 2 ? "dm" : "dm_group";
  }
}
