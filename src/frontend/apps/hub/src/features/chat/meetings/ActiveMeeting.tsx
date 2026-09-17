import {
  Edit,
  ExternalLink,
  Maximize,
  Minimize,
  XMark,
} from "@gouvfr-lasuite/ui-components/icons";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/Auth";
import { Whiteboard } from "@/features/chat/components/tools-panel/MeetingIcons";
import { useChatMeetingActions } from "@/features/chat/hooks/useChatMeetingActions";
import { useChatMeetings } from "@/features/chat/hooks/useChatMeetings";
import {
  formatMeetingDuration,
  getMeetingProgress,
  getMeetingStatus,
} from "@/features/drivers/meetingTime";
import type { ChatRef } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { useMeetingBoardUrl } from "./meetingBoard";
import { useNow } from "./useNow";

/** Minutes added by the organizer's extend button. */
export const MEETING_EXTENSION_MINUTES = 15;

/** The call to show: its link, and the meeting it belongs to when known. */
export type ActiveMeetingTarget = {
  url: string;
  meetingId?: string;
  chatRef?: ChatRef;
};

type ActiveMeetingContextValue = {
  /** Meet call currently shown, or `null` when the user is in no call. */
  url: string | null;
  isMinimized: boolean;
  /** Shows a call in the meeting window, replacing the current one. */
  openMeeting: (target: ActiveMeetingTarget) => void;
};

const ActiveMeetingContext = createContext<ActiveMeetingContextValue | null>(
  null,
);

export const useActiveMeeting = (): ActiveMeetingContextValue => {
  const value = useContext(ActiveMeetingContext);
  if (!value) {
    throw new Error(
      "useActiveMeeting must be used inside ActiveMeetingProvider.",
    );
  }
  return value;
};

type MeetingWindowProps = {
  target: ActiveMeetingTarget;
  isMinimized: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  onLeave: () => void;
};

/**
 * The call window. Minimizing only moves and shrinks it: the frame stays
 * mounted, so the call goes on while the user keeps using the Hub. It shows
 * the progress of the meeting, lets its organizer extend or close it, and
 * closes by itself for everyone once the meeting is closed.
 */
