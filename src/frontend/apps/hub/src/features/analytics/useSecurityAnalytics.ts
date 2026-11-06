import { useEffect } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatSecuritySnapshot } from "@/features/drivers/security";

import {
  type EventProperty,
  isAnalyticsEnabled,
  readAnalyticsStorage,
  setPersonProperties,
  trackEvent,
  writeAnalyticsStorage,
} from "./analytics";

type Verification = ChatSecuritySnapshot["verification"];

const ACTIVE_PHASES: Verification["phase"][] = [
  "requesting",
  "incoming",
  "waiting",
  "comparing",
  "confirming",
];

const verificationResult = (
  previous: Verification,
  next: Verification,
): EventProperty<"encryption:verification-completed", "result"> | null => {
  if (
    !ACTIVE_PHASES.includes(previous.phase) ||
    ACTIVE_PHASES.includes(next.phase)
  ) {
    return null;
  }
  // Refusing the emojis cancels the verification: this flag tells them apart.
  if (next.mismatch) return "mismatch";
  switch (next.phase) {
    case "complete":
      return "verified";
    case "expired":
      return "expired";
    case "error":
      return "error";
    default:
      // A verification cancelled from this device goes straight back to idle.
      return "cancelled";
  }
};

/**
 * What the device could recover of its history once it can send, or null while
 * it is not known. A device verified before analytics existed recovers nothing
 * again, so it stays silent: it is not going through activation.
 */
const readyHistory = (
  security: ChatSecuritySnapshot,
): "complete" | "partial" | null => {
  if (!security.canSendEncrypted) return null;
  if (security.history === "complete" || security.history === "partial") {
    return security.history;
  }
  return security.history === "error" || security.backup === "stale-key"
    ? "partial"
    : null;
};

const reportEncryptionReady = (security: ChatSecuritySnapshot): void => {
  const history = readyHistory(security);
  if (!history || !security.deviceId || !isAnalyticsEnabled()) return;
  const storageName = `encryption-ready:${security.deviceId}`;
  if (readAnalyticsStorage(storageName) !== null) return;
  writeAnalyticsStorage(storageName, "true");
  trackEvent("encryption:ready", { history });
};

/**
 * Follows the security state of every chat account: the end of each device
 * verification, the first time this device can read and send encrypted
 * messages, and the person properties that come with the account.
 */
export const useSecurityAnalytics = (): void => {
  const entries = useDriverEntries();

  useEffect(() => {
    const cleanups = entries.map(({ driver }) => {
      let previous = driver.getSecuritySnapshot();

      const observe = () => {
        const security = driver.getSecuritySnapshot();
        const result = verificationResult(
          previous.verification,
          security.verification,
        );
        previous = security;
        if (result) {
          trackEvent("encryption:verification-completed", { result });
        }
        reportEncryptionReady(security);

        // Known once this device is inspected. Always sent whole: the SDK ignores
        // the same properties sent again, as after a reconnection.
        if (!security.userId || security.referenceDeviceCount === undefined) {
          return;
        }
        setPersonProperties({
          // The server part of the Matrix id tells the ministry.
          tchap_server: security.userId.split(":")[1],
          // Verifying this device needs another open Tchap session.
          has_other_tchap_session: security.referenceDeviceCount > 0,
        });
      };

      observe();
      return driver.subscribeToSecurity(observe);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [entries]);
};
