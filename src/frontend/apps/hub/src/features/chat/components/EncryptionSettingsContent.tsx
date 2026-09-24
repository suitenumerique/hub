import { Badge, Button } from "@gouvfr-lasuite/ui-components";
import {
  ArrowUpRight,
  Checkmark,
  ChevronDown,
  Computer,
  Key,
} from "@gouvfr-lasuite/ui-components/icons";
import { useId, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import type {
  ChatSecurityCommand,
  ChatSecuritySnapshot,
} from "@/features/drivers/security";

import { EncryptionVerification } from "./EncryptionVerification";
import { securityFailureMessage } from "../securityMessages";

type Props = {
  security: ChatSecuritySnapshot;
  commandFailed: boolean;
  onCommand: (command: ChatSecurityCommand) => void;
};

export const EncryptionSettingsContent = ({
  security,
  commandFailed,
  onCommand,
}: Props) => {
  const { t } = useTranslation();
  const id = useId();
  const external = security.externalClient;
  const clientLabel = external?.label ?? t("your reference app");
  const verified = security.trust === "verified";
  const checking = security.trust === "checking";
  const missingIdentity = security.trust === "missing-identity";
  const noReferenceDevice = security.referenceDeviceCount === 0;
  const verifying = [
    "incoming",
    "requesting",
    "waiting",
    "comparing",
    "confirming",
  ].includes(security.verification.phase);
  // Hub verifies an existing identity and restores its backup. Creating an
  // identity or recovering one without another device belongs to the reference app.
  const needsExternalSetup =
    missingIdentity || (!verified && noReferenceDevice);
  const delayed = verified && security.secrets === "delayed";
  const backupNeedsSetup = ["missing", "untrusted"].includes(security.backup);
  const historyIncomplete = ["partial", "error"].includes(security.history);
  const restoring = security.history === "restoring";
  // An active backup does not imply that all historical keys were recovered.
  // Keep its status separate from the history feedback shown below.
  const backupActive = verified && security.backup === "active";
  const canRetry =
    !verifying &&
    !restoring &&
    (!!security.issue ||
      (verified &&
        !backupNeedsSetup &&
        (delayed ||
          historyIncomplete ||
          security.backup === "unavailable" ||
          (backupActive && security.history === "idle"))));
  const showExternal =
    !!external &&
    !verifying &&
    !checking &&
    (needsExternalSetup || (verified && backupNeedsSetup));
  const openExternal = () => {
    if (external) window.open(external.url, "_blank", "noopener,noreferrer");
  };

  type Status = { type: ComponentProps<typeof Badge>["type"]; label: string };
  const getDeviceStatus = (): Status => {
    if (verified) return { type: "success", label: t("Verified") };
    if (checking) return { type: "neutral", label: t("Checking…") };
    if (missingIdentity)
      return { type: "warning", label: t("Set up required") };
    return { type: "warning", label: t("Verification required") };
  };
  const getBackupStatus = (): Status => {
    if (backupActive) return { type: "success", label: t("Active") };
    if (!verified) return { type: "neutral", label: t("Pending verification") };
    if (security.backup === "checking")
      return { type: "neutral", label: t("Checking…") };
    if (security.backup === "waiting-key")
      return { type: "neutral", label: t("Waiting for keys") };
    return { type: "warning", label: t("Needs attention") };
  };
  const deviceStatus = getDeviceStatus();
  const backupStatus = getBackupStatus();

  const deviceDescription = () => {
    if (checking) return t("Checking the security of this browser…");
    if (missingIdentity)
      return t(
        "Set up encryption in {{client}}, then return here to verify this device.",
        { client: clientLabel },
      );
    if (security.trust === "changed")
      return t(
        "Your encryption identity has changed. Verify this device again before sending encrypted messages.",
      );
    if (!verified && noReferenceDevice)
      return t(
        "First sign in to {{client}} with the same account and set up encryption there.",
        { client: clientLabel },
      );
    if (!verified)
      return t(
        "Confirm that this browser belongs to you by comparing emojis with another device signed in to the same account.",
      );
    if (!security.canSendEncrypted)
      return t(
        "This device is verified. Encryption will be available once the keys from your other device have arrived.",
      );
    return t("You can send encrypted messages from this browser.");
  };

  const backupDescription = () => {
    if (checking) return t("Checking your backup…");
    if (!verified)
      return t(
        "Verify this device first to access your backup and recover your message history.",
      );
    switch (security.backup) {
      case "missing":
        return t(
          "No key backup is configured. Set one up in {{client}} to recover your messages on a new device.",
          { client: clientLabel },
        );
      case "untrusted":
        return t(
          "This backup cannot be trusted yet. Recover your account in {{client}} before using it.",
          { client: clientLabel },
        );
      case "waiting-key":
        return delayed
          ? t(
              "The keys are taking longer than expected. Keep {{client}} open and unlocked, then retry recovery.",
              { client: clientLabel },
            )
          : t(
              "Keep {{client}} open and unlocked while the backup key is shared with this browser.",
              { client: clientLabel },
            );
      case "unavailable":
        return t(
          "The backup is temporarily unavailable. Keys already on this device are kept; try again when the connection is restored.",
        );
      case "checking":
        return t("Checking your backup…");
      case "active":
        return t(
          "Your encryption keys are backed up securely so you can recover messages on another device.",
        );
    }
  };

  return (
    <div className="hub__security-details">
      <p className="hub__security-intro">
        {t(
          "Manage this device’s security and access to your encrypted messages.",
        )}
      </p>
      {commandFailed && (
        <p className="hub__security-feedback" role="alert">
          {t(
            "This action could not be completed. Check your connection and try again.",
          )}
        </p>
      )}
      {security.issue && (
        <p className="hub__security-feedback" role="alert">
          {securityFailureMessage(security.issue.reason, t)}
        </p>
      )}

      <section
        className="hub__security-section"
        aria-labelledby={`${id}-device`}
      >
        <div className="hub__security-section-heading">
          <h2 id={`${id}-device`}>
            <Computer aria-hidden="true" />
            {t("This device")}
          </h2>
          <Badge type={deviceStatus.type}>
            {verified && <Checkmark aria-hidden="true" />}
            {deviceStatus.label}
          </Badge>
        </div>
        <p>{deviceDescription()}</p>
        {delayed && security.backup !== "waiting-key" && !backupNeedsSetup && (
          <p className="hub__security-feedback" role="status">
            {t(
              "The keys are taking longer than expected. Keep {{client}} open and unlocked, then retry recovery.",
              { client: clientLabel },
            )}
          </p>
        )}
        <EncryptionVerification security={security} onCommand={onCommand} />
        {!verified && !checking && !needsExternalSetup && !verifying && (
          <div className="hub__security-actions">
            <Button onClick={() => onCommand({ type: "verify" })}>
              {t("Verify this device")}
            </Button>
          </div>
        )}
        {showExternal && needsExternalSetup && (
          <div className="hub__security-actions">
            <Button
              icon={<ArrowUpRight aria-hidden="true" />}
              iconPosition="right"
              onClick={openExternal}
            >
              {t("Open {{client}}", { client: clientLabel })}
            </Button>
          </div>
        )}
      </section>

      <section
        className="hub__security-section"
        aria-labelledby={`${id}-backup`}
      >
        <div className="hub__security-section-heading">
          <h2 id={`${id}-backup`}>
            <Key aria-hidden="true" />
            {t("Backup and history")}
          </h2>
          <Badge type={backupStatus.type}>
            {backupActive && <Checkmark aria-hidden="true" />}
            {backupStatus.label}
          </Badge>
        </div>
        <p>{backupDescription()}</p>
        {backupActive && (
          <p className="hub__security-note">
            {t(
              "Only messages whose keys are in the backup can be recovered. Keep the recovery key provided by {{client}} in a safe place.",
              { client: clientLabel },
            )}
          </p>
        )}
        {verified && (restoring || historyIncomplete) && (
          <p className="hub__security-feedback" role="status">
            {restoring
              ? t("Recovering your message history…")
              : t(
                  "Some message history could not be recovered. Messages already recovered remain available.",
                )}
          </p>
        )}
        {backupActive &&
          !restoring &&
          !historyIncomplete &&
          (security.backupRemaining ?? 0) > 0 && (
            <p className="hub__security-note" role="status">
              {t("Backing up new keys…")}
            </p>
          )}
        {(canRetry || (showExternal && !needsExternalSetup)) && (
          <div className="hub__security-actions">
            {canRetry && (
              <Button
                variant="secondary"
                onClick={() => onCommand({ type: "retry" })}
              >
                {security.history === "idle" && !security.issue
                  ? t("Recover message history")
                  : t("Retry recovery")}
              </Button>
            )}
            {showExternal && !needsExternalSetup && (
              <Button
                variant="secondary"
                icon={<ArrowUpRight aria-hidden="true" />}
                iconPosition="right"
                onClick={openExternal}
              >
                {t("Open {{client}}", { client: clientLabel })}
              </Button>
            )}
          </div>
        )}
      </section>

      <details className="hub__security-technical">
        <summary>
          {t("Technical details")}
          <ChevronDown aria-hidden="true" />
        </summary>
        <p className="hub__security-note">
          {t("These identifiers and counters can help diagnose a problem.")}
        </p>
        <dl>
          <div>
            <dt>{t("Matrix account")}</dt>
            <dd>{security.userId ?? "—"}</dd>
          </div>
          <div>
            <dt>{t("Device ID")}</dt>
            <dd>{security.deviceId ?? "—"}</dd>
          </div>
          {security.verification.deviceId && (
            <div>
              <dt>{t("Reference device")}</dt>
              <dd>{security.verification.deviceId}</dd>
            </div>
          )}
          {security.backupVersion && (
            <div>
              <dt>{t("Backup version")}</dt>
              <dd>{security.backupVersion}</dd>
            </div>
          )}
          {security.backupRemaining !== undefined && (
            <div>
              <dt>{t("Keys awaiting backup")}</dt>
              <dd>{security.backupRemaining}</dd>
            </div>
          )}
          {security.historyTotal !== undefined && (
            <div>
              <dt>{t("Keys recovered from backup")}</dt>
              <dd>
                {security.historyImported ?? 0} / {security.historyTotal}
              </dd>
            </div>
          )}
        </dl>
      </details>
    </div>
  );
};
