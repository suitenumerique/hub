import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { Driver } from "@/features/drivers/Driver";
import type { ChatRef, ChatTypingUser } from "@/features/drivers/types";

const TYPING_IDLE_MS = 5_000;
const TYPING_REFRESH_MS = 20_000;
const TYPER_REMOVAL_GRACE_MS = 3_000;

type TypingSession = {
  driver: Driver;
  chatId: string;
  active: boolean;
  idleTimer: number | null;
  refreshTimer: number | null;
  sendQueue: Promise<void>;
  sendSequence: number;
};

/**
 * Matrix typing writes are state transitions, not independent notifications.
 * Keep them ordered so a slow `false` sent with a message can never arrive
 * after the `true` from the user's next keystroke and silently stop that new
 * typing session on the homeserver.
 */
const sendTyping = (
  session: TypingSession,
  isTyping: boolean,
): Promise<void> => {
  const sequence = ++session.sendSequence;
  session.sendQueue = session.sendQueue
    // Do not race this request with an application timeout: sendTyping exposes
    // no cancellation signal, so starting the next transition while this one is
    // still in flight could let an old `true` arrive after a newer `false`.
    .then(() =>
      session.driver.sendChatTyping({ chatId: session.chatId, isTyping }),
    )
    // Typing is best-effort ephemeral state: it must never block composition or
    // raise a global error toast when the connection briefly drops. If the most
    // recent `true` failed, reopen the local session so the next keystroke can
    // retry immediately instead of waiting for the refresh interval.
    .catch(() => {
      if (isTyping && sequence === session.sendSequence && session.active) {
        session.active = false;
        if (session.refreshTimer !== null) {
          window.clearInterval(session.refreshTimer);
          session.refreshTimer = null;
        }
      }
    });
  return session.sendQueue;
};

