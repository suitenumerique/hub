import Head from "next/head";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useTranslation } from "react-i18next";

import type { ChatSecuritySnapshot } from "@/features/drivers/security";
import type { AccountId } from "@/features/drivers/types";

import { useEncryptionCommands } from "./hooks/useEncryptionCommands";

type VerificationPhase = ChatSecuritySnapshot["verification"]["phase"];

const UNCONFIRMED_PHASES: VerificationPhase[] = [
  "requesting",
  "waiting",
  "comparing",
  "confirming",
];

/** How long the card says that the account is ready: see `MessageUnlock.scss`. */
const DONE_DURATION_MS = 4400;

/** The other device that shows the emojis. */
export type UnlockDevice = "phone" | "tab";

type UnlockSession = {
  accountId: AccountId;
  device: UnlockDevice;
  /** Its verification left idle: the next idle ends it. */
  hasRun: boolean;
};

type MessageUnlock = {
  /** The unlocking under way, from the card; `null` when there is none. */
  session: UnlockSession | null;
  /** The messages are unlocked: the card says so before it leaves. */
  isDone: boolean;
  /** Accounts verified from the card, on this page. */
  verifiedAccountIds: readonly AccountId[];
  /** To call with the `verify` command. */
  start: (accountId: AccountId, device: UnlockDevice) => void;
  /** Leaves the verification, wherever it is. */
  stop: () => void;
};

const MessageUnlockContext = createContext<MessageUnlock | null>(null);

/**
 * Whether nothing more is expected once the device is verified: its history is
 * there, or will not come by waiting, which the settings then explain. Not on
 * an `issue`: a network cut reports one too, and the keys follow it.
 */
const isUnlockOver = (security: ChatSecuritySnapshot): boolean =>
  security.secrets === "delayed" ||
  ["complete", "partial", "error"].includes(security.history) ||
  (security.trust === "verified" &&
    (security.backup === "missing" ||
      (security.backup === "stale-key" && security.secrets === "ready")));

/**
 * Follows the unlocking started from the card: it finds its state back after a
 * visit to another conversation, and keeps showing until the history is
 * recovered, while the device is already verified.
 */
export const MessageUnlockProvider = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  const [session, setSession] = useState<UnlockSession | null>(null);
  const { security, run } = useEncryptionCommands(session?.accountId ?? null);
  const { phase, attempt } = security.verification;
  const [verifiedAccountIds, setVerifiedAccountIds] = useState<
    readonly AccountId[]
  >([]);

  // Adjusted while rendering, not in an effect: no screen of a session that is
  // over ever shows in between.
  if (session && phase === "incoming") {
    // Another device asks in its turn: the settings answer it.
    setSession(null);
  } else if (session && !session.hasRun && phase !== "idle") {
    setSession({ ...session, hasRun: true });
  } else if (session?.hasRun && phase === "idle") {
    setSession(null);
  }
  // The trust can take a while to follow: the card must not ask again.
  if (
    session &&
    phase === "complete" &&
    !verifiedAccountIds.includes(session.accountId)
  ) {
    setVerifiedAccountIds([...verifiedAccountIds, session.accountId]);
  }

  const start = useCallback(
    (accountId: AccountId, device: UnlockDevice) =>
      setSession({ accountId, device, hasRun: false }),
    [],
  );
  const stop = () => {
    if (phase === "idle") {
      setSession(null);
    } else {
      // Back to idle, which ends the session.
      run({ type: "cancel", attempt });
    }
  };
  const latestStop = useRef(stop);
  useEffect(() => {
    latestStop.current = stop;
  });
  const stableStop = useCallback(() => latestStop.current(), []);

  const isOver =
    session !== null && phase === "complete" && isUnlockOver(security);
  const isDone = isOver && security.canSendEncrypted;
  useEffect(() => {
    if (!isOver) return;
    if (!isDone) {
      // Not ready: the conversations and the settings say why.
      stableStop();
      return;
    }
    const timer = window.setTimeout(stableStop, DONE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isOver, isDone, stableStop]);

  const value = useMemo(
    () => ({ session, isDone, verifiedAccountIds, start, stop: stableStop }),
    [session, isDone, verifiedAccountIds, start, stableStop],
  );

  return (
    <MessageUnlockContext.Provider value={value}>
      {/* Helps to come back from the tab that shows the emojis. */}
      {session?.device === "tab" && UNCONFIRMED_PHASES.includes(phase) && (
        <Head>
          <title>{t("🔐 To confirm · LaSuite Tchap v2")}</title>
        </Head>
      )}
      {children}
    </MessageUnlockContext.Provider>
  );
};

export const useMessageUnlock = () => {
  const context = useContext(MessageUnlockContext);
  if (!context) {
    throw new Error("Unlocking messages requires MessageUnlockProvider");
  }
  return context;
};
