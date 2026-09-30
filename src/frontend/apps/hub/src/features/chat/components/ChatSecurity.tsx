import { Button, Modal, ModalSize } from "@gouvfr-lasuite/ui-components";
import { Key } from "@gouvfr-lasuite/ui-components/icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatSecurityCommand } from "@/features/drivers/security";
import { useChatSecurity } from "../hooks/useChatSecurity";
import { useEncryptionSettings } from "../EncryptionSettingsContext";

import { EncryptionSettingsContent } from "./EncryptionSettingsContent";

const AccountSecurity = ({ accountId }: { accountId: string }) => {
  const { t } = useTranslation();
  const { security, driver } = useChatSecurity(accountId);
  const settings = useEncryptionSettings();
  const details = settings.accountId === accountId;
  const [commandFailed, setCommandFailed] = useState(false);
  const dialogContent = useRef<HTMLDivElement>(null);
  const commandGeneration = useRef(0);
  // Ignore failures from commands belonging to an unmounted/replaced driver;
  // a late rejection must not reopen settings for a different session.
  useEffect(
    () => () => {
      commandGeneration.current++;
    },
    [driver],
  );
  const verification = security.verification;
  // Incoming verification opens the same modal even without an explicit visit
  // to settings; terminal states remain visible until the user closes it.
  const active = verification.phase !== "idle";
  useEffect(() => {
    if (!security.supported || (!details && !active)) return;
    // SAS transitions remove the focused Accept/Confirm button. Keep keyboard
    // focus in the dialog so Escape and the modal's focus trap still work.
    const frame = requestAnimationFrame(() => {
      const content = dialogContent.current;
      const dialog = content?.closest('[role="dialog"]');
      if (dialog && !dialog.contains(document.activeElement)) {
        const target =
          content?.querySelector<HTMLButtonElement>("button:not(:disabled)") ??
          dialog.querySelector<HTMLButtonElement>("button:not(:disabled)");
        target?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, details, security.supported, verification.phase]);
  if (!security.supported) return null;
  const run = (command: ChatSecurityCommand) => {
    const generation = ++commandGeneration.current;
    setCommandFailed(false);
    void driver?.securityCommand(command).catch(() => {
      // Closing the dialog remains effective when remote cancellation fails.
      if (generation !== commandGeneration.current || command.type === "cancel")
        return;
      setCommandFailed(true);
      settings.open(accountId);
    });
  };
  const close = () => {
    // A pending recovery failure must not reopen a dialog the user just closed.
    commandGeneration.current++;
    settings.close();
    if (verification.phase !== "idle") {
      run({ type: "cancel", attempt: verification.attempt });
    }
  };
  const verifying = [
    "incoming",
    "requesting",
    "waiting",
    "comparing",
    "confirming",
  ].includes(verification.phase);
  return (
    <Modal
      isOpen={details || active}
      size={ModalSize.MEDIUM}
      title={t("Encryption")}
      titleIcon={<Key aria-hidden="true" />}
      titleVariant="compact"
      aria-label={t("Encryption")}
      onClose={close}
      closeOnClickOutside
      closeOnEsc
      stickyFooter
      rightActions={
        <Button variant="secondary" color="neutral" onClick={close}>
          {verifying ? t("Cancel verification") : t("Close")}
        </Button>
      }
    >
      <div ref={dialogContent}>
        <EncryptionSettingsContent
          security={security}
          commandFailed={commandFailed}
          onCommand={run}
        />
      </div>
    </Modal>
  );
};

export const ChatSecurity = () => {
  const entries = useDriverEntries();
  return (
    <>
      {entries.map(({ accountId }) => (
        <AccountSecurity key={accountId} accountId={accountId} />
      ))}
    </>
  );
};
