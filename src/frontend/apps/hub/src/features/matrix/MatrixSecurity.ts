import {
  ClientEvent,
  SyncState,
  type MatrixClient,
  type MatrixEvent,
  type SyncStateData,
} from "matrix-js-sdk/lib/matrix";
import { CryptoEvent } from "matrix-js-sdk/lib/crypto-api/CryptoEvent";
import {
  VerificationPhase,
  VerificationRequestEvent,
  VerifierEvent,
  type ShowSasCallbacks,
  type VerificationRequest,
  type Verifier,
} from "matrix-js-sdk/lib/crypto-api/verification";
import type { UserVerificationStatus } from "matrix-js-sdk/lib/crypto-api";

import {
  EMPTY_SECURITY,
  ChatSecuritySendError,
  type ChatSecurityCommand,
  type ChatSecuritySnapshot,
} from "@/features/drivers/security";
import type { MatrixDriverSettings } from "./config";
import { MatrixKeyBackup } from "./keyBackup";
import { securityFailureReason, securitySendError } from "./securityErrors";

const SECRET_WAIT_TIMEOUT = 60_000;
const SERVER_CHECK_INTERVAL = 60_000;

/** One controller per owned client. The SDK is the sole authority on trust. */
export class MatrixSecurity {
  private snapshot: ChatSecuritySnapshot;
  private stopped = false;
  private inspection: Promise<void> | null = null;
  private inspectionRequested = false;
  private serverCheckRequested = true;
  private lastServerCheck = 0;
  private inspectionFailure?: { area: "trust" | "backup"; cause: unknown };
  private readonly backup: MatrixKeyBackup;
  private readonly work = new Set<Promise<unknown>>();
  private timer: ReturnType<typeof setInterval>;
  private identityRevision = 0;
  private identityReplaced = false;
  // Once setup succeeds, a temporary backup outage must not disable sending.
  // Losing identity trust clears this latch and requires setup checks again.
  private operational = false;
  private restoreRequested = false;
  private restoring: Promise<void> | null = null;
  private restoreGeneration = 0;
  private attempt = 0;
  private request: VerificationRequest | null = null;
  private readonly retiredTransactions = new Set<string>();
  private verifier: Verifier | null = null;
  private sas: ShowSasCallbacks | null = null;
  private startingSas = false;
  private detachAttempt: () => void = () => {};
  private lastInspection = 0;
  private secretWaitStartedAt: number | undefined;

  constructor(
    private readonly mx: MatrixClient,
    settings: MatrixDriverSettings,
    private readonly changed: (snapshot: ChatSecuritySnapshot) => void,
  ) {
    this.backup = new MatrixKeyBackup(mx);
    this.snapshot = {
      ...EMPTY_SECURITY,
      supported: true,
      userId: mx.getUserId() ?? undefined,
      deviceId: mx.getDeviceId() ?? undefined,
      externalClient: {
        url: settings.externalClientUrl,
        label: settings.externalClientLabel,
      },
    };
    // Install before startClient: verification and secrets arrive over sync.
    mx.on(CryptoEvent.VerificationRequestReceived, this.onRequest);
    mx.on(CryptoEvent.UserTrustStatusChanged, this.onTrust);
    mx.on(CryptoEvent.KeysChanged, this.refreshSoon);
    mx.on(CryptoEvent.DevicesUpdated, this.refreshSoon);
    mx.on(CryptoEvent.KeyBackupStatus, this.refreshSoon);
    mx.on(CryptoEvent.KeyBackupDecryptionKeyCached, this.refreshFromServer);
    mx.on(CryptoEvent.KeyBackupFailed, this.onBackupFailed);
    mx.on(CryptoEvent.KeyBackupSessionsRemaining, this.onBackupRemaining);
    mx.on(ClientEvent.AccountData, this.onAccountData);
    mx.on(ClientEvent.Sync, this.onSync);
    this.timer = setInterval(() => {
      if (
        this.snapshot.secrets === "waiting" &&
        this.secretWaitStartedAt !== undefined &&
        Date.now() - this.secretWaitStartedAt >= SECRET_WAIT_TIMEOUT
      )
        this.publish({ secrets: "delayed" });
      // Secret delivery gets a bounded local poll. Normal operation follows SDK
      // events, with a slow server check for changes made from another client.
      if (
        this.snapshot.secrets === "waiting" &&
        this.secretWaitStartedAt !== undefined &&
        Date.now() - this.lastInspection >= 5_000
      )
        this.refreshSoon();
      if (Date.now() - this.lastServerCheck >= SERVER_CHECK_INTERVAL)
        this.refreshFromServer();
      const request = this.request;
      if (
        request?.pending &&
        request.timeout !== null &&
        request.timeout <= 0
      ) {
        this.finishAttempt("expired");
        this.track(request.cancel()).catch(() => {});
      }
    }, 1_000);
    this.changed(this.snapshot);
  }

