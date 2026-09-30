/** Public UI state. Credentials, recovery keys and SDK objects never cross this boundary. */
export type ChatSecuritySnapshot = {
  supported: boolean;
  userId?: string;
  deviceId?: string;
  referenceDeviceCount?: number;
  externalClient?: { url: string; label: string };
  trust:
    | "checking"
    | "missing-identity"
    | "unverified"
    | "verified"
    | "changed";
  secrets: "waiting" | "delayed" | "ready";
  backup:
    | "checking"
    | "missing"
    | "untrusted"
    | "waiting-key"
    | "active"
    | "unavailable";
  backupVersion?: string;
  backupRemaining?: number;
  history: "idle" | "restoring" | "complete" | "partial" | "error";
  historyImported?: number;
  historyTotal?: number;
  canSendEncrypted: boolean;
  issue?: {
    area: "trust" | "backup";
    reason: ChatSecurityFailureReason;
  };
  verification: {
    attempt: number;
    phase:
      | "idle"
      | "requesting"
      | "incoming"
      | "waiting"
      | "comparing"
      | "confirming"
      | "complete"
      | "cancelled"
      | "expired"
      | "error";
    transactionId?: string;
    deviceId?: string;
    emojis?: [string, string][];
    decimals?: [number, number, number];
    mismatch?: boolean;
  };
};

export type ChatSecurityCommand =
  | { type: "verify" }
  | { type: "retry" }
  | { type: "accept" | "match" | "mismatch" | "cancel"; attempt: number };

export type ChatSecurityFailureReason =
  | "network"
  | "permission"
  | "session"
  | "rate-limited"
  | "trust"
  | "storage"
  | "unknown";

export class ChatSecuritySendError extends Error {
  constructor(
    readonly reason: "not-ready" | "send-failed" | ChatSecurityFailureReason,
    options?: ErrorOptions,
  ) {
    super(reason, options);
    this.name = "ChatSecuritySendError";
  }
}

export const EMPTY_SECURITY: ChatSecuritySnapshot = {
  supported: false,
  trust: "checking",
  secrets: "waiting",
  backup: "checking",
  history: "idle",
  canSendEncrypted: false,
  verification: { attempt: 0, phase: "idle" },
};
