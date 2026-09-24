import type { MatrixClient } from "matrix-js-sdk/lib/matrix";
import type { KeyBackupInfo } from "matrix-js-sdk/lib/crypto-api/keybackup";
import { ClientPrefix, MatrixError, Method } from "matrix-js-sdk/lib/http-api";

import type { ChatSecuritySnapshot } from "@/features/drivers/security";

type BackupInspection = {
  version?: string;
  state: ChatSecuritySnapshot["backup"];
  matching: boolean;
};

/** Cache public metadata only; decryption keys remain owned by Rust Crypto. */
export class MatrixKeyBackup {
  private info: KeyBackupInfo | null | undefined;
  private failure: { cause: unknown } | undefined;

  constructor(private readonly mx: MatrixClient) {}

  async inspect(
    refreshServer: boolean,
    assertCurrent: () => void,
  ): Promise<BackupInspection> {
    assertCurrent();
    if (refreshServer || (this.info === undefined && !this.failure)) {
      try {
        this.info = await this.readServerInfo();
        this.failure = undefined;
      } catch (cause) {
        // An unreachable server must not erase the last known backup version.
        this.failure = { cause };
        throw cause;
      }
    }
    assertCurrent();
    if (this.failure) throw this.failure.cause;
    if (!this.info) return { state: "missing", matching: false };
    const version = this.info.version;
    if (!version) throw new Error("Backup response has no version");

    const crypto = this.mx.getCrypto()!;
    const trust = await crypto.isKeyBackupTrusted(this.info);
    assertCurrent();
    let active = await crypto.getActiveSessionBackupVersion();
    assertCurrent();
    // Activation can query the server too. Keep it on the explicit server-check
    // path so an unavailable backup does not add a network retry to every send.
    if (refreshServer && trust.trusted && active !== version) {
      const enabled = await crypto.checkKeyBackupAndEnable();
      assertCurrent();
      // In SDK 41.6 this API also returns null on network failure. It cannot
      // establish absence, nor can a concurrent version change certify our read.
      if (!enabled || enabled.backupInfo.version !== version)
        throw new Error("Backup activation could not be confirmed");
      active = await crypto.getActiveSessionBackupVersion();
    }
    let state: BackupInspection["state"] = "unavailable";
    if (!trust.trusted) state = "untrusted";
    else if (!trust.matchesDecryptionKey) state = "waiting-key";
    else if (active === version) state = "active";
    return {
      version,
      state,
      matching: trust.trusted && trust.matchesDecryptionKey,
    };
  }

  private async readServerInfo(): Promise<KeyBackupInfo | null> {
    try {
      // Use the public client HTTP API: the crypto convenience methods collapse
      // failed requests and M_NOT_FOUND into the same null result in SDK 41.6.
      return await this.mx.http.authedRequest<KeyBackupInfo>(
        Method.Get,
        "/room_keys/version",
        undefined,
        undefined,
        { prefix: ClientPrefix.V3 },
      );
    } catch (error) {
      if (error instanceof MatrixError && error.errcode === "M_NOT_FOUND")
        return null;
      throw error;
    }
  }
}