  private track<T>(promise: Promise<T>): Promise<T> {
    this.work.add(promise);
    void promise.finally(() => this.work.delete(promise)).catch(() => {});
    return promise;
  }

  private publish(patch: Partial<ChatSecuritySnapshot>): void {
    if (this.stopped) return;
    this.snapshot = { ...this.snapshot, ...patch };
    if (
      this.snapshot.trust !== "verified" ||
      this.snapshot.secrets === "ready"
    ) {
      this.secretWaitStartedAt = undefined;
    } else {
      this.secretWaitStartedAt ??= Date.now();
      this.snapshot.secrets =
        Date.now() - this.secretWaitStartedAt >= SECRET_WAIT_TIMEOUT
          ? "delayed"
          : "waiting";
    }
    this.changed(this.snapshot);
  }

  private setVerification(
    patch: Partial<ChatSecuritySnapshot["verification"]>,
  ): void {
    this.publish({ verification: { ...this.snapshot.verification, ...patch } });
  }

  private onTrust = (userId: string, trust: UserVerificationStatus): void => {
    if (userId !== this.mx.getUserId()) return;
    if (!trust.isCrossSigningVerified() || trust.needsUserApproval) {
      this.invalidateTrust();
      this.publish({
        canSendEncrypted: false,
        trust:
          trust.needsUserApproval || this.identityReplaced
            ? "changed"
            : "unverified",
      });
    }
    this.refreshSoon();
  };

  private invalidateTrust(): void {
    if (this.operational || this.snapshot.trust === "verified") {
      // Invalidate asynchronous inspections and restores from the old identity
      // before cancelling its verification; their promises may still resolve.
      this.identityRevision++;
      this.identityReplaced = true;
      this.restoreGeneration++;
      this.restoreRequested = false;
      void this.cancel(this.attempt).catch(() => {});
    }
    this.operational = false;
  }
  private onBackupFailed = (): void => {
    this.publish({ backup: "unavailable" });
    this.refreshFromServer();
  };
  private onBackupRemaining = (remaining: number): void => {
    this.publish({ backupRemaining: remaining });
  };
  private onAccountData = (event: MatrixEvent): void => {
    if (
      /^m\.(cross_signing|secret_storage|megolm_backup)/.test(event.getType())
    )
      this.refreshFromServer();
  };
  private onSync = (
    state: SyncState,
    previous: SyncState | null,
    data?: SyncStateData,
  ): void => {
    if (state === SyncState.Error || state === SyncState.Reconnecting) {
      // Rust key queries can retry for a while. Surface the sync failure now,
      // retaining established trust, the backup version and every local key.
      const reason = data?.error
        ? securityFailureReason(data.error)
        : "network";
      this.publish({
        issue: { area: "backup", reason },
        backup: "unavailable",
      });
    }
    if (
      state === SyncState.Error &&
      (this.request || this.snapshot.verification.phase === "requesting")
    ) {
      // Retire action targets before a late network response can attach them.
      this.attempt++;
      this.finishAttempt("error");
    }
    if (
      state === SyncState.Prepared ||
      (state === SyncState.Syncing && previous !== SyncState.Syncing)
    )
      this.refreshFromServer();
  };
  private refreshFromServer = (): void => {
    void this.refresh(true);
  };
  private refreshSoon = (): void => {
    void this.refresh();
  };

