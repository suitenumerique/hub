import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

type TimelineUnreadSeparatorProps = {
  inline?: false;
  eventId: string;
  rowIndex: number;
};

type InlineUnreadSeparatorProps = {
  inline: true;
  eventId?: never;
  rowIndex?: never;
};

type UnreadSeparatorProps =
  | TimelineUnreadSeparatorProps
  | InlineUnreadSeparatorProps;

const SeparatorContent = ({ label }: { label: string }) => (
  <>
    <span className="hub__unread-separator__line" aria-hidden="true" />
    <span className="hub__unread-separator__label">{label}</span>
    <span className="hub__unread-separator__line" aria-hidden="true" />
  </>
);

/** Main timeline row, with an inline variant for the non-virtualized thread. */
export const UnreadSeparator = forwardRef<HTMLDivElement, UnreadSeparatorProps>(
  function UnreadSeparator(props, ref) {
    const { t } = useTranslation();
    const label = t("Unread");

    if (props.inline) {
      return (
        <div
          ref={ref}
          className="hub__unread-separator"
          role="separator"
          aria-label={label}
          tabIndex={-1}
          data-unread-separator
        >
          <SeparatorContent label={label} />
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="hub__chat-conversation__row"
        role="separator"
        aria-label={label}
        tabIndex={-1}
        data-chat-timeline-row
        data-chat-row-index={props.rowIndex}
        data-unread-separator
        data-read-marker-event-id={props.eventId}
      >
        <div className="hub__chat-conversation__row-inner">
          <div className="hub__unread-separator">
            <SeparatorContent label={label} />
          </div>
        </div>
      </div>
    );
  },
);
