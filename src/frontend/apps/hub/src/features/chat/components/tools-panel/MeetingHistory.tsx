import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ChatMeeting } from "@/features/drivers/types";

import { Download } from "./MeetingIcons";
import { formatMeetingLabel } from "./meetingLabels";
import { ToolsPanelHeader } from "./ToolsPanelHeader";

type MeetingHistoryProps = {
  /** Meetings that have ended, newest first. */
  meetings: ChatMeeting[];
  isInitialLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
};

/**
 * Past meetings and their documents. Selecting a meeting in the top list
 * swaps the block below to that meeting's documents; the first one is selected
 * by default, as in the mockup.
 */
export const MeetingHistory = ({
  meetings,
  isInitialLoading,
  isOpen,
  onClose,
  onBack,
}: MeetingHistoryProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected =
    meetings.find((meeting) => meeting.id === selectedId) ??
    meetings[0] ??
    null;

  // A meeting id belongs to one conversation — drop a selection that no longer
  // exists so the view falls back to the first available meeting.
  useEffect(() => {
    if (selectedId && !meetings.some((meeting) => meeting.id === selectedId)) {
      setSelectedId(null);
    }
  }, [meetings, selectedId]);

  const tabIndex = isOpen ? 0 : -1;

  /**
   * "Download everything" of the mockup, for one meeting or for all of them.
   * There is no server-side archive endpoint yet, so the panel serialises what
   * it already holds into the JSON manifest the archive step expects: one
   * entry per meeting with its call URL and the links to its documents.
   */
  const downloadManifest = (archived: ChatMeeting[], filename: string) => {
    const manifest = archived.map((meeting) => ({
      id: meeting.id,
      startedAt: meeting.startedAt,
      organizerId: meeting.organizerId,
      url: meeting.url,
      summary: meeting.summary ?? null,
      documents: meeting.documents,
    }));
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = href;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(href);
  };

  const documents = selected
    ? [...(selected.summary ? [selected.summary] : []), ...selected.documents]
    : [];

  return (
    <>
      <ToolsPanelHeader
        title={t("History")}
        isOpen={isOpen}
        onClose={onClose}
        onBack={onBack}
        backLabel={t("Back to meetings")}
        action={
          <button
            type="button"
            className="hub__chat-meetings__action"
            disabled={meetings.length === 0}
            tabIndex={tabIndex}
            onClick={() => downloadManifest(meetings, "meetings.json")}
          >
            {t("Download")}
          </button>
        }
      />
      <div className="hub__chat-tools-panel__content">
        {isInitialLoading ? (
          <p className="hub__chat-tools-panel__empty" role="status">
            {t("Loading meetings…")}
          </p>
        ) : meetings.length === 0 ? (
          <p className="hub__chat-tools-panel__empty">{t("No past meeting")}</p>
        ) : (
          <>
            <section className="hub__chat-meetings__card">
              <ul className="hub__chat-meetings__list">
                {meetings.map((meeting) => {
                  const label = formatMeetingLabel(
                    meeting,
                    t("Meeting"),
                    locale,
                    { withTime: true },
                  );
                  return (
                    <li
                      key={meeting.id}
                      className="hub__chat-meetings__row"
                      data-active={
                        meeting.id === selected?.id ? "true" : undefined
                      }
                    >
                      <button
                        type="button"
                        className="hub__chat-meetings__row-button"
                        aria-pressed={meeting.id === selected?.id}
                        tabIndex={tabIndex}
                        onClick={() => setSelectedId(meeting.id)}
                      >
                        <span className="hub__chat-meetings__row-label">
                          {label}
                        </span>
                      </button>
                      <span className="hub__chat-meetings__row-actions">
                        <button
                          type="button"
                          className="hub__chat-meetings__icon-button"
                          aria-label={t("Download {{name}}", { name: label })}
                          tabIndex={tabIndex}
                          onClick={() =>
                            downloadManifest(
                              [meeting],
                              `meeting-${meeting.id}.json`,
                            )
                          }
                        >
                          <Download />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {selected && (
              <section className="hub__chat-meetings__card">
                <h3 className="hub__chat-meetings__card-title">
                  {formatMeetingLabel(selected, t("Meeting"), locale, {
                    withTime: true,
                  })}
                </h3>
                {documents.length === 0 ? (
                  <p className="hub__chat-tools-panel__empty">
                    {t("No document for this meeting")}
                  </p>
                ) : (
                  <ul className="hub__chat-meetings__list">
                    {documents.map((doc) => (
                      <li key={doc.id} className="hub__chat-meetings__row">
                        <span className="hub__chat-meetings__row-label">
                          {doc.title}
                        </span>
                        <span className="hub__chat-meetings__row-actions">
                          <a
                            className="hub__chat-meetings__icon-button"
                            href={doc.url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("Download {{name}}", {
                              name: doc.title,
                            })}
                            tabIndex={tabIndex}
                          >
                            <Download />
                          </a>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
};