  async refresh(refreshServer = false): Promise<void> {
    if (this.stopped) return;
    this.inspectionRequested = true;
    this.serverCheckRequested ||= refreshServer;
    // Coalesce bursts, but replay events received during an inspection. Sharing
    // the old promise alone would silently discard an identity/secret change.
    if (this.inspection) return this.inspection;
    const work = (async () => {
      while (this.inspectionRequested && !this.stopped) {
        this.inspectionRequested = false;
        const checkServer = this.serverCheckRequested;
        this.serverCheckRequested = false;
        this.lastInspection = Date.now();
        if (checkServer) this.lastServerCheck = Date.now();
        await this.inspect(checkServer);
      }
    })();
    this.inspection = work;
    try {
      await this.track(work);
    } finally {
      if (this.inspection === work) this.inspection = null;
    }
  }

  async assertCanSend(): Promise<void> {
    // Do not queue a new send behind a server inspection already retrying while
    // offline. The composer keeps the draft for an explicit retry after sync.
    const sync = this.mx.getSyncState();
    if (sync === SyncState.Error || sync === SyncState.Reconnecting) {
      const cause = this.mx.getSyncStateData()?.error;
      if (cause) throw securitySendError(cause);
      throw new ChatSecuritySendError("network");
    }
    await this.refresh();
    if (this.stopped) throw new ChatSecuritySendError("not-ready");
    if (this.inspectionFailure?.area === "trust")
      throw securitySendError(this.inspectionFailure.cause);
    if (!this.snapshot.canSendEncrypted) {
      if (this.inspectionFailure)
        throw securitySendError(this.inspectionFailure.cause);
      throw new ChatSecuritySendError("not-ready");
    }
  }

  private async inspect(refreshServer: boolean): Promise<void> {
    const crypto = this.mx.getCrypto();
    if (!crypto || !this.mx.isInitialSyncComplete()) return;
    const userId = this.mx.getUserId()!;
    const deviceId = this.mx.getDeviceId()!;
    let area: "trust" | "backup" = "trust";
    let revision = this.identityRevision;
    try {
      // Refresh the public identity on startup/reconnect, not on every send. Local
      // trust reads below still run before each send and require no master secret.
      if (refreshServer) await crypto.userHasCrossSigningKeys(userId, true);
      if (this.stopped) return;
      revision = this.identityRevision;
      const [trust, device, secrets, devices] = await Promise.all([
        crypto.getUserVerificationStatus(userId),
        crypto.getDeviceVerificationStatus(userId, deviceId),
        crypto.getCrossSigningStatus(),
        crypto.getUserDeviceInfo([userId]),
      ]);
      if (this.stopped || revision !== this.identityRevision) return;
      const verified =
        trust.known &&
        trust.isCrossSigningVerified() &&
        !trust.needsUserApproval &&
        !!device?.crossSigningVerified;
      const haveSigningSecrets =
        secrets.privateKeysCachedLocally.selfSigningKey &&
        secrets.privateKeysCachedLocally.userSigningKey;
      if (!verified) this.invalidateTrust();
      else this.identityReplaced = false;
      let deviceTrust: ChatSecuritySnapshot["trust"];
      if (!trust.known) deviceTrust = "missing-identity";
      else if (verified) deviceTrust = "verified";
      else if (trust.needsUserApproval || this.identityReplaced)
        deviceTrust = "changed";
      else deviceTrust = "unverified";
      const currentRevision = this.identityRevision;
      revision = currentRevision;
      const candidates = [...(devices.get(userId)?.values() ?? [])].filter(
        (candidate) =>
          candidate.deviceId !== deviceId &&
          !candidate.dehydrated &&
          candidate.verified !== -1 &&
          !!candidate.getIdentityKey(),
      );
      const referenceDevices = await Promise.all(
        candidates.map(async (candidate) => {
          const status = await crypto.getDeviceVerificationStatus(
            userId,
            candidate.deviceId,
          );
          return !!status?.signedByOwner;
        }),
      );
      if (this.stopped || currentRevision !== this.identityRevision) return;
      this.publish({
        referenceDeviceCount: referenceDevices.filter(Boolean).length,
        trust: deviceTrust,
        ...(haveSigningSecrets ? {} : { secrets: "waiting" as const }),
        canSendEncrypted: verified && this.operational,
      });
      area = "backup";
      const backup = await this.backup.inspect(refreshServer, () => {
        if (this.stopped || this.identityRevision !== currentRevision)
          throw new Error("Security inspection superseded");
      });
      if (this.stopped || this.identityRevision !== currentRevision) return;
      const version = backup.version;
      if (version !== this.snapshot.backupVersion) {
        this.restoreGeneration++;
        this.publish({
          history: "idle",
          historyImported: undefined,
          historyTotal: undefined,
        });
      }
      const matching = backup.matching;
      // SAS completion alone is insufficient for first use: signing secrets and
      // the key matching the trusted, active backup must also have arrived.
      const ready =
        verified &&
        haveSigningSecrets &&
        matching &&
        !!version &&
        backup.state === "active";
      if (ready) this.operational = true;
      this.inspectionFailure = undefined;
      this.publish({
        issue: undefined,
        secrets: haveSigningSecrets && matching ? "ready" : "waiting",
        backupVersion: version,
        backup: backup.state,
        canSendEncrypted: verified && this.operational,
      });
      if (ready && this.restoreRequested && !this.restoring)
        this.restore(version!);
    } catch (cause) {
      if (this.stopped || revision !== this.identityRevision) return;
      this.inspectionFailure = { area, cause };
      const issue = { area, reason: securityFailureReason(cause) };
      if (area === "trust") {
        this.publish({ issue, trust: "checking", canSendEncrypted: false });
      } else {
        this.publish({ issue, backup: "unavailable" });
      }
    }
  }

