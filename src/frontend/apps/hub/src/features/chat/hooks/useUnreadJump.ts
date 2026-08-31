import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { VirtuosoHandle } from "react-virtuoso";

import type { OpenFirstUnreadResult } from "./useChatMessages";

const UNREAD_JUMP_TIMEOUT_MS = 1200;

type JumpPhase = "idle" | "opening" | "waiting" | "scrolling" | "anchored";

type JumpSession = {
  chatKey: string;
  id: number;
  phase: JumpPhase;
  scrollStarted: boolean;
  reducedMotion: boolean;
  deadline: number | null;
  contextWasActive: boolean;
};

type UseUnreadJumpOptions = {
  chatKey: string;
  enabled: boolean;
  targetIndex: number;
  openFirstUnread: () => Promise<OpenFirstUnreadResult>;
  virtuosoRef: RefObject<VirtuosoHandle | null>;
  onJumpAborted: () => void;
  isContextActive: boolean;
  onAtBottomChange: (atBottom: boolean) => void;
};

const isInProgress = (phase: JumpPhase): boolean =>
  phase === "opening" || phase === "waiting" || phase === "scrolling";

const keepsContextOpen = (phase: JumpPhase): boolean =>
  phase === "waiting" || phase === "scrolling" || phase === "anchored";

const isCurrentSession = (current: JumpSession, candidate: JumpSession) =>
  current.chatKey === candidate.chatKey && current.id === candidate.id;

const createSession = (
  chatKey: string,
  id: number,
  phase: JumpPhase = "idle",
): JumpSession => ({
  chatKey,
  id,
  phase,
  scrollStarted: false,
  reducedMotion: false,
  deadline: null,
  contextWasActive: false,
});

/** Owns the bounded, chat-scoped lifecycle of an explicit unread jump. */
export const useUnreadJump = ({
  chatKey,
  enabled,
  targetIndex,
  openFirstUnread,
  virtuosoRef,
  onJumpAborted,
  isContextActive,
  onAtBottomChange,
}: UseUnreadJumpOptions) => {
  const sessionRef = useRef<JumpSession>(createSession(chatKey, 0));
  if (sessionRef.current.chatKey !== chatKey) {
    sessionRef.current = createSession(chatKey, sessionRef.current.id + 1);
  }
  if (isContextActive) {
    sessionRef.current.contextWasActive = true;
  }

  const scrollerElementRef = useRef<HTMLElement | Window | null>(null);
  const separatorRef = useRef<HTMLDivElement>(null);
  const [visibleSession, setVisibleSession] = useState(() => ({
    chatKey,
    phase: "idle" as JumpPhase,
  }));
  const phase =
    visibleSession.chatKey === chatKey ? visibleSession.phase : "idle";

  const showPhase = useCallback(
    (session: JumpSession, nextPhase: JumpPhase) => {
      if (!isCurrentSession(sessionRef.current, session)) {
        return;
      }
      session.phase = nextPhase;
      if (nextPhase !== "scrolling") {
        session.scrollStarted = false;
      }
      setVisibleSession({ chatKey: session.chatKey, phase: nextPhase });
    },
    [],
  );

  const reset = useCallback(() => {
    const current = sessionRef.current;
    if (current.chatKey !== chatKey) {
      return;
    }
    sessionRef.current = createSession(chatKey, current.id + 1);
    setVisibleSession({ chatKey, phase: "idle" });
  }, [chatKey]);

  const finish = useCallback(
    (session: JumpSession) => {
      if (
        !isCurrentSession(sessionRef.current, session) ||
        session.phase !== "scrolling"
      ) {
        return;
      }
      const scroller = scrollerElementRef.current;
      onAtBottomChange(
        scroller instanceof HTMLElement &&
          scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
            1,
      );
      showPhase(session, "anchored");
      requestAnimationFrame(() => {
        if (isCurrentSession(sessionRef.current, session)) {
          separatorRef.current?.focus({ preventScroll: true });
        }
      });
    },
    [onAtBottomChange, showPhase],
  );

  const open = useCallback(() => {
    const current = sessionRef.current;
    if (
      !enabled ||
      (current.chatKey === chatKey && isInProgress(current.phase))
    ) {
      return;
    }
    const session = createSession(chatKey, current.id + 1, "opening");
    sessionRef.current = session;
    setVisibleSession({ chatKey, phase: "opening" });
    void openFirstUnread()
      .then((result) => {
        if (result.status === "opened") {
          session.deadline = Date.now() + UNREAD_JUMP_TIMEOUT_MS;
        }
        showPhase(session, result.status === "opened" ? "waiting" : "idle");
      })
      .catch(() => showPhase(session, "idle"));
  }, [chatKey, enabled, openFirstUnread, showPhase]);

  // One phase-driven effect and one deadline bound rendering and scrolling.
  useEffect(() => {
    const session = sessionRef.current;
    if (session.chatKey !== chatKey) {
      return;
    }
    if (
      keepsContextOpen(phase) &&
      session.contextWasActive &&
      !isContextActive
    ) {
      onJumpAborted();
      showPhase(session, "idle");
      return;
    }
    if (phase !== "waiting" && phase !== "scrolling") {
      return;
    }
    const remaining = Math.max(
      0,
      (session.deadline ?? Date.now()) - Date.now(),
    );
    const timer = window.setTimeout(() => {
      if (session.phase === "scrolling") {
        finish(session);
      } else {
        onJumpAborted();
        showPhase(session, "idle");
      }
    }, remaining);
    const settleRaf =
      phase === "scrolling" && session.reducedMotion
        ? requestAnimationFrame(() => finish(session))
        : null;
    const scrollRaf =
      phase === "waiting" && targetIndex >= 0
        ? requestAnimationFrame(() => {
            const virtuoso = virtuosoRef.current;
            if (
              !virtuoso ||
              !isCurrentSession(sessionRef.current, session) ||
              session.phase !== "waiting"
            ) {
              return;
            }
            const scroller = scrollerElementRef.current;
            const scrollerHeight =
              scroller && "clientHeight" in scroller
                ? scroller.clientHeight
                : 0;
            session.phase = "scrolling";
            session.reducedMotion =
              window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
              false;
            onAtBottomChange(false);
            setVisibleSession({ chatKey, phase: "scrolling" });
            virtuoso.scrollToIndex({
              index: targetIndex,
              align: "start",
              offset: -Math.round(scrollerHeight / 3),
              behavior: session.reducedMotion ? "auto" : "smooth",
            });
          })
        : null;
    return () => {
      window.clearTimeout(timer);
      if (settleRaf !== null) cancelAnimationFrame(settleRaf);
      if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
    };
  }, [
    chatKey,
    finish,
    isContextActive,
    onJumpAborted,
    onAtBottomChange,
    phase,
    showPhase,
    targetIndex,
    virtuosoRef,
  ]);

  const onScrolling = useCallback(
    (isScrolling: boolean) => {
      const session = sessionRef.current;
      if (session.chatKey !== chatKey || session.phase !== "scrolling") {
        return;
      }
      if (isScrolling) {
        session.scrollStarted = true;
      } else if (session.scrollStarted) {
        finish(session);
      }
    },
    [chatKey, finish],
  );
  const scrollerRef = useCallback((element: HTMLElement | Window | null) => {
    scrollerElementRef.current = element;
  }, []);

  return {
    hasUnreadContext: keepsContextOpen(phase),
    isJumping: isInProgress(phase),
    onScrolling,
    open,
    reset,
    scrollerRef,
    separatorRef,
  };
};