const MeetingWindow = ({
  target,
  isMinimized,
  onMinimize,
  onRestore,
  onLeave,
}: MeetingWindowProps) => {
  const { t } = useTranslation();
  const { chatUser } = useAuth();
  const now = useNow(15_000);
  const chatRef = target.chatRef ?? null;
  const { meetings } = useChatMeetings(chatRef, chatRef !== null);
  const { endMeeting, extendMeeting, renameMeeting, isPending } =
    useChatMeetingActions(chatRef);
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [wasBoardOpened, setWasBoardOpened] = useState(false);
  const isRenamingRef = useRef(false);
  // The whiteboard follows the meeting, so everyone in the call lands on the
  // same board; a call opened outside a meeting falls back on its own link.
  const boardUrl = useMeetingBoardUrl(target.meetingId ?? target.url);

  const meeting = target.meetingId
    ? meetings.find((candidate) => candidate.id === target.meetingId)
    : undefined;
  const status = meeting ? getMeetingStatus(meeting, now) : undefined;
  const progress = meeting ? getMeetingProgress(meeting, now) : undefined;
  const isOrganizer =
    meeting !== undefined && meeting.organizerId === chatUser?.userId;

  // Closed by its organizer (here or on another device), or by the server
  // once it was over and empty: leave the call.
  useEffect(() => {
    if (!meeting?.endedAt) {
      return;
    }
    if (meeting.endedBy === "auto") {
      notify.brand(t("The meeting was closed automatically."));
    } else if (!isOrganizer) {
      notify.brand(t("The meeting was closed by its organizer."));
    }
    onLeave();
  }, [meeting?.endedAt, meeting?.endedBy, isOrganizer, onLeave, t]);

  const title =
    meeting?.title ?? (isMinimized ? t("Meeting in progress") : t("Meeting"));
  const canManage = isOrganizer && meeting !== undefined && status !== "ended";

  const startRenaming = (current: string) => {
    isRenamingRef.current = true;
    setDraftTitle(current);
  };

  const stopRenaming = () => {
    isRenamingRef.current = false;
    setDraftTitle(null);
  };

  // Enter, then the blur of the removed field, must save only once.
  const saveTitle = () => {
    if (!isRenamingRef.current || draftTitle === null || !meeting) {
      return;
    }
    const next = draftTitle.trim();
    stopRenaming();
    if (next === (meeting.title ?? "")) {
      return;
    }
    void renameMeeting(meeting.id, next).catch(() => {
      // useChatMeetingActions already surfaces a toast.
    });
  };

  return (
    <>
      {!isMinimized && (
        <div
          className="hub__meeting-window__backdrop"
          data-testid="meeting-window-backdrop"
          onClick={onMinimize}
        />
      )}
      <section
        className="hub__meeting-window"
        data-minimized={isMinimized || undefined}
        role="dialog"
        aria-modal={!isMinimized}
        aria-label={t("Meeting")}
      >
        <header className="hub__meeting-window__bar">
          <span className="hub__meeting-window__heading">
            {draftTitle === null ? (
              <>
                <span className="hub__meeting-window__title">{title}</span>
                {canManage && meeting && (
                  <button
                    type="button"
                    className="hub__meeting-window__button"
                    aria-label={t("Rename the meeting")}
                    title={t("Rename the meeting")}
                    disabled={isPending}
                    onClick={() => startRenaming(meeting.title ?? "")}
                  >
                    <Edit />
                  </button>
                )}
              </>
            ) : (
              <input
                type="text"
                className="hub__meeting-window__title-input"
                value={draftTitle}
                placeholder={t("Meeting")}
                aria-label={t("Meeting name")}
                maxLength={120}
                autoFocus
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    saveTitle();
                  } else if (event.key === "Escape") {
                    stopRenaming();
                  }
                }}
              />
            )}
            {progress && status === "ongoing" && (
              <span
                className="hub__meeting-window__progress"
                data-overdue={progress.isOverdue || undefined}
                data-testid="meeting-progress"
              >
                {progress.plannedMs === undefined
                  ? formatMeetingDuration(progress.elapsedMs)
                  : `${formatMeetingDuration(progress.elapsedMs)} / ${formatMeetingDuration(progress.plannedMs)}`}
                {progress.isOverdue && ` · ${t("Overtime")}`}
              </span>
            )}
          </span>
          <span className="hub__meeting-window__actions">
            {canManage && meeting && (
              <>
                <button
                  type="button"
                  className="hub__meeting-window__text-button"
                  disabled={isPending}
                  title={t("Extend the meeting by {{minutes}} minutes", {
                    minutes: MEETING_EXTENSION_MINUTES,
                  })}
                  onClick={() => {
                    void extendMeeting(
                      meeting.id,
                      MEETING_EXTENSION_MINUTES,
                    ).catch(() => {
                      // useChatMeetingActions already surfaces a toast.
                    });
                  }}
                >
                  {`+${MEETING_EXTENSION_MINUTES} min`}
                </button>
                <button
                  type="button"
                  className="hub__meeting-window__text-button"
                  data-danger="true"
                  disabled={isPending}
                  onClick={() => {
                    void endMeeting(
                      meeting.id,
                      meeting.title ?? t("Meeting"),
                    ).catch(() => {
                      // useChatMeetingActions already surfaces a toast.
                    });
                  }}
                >
                  {t("Close the meeting")}
                </button>
              </>
            )}
            {boardUrl && !isMinimized && (
              <button
                type="button"
                className="hub__meeting-window__button"
                aria-label={
                  isBoardOpen
                    ? t("Hide the whiteboard")
                    : t("Show the whiteboard")
                }
                title={
                  isBoardOpen
                    ? t("Hide the whiteboard")
                    : t("Show the whiteboard")
                }
                aria-pressed={isBoardOpen}
                onClick={() => {
                  setWasBoardOpened(true);
                  setIsBoardOpen((open) => !open);
                }}
              >
                <Whiteboard />
              </button>
            )}
            <a
              className="hub__meeting-window__button"
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("Open in a new tab")}
              title={t("Open in a new tab")}
              // The call continues in the new tab: leave the embedded one so
              // the user is not in the call twice.
              onClick={onLeave}
            >
              <ExternalLink />
            </a>
            <button
              type="button"
              className="hub__meeting-window__button"
              aria-label={
                isMinimized
                  ? t("Restore the meeting")
                  : t("Minimize the meeting")
              }
              title={
                isMinimized
                  ? t("Restore the meeting")
                  : t("Minimize the meeting")
              }
              onClick={isMinimized ? onRestore : onMinimize}
            >
              {isMinimized ? <Maximize /> : <Minimize />}
            </button>
            <button
              type="button"
              className="hub__meeting-window__button"
              data-danger="true"
              aria-label={t("Leave the meeting")}
              title={t("Leave the meeting")}
              onClick={onLeave}
            >
              <XMark />
            </button>
          </span>
        </header>
        <div className="hub__meeting-window__body">
          <iframe
            className="hub__meeting-window__frame"
            src={target.url}
            title={t("Meeting")}
            allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-write"
            allowFullScreen
          />
          {/* Hidden rather than unmounted once opened: reloading the frame
              would drop the drawer out of the collaboration and lose their
              local scene. The thumbnail has no room for it, so minimizing the
              window hides it too. */}
          {boardUrl && wasBoardOpened && (
            <iframe
              className="hub__meeting-window__board"
              data-testid="meeting-board"
              src={boardUrl}
              title={t("Whiteboard")}
              allow="clipboard-read; clipboard-write"
              hidden={!isBoardOpen || isMinimized}
            />
          )}
        </div>
      </section>
    </>
  );
};

/**
 * Holds the Meet call the user is in, above every page: the call survives
 * navigation between conversations, and its window can be minimized to use
 * the Hub at the same time.
 */
export const ActiveMeetingProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [target, setTarget] = useState<ActiveMeetingTarget | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const openMeeting = useCallback((next: ActiveMeetingTarget) => {
    setTarget(next);
    setIsMinimized(false);
  }, []);

  const leave = useCallback(() => {
    setTarget(null);
    setIsMinimized(false);
  }, []);

  const value = useMemo(
    () => ({ url: target?.url ?? null, isMinimized, openMeeting }),
    [target, isMinimized, openMeeting],
  );

  return (
    <ActiveMeetingContext.Provider value={value}>
      {children}
      {target && (
        <MeetingWindow
          // A new call gets a fresh window (and frame).
          key={target.url}
          target={target}
          isMinimized={isMinimized}
          onMinimize={() => setIsMinimized(true)}
          onRestore={() => setIsMinimized(false)}
          onLeave={leave}
        />
      )}
    </ActiveMeetingContext.Provider>
  );
};