  private restore(version: string): void {
    this.restoreRequested = false;
    const generation = ++this.restoreGeneration;
    // An in-flight download may outlive a backup or identity change. Its
    // progress must never describe recovery for the replacement backup.
    const current = () =>
      !this.stopped &&
      generation === this.restoreGeneration &&
      this.snapshot.backupVersion === version;
    this.publish({
      history: "restoring",
      historyImported: undefined,
      historyTotal: undefined,
    });
    const work = this.mx
      .getCrypto()!
      .restoreKeyBackup({
        progressCallback: (progress) => {
          if (current() && progress.stage === "load_keys")
            this.publish({
              historyImported: progress.successes,
              historyTotal: progress.total,
            });
        },
      })
      .then(({ total, imported }) => {
        if (!current()) return;
        this.publish({
          history: imported < total ? "partial" : "complete",
          historyTotal: total,
          historyImported: imported,
        });
      })
      .catch(() => {
        if (current()) {
          // Retry is explicit; avoid continuously downloading a failing backup.
          this.publish({ history: "error" });
        }
      })
      .finally(() => {
        if (this.restoring === work) {
          this.restoring = null;
          // A new verification/retry may have arrived during this restore.
          if (this.restoreRequested) this.refreshSoon();
        }
      });
    this.restoring = work;
    this.track(work);
  }

  private onRequest = (request: VerificationRequest): void => {
    // V1 verifies this account's own devices over to-device messages. Requests
    // for another person or a room-based verification are outside that flow.
    if (
      this.stopped ||
      !request.isSelfVerification ||
      request.otherUserId !== this.mx.getUserId() ||
      request.roomId
    ) {
      this.track(request.cancel()).catch(() => {});
      return;
    }
    if (
      request.transactionId &&
      this.retiredTransactions.has(request.transactionId)
    ) {
      this.track(request.cancel()).catch(() => {});
      return;
    }
    if (request === this.request) return;
    if (
      request.transactionId &&
      request.transactionId === this.request?.transactionId
    )
      return;
    if (this.request || this.snapshot.verification.phase === "requesting") {
      this.track(request.cancel()).catch(() => {});
      return;
    }
    this.attach(request, ++this.attempt);
  };