const stopSession = (session: TypingSession): Promise<void> => {
  if (session.idleTimer !== null) {
    window.clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
  if (session.refreshTimer !== null) {
    window.clearInterval(session.refreshTimer);
    session.refreshTimer = null;
  }
  if (session.active) {
    session.active = false;
    return sendTyping(session, false);
  }
  return session.sendQueue;
};

const sameUsers = (left: ChatTypingUser[], right: ChatTypingUser[]): boolean =>
  left.length === right.length &&
  left.every(
    (user, index) =>
      user.id === right[index]?.id && user.name === right[index]?.name,
  );

export type UseChatTypingResult = {
  users: ChatTypingUser[];
  /** Called only for actual user input, not programmatic draft hydration. */
  onTypingActivity: (hasText: boolean) => Promise<void>;
  stopTyping: () => Promise<void>;
};

/**
 * Room-scoped typing state. Incoming state lives in local React memory only;
 * outgoing state is refreshed before the Matrix timeout and stopped after a
 * short idle period. Departing typers are held briefly so a quick stop/restart
 * never flashes the indicator off and back on.
 */
export const useChatTyping = (ref: ChatRef | null): UseChatTypingResult => {
  const entries = useDriverEntries();
  const accountId = ref?.accountId;
  const chatId = ref?.chatId;
  const driver = useMemo(
    () =>
      accountId
        ? (entries.find((entry) => entry.accountId === accountId)?.driver ??
          null)
        : null,
    [accountId, entries],
  );
  const [users, setUsers] = useState<ChatTypingUser[]>([]);
  const visibleUsersRef = useRef<ChatTypingUser[]>([]);
  const removalTimersRef = useRef(new Map<string, number>());
  const suppressedAfterMessageRef = useRef(new Set<string>());
  const rawTypingUserIdsRef = useRef(new Set<string>());
  const sessionRef = useRef<TypingSession | null>(null);

  useEffect(() => {
    removalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    removalTimersRef.current.clear();
    suppressedAfterMessageRef.current.clear();
    rawTypingUserIdsRef.current.clear();
    visibleUsersRef.current = [];
    setUsers([]);

    if (!chatId || !driver) {
      return;
    }

    const unsubscribe = driver.subscribeToChatTyping(
      chatId,
      (incomingUsers) => {
        const rawIncomingIds = new Set(incomingUsers.map(({ id }) => id));
        rawTypingUserIdsRef.current = rawIncomingIds;
        // A received message suppresses its author until Matrix has first
        // confirmed a non-typing snapshot. A later true transition then starts
        // a genuinely new typing session instead of resurrecting stale state.
        suppressedAfterMessageRef.current.forEach((id) => {
          if (!rawIncomingIds.has(id)) {
            suppressedAfterMessageRef.current.delete(id);
          }
        });
        const visibleIncomingUsers = incomingUsers.filter(
          ({ id }) => !suppressedAfterMessageRef.current.has(id),
        );
        const incomingById = new Map(
          visibleIncomingUsers.map((user) => [user.id, user]),
        );

        visibleIncomingUsers.forEach(({ id }) => {
          const timer = removalTimersRef.current.get(id);
          if (timer !== undefined) {
            window.clearTimeout(timer);
            removalTimersRef.current.delete(id);
          }
        });

        visibleUsersRef.current.forEach(({ id }) => {
          if (incomingById.has(id) || removalTimersRef.current.has(id)) {
            return;
          }
          const timer = window.setTimeout(() => {
            removalTimersRef.current.delete(id);
            const next = visibleUsersRef.current.filter(
              (user) => user.id !== id,
            );
            visibleUsersRef.current = next;
            setUsers((current) => (sameUsers(current, next) ? current : next));
          }, TYPER_REMOVAL_GRACE_MS);
          removalTimersRef.current.set(id, timer);
        });

        const lingering = visibleUsersRef.current.filter(
          ({ id }) => !incomingById.has(id),
        );
        const next = [...visibleIncomingUsers, ...lingering];
        visibleUsersRef.current = next;
        setUsers((current) => (sameUsers(current, next) ? current : next));
      },
    );
    const unsubscribeEvents = driver.subscribeToEvents((event) => {
      if (event.type !== "message:new" || event.chatId !== chatId) {
        return;
      }
      const authorId = event.message.authorId;
      // `/sync` may apply the preceding typing=false before the message event.
      // In that order there is no stale state left to suppress: adding the id
      // unconditionally would hide the user's next true transition until they
      // erased their draft. Suppress only when the current raw snapshot still
      // says that this author is typing.
      if (rawTypingUserIdsRef.current.has(authorId)) {
        suppressedAfterMessageRef.current.add(authorId);
      } else {
        suppressedAfterMessageRef.current.delete(authorId);
      }
      const removalTimer = removalTimersRef.current.get(authorId);
      if (removalTimer !== undefined) {
        window.clearTimeout(removalTimer);
        removalTimersRef.current.delete(authorId);
      }
      const next = visibleUsersRef.current.filter(({ id }) => id !== authorId);
      visibleUsersRef.current = next;
      setUsers((current) => (sameUsers(current, next) ? current : next));
    });
    return () => {
      unsubscribe();
      unsubscribeEvents();
      removalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      removalTimersRef.current.clear();
      suppressedAfterMessageRef.current.clear();
      rawTypingUserIdsRef.current.clear();
      visibleUsersRef.current = [];
    };
  }, [chatId, driver]);

  useEffect(() => {
    const previous = sessionRef.current;
    if (previous) {
      void stopSession(previous);
      sessionRef.current = null;
    }
    if (!accountId || !chatId || !driver) {
      return;
    }
    const session: TypingSession = {
      driver,
      chatId,
      active: false,
      idleTimer: null,
      refreshTimer: null,
      sendQueue: Promise.resolve(),
      sendSequence: 0,
    };
    sessionRef.current = session;
    return () => {
      void stopSession(session);
      if (sessionRef.current === session) {
        sessionRef.current = null;
      }
    };
  }, [accountId, chatId, driver]);

  const stopTyping = useCallback(() => {
    const session = sessionRef.current;
    return session ? stopSession(session) : Promise.resolve();
  }, []);

  const onTypingActivity = useCallback((hasText: boolean) => {
    const session = sessionRef.current;
    if (!session) {
      return Promise.resolve();
    }
    if (!hasText) {
      return stopSession(session);
    }
    if (session.idleTimer !== null) {
      window.clearTimeout(session.idleTimer);
    }
    if (!session.active) {
      session.active = true;
      sendTyping(session, true);
      session.refreshTimer = window.setInterval(
        () => sendTyping(session, true),
        TYPING_REFRESH_MS,
      );
    }
    session.idleTimer = window.setTimeout(
      () => void stopSession(session),
      TYPING_IDLE_MS,
    );
    return session.sendQueue;
  }, []);

  return { users, onTypingActivity, stopTyping };
};
