import { useEffect, useRef, useState } from "react";

import type { ChatSecurityCommand } from "@/features/drivers/security";
import type { AccountId } from "@/features/drivers/types";

import { useChatSecurity } from "./useChatSecurity";

/**
 * Security state and commands of one account, for the "Encryption" settings.
 * Used by the settings modal rather than its tab, so a command still running
 * reports its failure after a tab change.
 */
export const useEncryptionCommands = (accountId: AccountId | null) => {
  const { security, driver } = useChatSecurity(accountId);
  const [commandFailed, setCommandFailed] = useState(false);
  const commandGeneration = useRef(0);
  // Ignore failures from commands belonging to an unmounted/replaced driver;
  // a late rejection must not show up for a different session.
  useEffect(
    () => () => {
      commandGeneration.current++;
    },
    [driver],
  );

  const run = (command: ChatSecurityCommand) => {
    const generation = ++commandGeneration.current;
    setCommandFailed(false);
    void driver?.securityCommand(command).catch(() => {
      // Closing the settings remains effective when remote cancellation fails.
      if (generation !== commandGeneration.current || command.type === "cancel")
        return;
      setCommandFailed(true);
    });
  };

  /** The settings close: a verification left open is cancelled. */
  const onClose = () => {
    // A pending failure must not show up when the settings open again.
    commandGeneration.current++;
    setCommandFailed(false);
    const { verification } = security;
    if (verification.phase !== "idle") {
      run({ type: "cancel", attempt: verification.attempt });
    }
  };

  return { security, commandFailed, run, onClose };
};