  private attach(request: VerificationRequest, attempt: number): void {
    if (this.stopped || attempt !== this.attempt) {
      this.track(request.cancel()).catch(() => {});
      return;
    }
    this.request = request;
    this.publish({
      verification: {
        attempt,
        phase: request.initiatedByMe ? "waiting" : "incoming",
        transactionId: request.transactionId,
        deviceId: request.otherDeviceId,
      },
    });
    const onChange = () => {
      if (!this.current(request, attempt)) return;
      this.setVerification({
        transactionId: request.transactionId,
        deviceId: request.otherDeviceId,
      });
      if (request.phase === VerificationPhase.Cancelled) {
        this.finishAttempt(
          request.cancellationCode === "m.timeout" ? "expired" : "cancelled",
        );
      } else if (request.phase === VerificationPhase.Done) {
        // Done is the protocol completion, not the local Confirm button.
        this.restoreRequested = true;
        this.finishAttempt("complete");
        this.refreshFromServer();
      } else if (request.verifier) {
        this.attachVerifier(request.verifier, request, attempt);
      } else if (
        request.phase === VerificationPhase.Ready &&
        !this.startingSas
      ) {
        this.startingSas = true;
        this.setVerification({ phase: "waiting" });
        this.track(request.startVerification("m.sas.v1"))
          .then((verifier) => {
            if (this.current(request, attempt))
              this.attachVerifier(verifier, request, attempt);
            else verifier.cancel(new Error("Verification closed"));
          })
          .catch(() => {
            if (this.current(request, attempt)) this.finishAttempt("error");
          });
      }
    };
    request.on(VerificationRequestEvent.Change, onChange);
    this.detachAttempt = () =>
      request.off(VerificationRequestEvent.Change, onChange);
    onChange();
  }

  private current(request: VerificationRequest, attempt: number): boolean {
    return (
      !this.stopped && this.request === request && this.attempt === attempt
    );
  }

  private attachVerifier(
    verifier: Verifier,
    request: VerificationRequest,
    attempt: number,
  ): void {
    if (this.verifier === verifier) return;
    this.verifier = verifier;
    const onSas = (sas: ShowSasCallbacks) => {
      if (!this.current(request, attempt)) return;
      this.sas = sas;
      this.setVerification({
        phase: "comparing",
        emojis: sas.sas.emoji?.length === 7 ? sas.sas.emoji : undefined,
        decimals: sas.sas.decimal,
      });
    };
    verifier.on(VerifierEvent.ShowSas, onSas);
    const detach = this.detachAttempt;
    this.detachAttempt = () => {
      detach();
      verifier.off(VerifierEvent.ShowSas, onSas);
    };
    // ShowSas may have fired before this listener attached; consume the SDK's
    // current callbacks as well so the comparison screen cannot miss it.
    const sas = verifier.getShowSasCallbacks();
    if (sas) onSas(sas);
    this.track(verifier.verify())
      .then(() => {
        if (this.current(request, attempt)) {
          this.restoreRequested = true;
          this.finishAttempt("complete");
          this.refreshFromServer();
        }
      })
      .catch(() => {
        if (!this.current(request, attempt)) return;
        if (request.cancellationCode === "m.timeout") {
          this.finishAttempt("expired");
        } else if (request.phase === VerificationPhase.Cancelled) {
          this.finishAttempt("cancelled");
        } else {
          this.finishAttempt("error");
        }
      });
  }

