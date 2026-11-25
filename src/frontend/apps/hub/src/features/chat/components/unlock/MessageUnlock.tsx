import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { ChatSecuritySnapshot } from "@/features/drivers/security";
import type { AccountId } from "@/features/drivers/types";

import { useEncryptionCommands } from "../../hooks/useEncryptionCommands";
import { canUnlockDevice } from "../../hooks/useIsChatLocked";
import {
  type UnlockDevice,
  useMessageUnlock,
} from "../../MessageUnlockContext";

import { UnlockComparison } from "./UnlockComparison";
import { UnlockCompletion } from "./UnlockCompletion";
import { UnlockDone } from "./UnlockDone";
import { UnlockFailure } from "./UnlockFailure";
import { UnlockSetup, UnlockStart } from "./UnlockStart";
import { UnlockPhoneWaiting, UnlockTabWaiting } from "./UnlockWaiting";

type Screen =
  | "setup"
  | "start"
  | "waiting"
  | "comparison"
  | "failure"
  | "completion"
  | "done";

const screenFor = (
  security: ChatSecuritySnapshot,
  device: UnlockDevice | null,
  isDone: boolean,
): Screen => {
  if (device === null) {
    return canUnlockDevice(security) ? "start" : "setup";
  }
  if (isDone) {
    return "done";
  }
  switch (security.verification.phase) {
    case "comparing":
      return "comparison";
    case "confirming":
    case "complete":
      return "completion";
    case "cancelled":
    case "expired":
    case "error":
      return "failure";
    default:
      return "waiting";
  }
};

/**
 * Takes the place of the home page and, once another device can unlock it, of
 * the encrypted conversations. Not a dialog: the rest of the Hub stays usable.
 */
export const MessageUnlock = ({ accountId }: { accountId: AccountId }) => {
  const { t } = useTranslation();
  const { security, commandFailed, run } = useEncryptionCommands(accountId);
  const { session, isDone, start, stop } = useMessageUnlock();
  const { externalClient, verification } = security;
  const client = externalClient?.label ?? t("your reference app");
  const device = session?.accountId === accountId ? session.device : null;
  const screen = screenFor(security, device, isDone);

  // The button that changed the screen left with it. The focus goes on to the
  // next one, unless it is elsewhere in the Hub.
  const rootRef = useRef<HTMLDivElement>(null);
  const focusedScreen = useRef(screen);
  useEffect(() => {
    if (focusedScreen.current === screen) return;
    focusedScreen.current = screen;
    if (document.activeElement === document.body)
      rootRef.current?.querySelector("h1")?.focus();
  }, [screen]);

  const isStarting = device !== null && verification.phase === "idle";
  useEffect(() => {
    // The request could not leave.
    if (commandFailed && isStarting) stop();
  }, [commandFailed, isStarting, stop]);

  const openClient = () => {
    if (externalClient)
      window.open(externalClient.url, "_blank", "noopener,noreferrer");
  };
  const startWith = (next: UnlockDevice) => {
    if (next === "tab") openClient();
    start(accountId, next);
    run({ type: "verify" });
  };

  const renderScreen = () => {
    if (device === null) {
      return screen === "setup" ? (
        <UnlockSetup
          client={client}
          isIdentityMissing={security.trust === "missing-identity"}
          onOpenClient={externalClient && openClient}
        />
      ) : (
        <UnlockStart
          client={client}
          hasFailed={commandFailed}
          onStart={startWith}
          canOpenClient={externalClient !== undefined}
        />
      );
    }
    switch (screen) {
      case "comparison":
        return (
          <UnlockComparison
            verification={verification}
            device={device}
            client={client}
            hasFailed={commandFailed}
            onCommand={run}
            onCancel={stop}
          />
        );
      case "completion":
        return (
          <UnlockCompletion
            security={security}
            device={device}
            client={client}
            onSkip={stop}
          />
        );
      case "done":
        return (
          <UnlockDone isHistoryComplete={security.history === "complete"} />
        );
      case "failure":
        return (
          <UnlockFailure
            verification={verification}
            hasFailed={commandFailed}
            // The tab is still open: it only needs a new request.
            onRestart={device === "tab" ? () => run({ type: "verify" }) : stop}
          />
        );
      default: {
        const Waiting =
          device === "tab" ? UnlockTabWaiting : UnlockPhoneWaiting;
        return (
          <Waiting
            client={client}
            isRequestSent={verification.phase === "waiting"}
            onCancel={stop}
          />
        );
      }
    }
  };

  return (
    <div className="hub__message-unlock" ref={rootRef}>
      {renderScreen()}
    </div>
  );
};
