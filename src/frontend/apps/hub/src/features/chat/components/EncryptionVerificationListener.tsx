import { useEffect } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { AccountId } from "@/features/drivers/types";
import { useSettings } from "@/features/settings/SettingsContext";

import { useChatSecurity } from "../hooks/useChatSecurity";

const AccountVerificationListener = ({
  accountId,
}: {
  accountId: AccountId;
}) => {
  const { security } = useChatSecurity(accountId);
  const { open } = useSettings();
  const active = security.supported && security.verification.phase !== "idle";
  useEffect(() => {
    if (!active) return;
    // The settings then stay open until the user closes them, terminal states
    // included.
    open("encryption", {
      accountId,
      trigger:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
    });
  }, [active, accountId, open]);
  return null;
};

/**
 * Opens the "Encryption" settings as soon as a device verification starts,
 * even one another device asked for.
 */
export const EncryptionVerificationListener = () => {
  const entries = useDriverEntries();
  return (
    <>
      {entries.map(({ accountId }) => (
        <AccountVerificationListener key={accountId} accountId={accountId} />
      ))}
    </>
  );
};