  private finishAttempt(
    phase: ChatSecuritySnapshot["verification"]["phase"],
  ): void {
    const request = this.request;
    if (request?.transactionId) {
      // Ignore late redelivery of a completed/cancelled request without keeping
      // an unbounded transaction history for the lifetime of this page.
      this.retiredTransactions.add(request.transactionId);
      if (this.retiredTransactions.size > 128)
        this.retiredTransactions.delete(
          this.retiredTransactions.values().next().value!,
        );
    }
    this.detachAttempt();
    this.detachAttempt = () => {};
    this.request = null;
    this.verifier = null;
    this.sas = null;
    this.startingSas = false;
    this.setVerification({
      attempt: this.attempt,
      phase,
      emojis: undefined,
      decimals: undefined,
    });
    if (phase === "error" && request?.pending)
      this.track(request.cancel()).catch(() => {});
  }

  private async cancel(attempt: number): Promise<void> {
    if (attempt !== this.attempt) return;
    const request = this.request;
    // Retire local callbacks immediately, even if cancellation cannot yet reach
    // the other device because the network is unavailable.
    this.attempt++;
    this.finishAttempt("idle");
    if (request?.pending) await this.track(request.cancel());
  }

  async command(command: ChatSecurityCommand): Promise<void> {
    if (this.stopped) return;
    if (command.type === "retry") {
      this.restoreRequested = true;
      this.secretWaitStartedAt = undefined;
      if (this.snapshot.secrets === "delayed")
        this.publish({ secrets: "waiting" });
      await this.refresh(true);
      return;
    }
    if (command.type === "verify") {
      if (this.request || this.snapshot.verification.phase === "requesting")
        return;
      const attempt = ++this.attempt;
      this.publish({ verification: { attempt, phase: "requesting" } });
      try {
        const request = await this.track(
          this.mx.getCrypto()!.requestOwnUserVerification(),
        );
        this.attach(request, attempt);
      } catch {
        if (!this.stopped && attempt === this.attempt)
          this.finishAttempt("error");
      }
      return;
    }
    // A button rendered for an earlier comparison cannot approve a newer one.
    if (command.attempt !== this.attempt) return;
    if (command.type === "cancel") {
      await this.cancel(command.attempt);
      return;
    }
    const request = this.request;
    if (!request) return;
    try {
      if (
        command.type === "accept" &&
        this.snapshot.verification.phase === "incoming"
      ) {
        this.setVerification({ phase: "waiting" });
        await this.track(request.accept());
      } else if (
        command.type === "match" &&
        this.snapshot.verification.phase === "comparing" &&
        this.sas
      ) {
        this.setVerification({ phase: "confirming" });
        await this.track(this.sas.confirm());
      } else if (
        command.type === "mismatch" &&
        this.sas &&
        this.snapshot.verification.phase === "comparing"
      ) {
        this.setVerification({ mismatch: true });
        this.sas.mismatch();
      }
    } catch {
      if (this.current(request, command.attempt)) this.finishAttempt("error");
    }
  }

  stop(): Promise<void> {
    if (!this.stopped) {
      void this.cancel(this.attempt).catch(() => {});
      this.stopped = true;
      this.restoreGeneration++;
      clearInterval(this.timer);
      this.mx.off(CryptoEvent.VerificationRequestReceived, this.onRequest);
      this.mx.off(CryptoEvent.UserTrustStatusChanged, this.onTrust);
      this.mx.off(CryptoEvent.KeysChanged, this.refreshSoon);
      this.mx.off(CryptoEvent.DevicesUpdated, this.refreshSoon);
      this.mx.off(CryptoEvent.KeyBackupStatus, this.refreshSoon);
      this.mx.off(
        CryptoEvent.KeyBackupDecryptionKeyCached,
        this.refreshFromServer,
      );
      this.mx.off(CryptoEvent.KeyBackupFailed, this.onBackupFailed);
      this.mx.off(
        CryptoEvent.KeyBackupSessionsRemaining,
        this.onBackupRemaining,
      );
      this.mx.off(ClientEvent.AccountData, this.onAccountData);
      this.mx.off(ClientEvent.Sync, this.onSync);
    }
    return (async () => {
      // Late request creation can enqueue its cancellation after stop began.
      while (this.work.size) await Promise.allSettled([...this.work]);
    })();
  }
}
