import clsx from "clsx";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type BubbleVariant = "sent" | "received";
type BubbleWidth = "sm" | "md" | "lg" | "xl";
// Number of placeholder text lines — drives the bubble's height.
type BubbleHeight = "h1" | "h2" | "h3";

type SkeletonRow = {
  variant: BubbleVariant;
  width: BubbleWidth;
  height: BubbleHeight;
};

type SkeletonState = "visible" | "leaving" | "hidden";

// Deterministic — alternates variants and varies widths/heights so the
// skeleton looks like a real conversation without shifting layout on
// re-render. Long enough to overflow tall viewports; surplus rows are clipped
// by the container's overflow-hidden, with the topmost rows sitting behind
// the floating chat header (same behaviour as a scrolled conversation).
const SKELETON_ROWS: SkeletonRow[] = [
  { variant: "received", width: "lg", height: "h2" },
  { variant: "received", width: "md", height: "h1" },
  { variant: "sent", width: "sm", height: "h1" },
  { variant: "received", width: "xl", height: "h3" },
  { variant: "sent", width: "md", height: "h1" },
  { variant: "received", width: "sm", height: "h1" },
  { variant: "sent", width: "lg", height: "h2" },
  { variant: "received", width: "md", height: "h1" },
  { variant: "received", width: "xl", height: "h3" },
  { variant: "sent", width: "lg", height: "h2" },
  { variant: "received", width: "sm", height: "h1" },
  { variant: "sent", width: "md", height: "h1" },
  { variant: "received", width: "lg", height: "h2" },
  { variant: "received", width: "sm", height: "h1" },
  { variant: "sent", width: "md", height: "h1" },
  { variant: "sent", width: "xl", height: "h3" },
  { variant: "received", width: "lg", height: "h2" },
  { variant: "received", width: "md", height: "h1" },
  { variant: "sent", width: "sm", height: "h1" },
  { variant: "received", width: "lg", height: "h2" },
  { variant: "sent", width: "xl", height: "h3" },
  { variant: "received", width: "md", height: "h1" },
  { variant: "sent", width: "lg", height: "h2" },
  { variant: "received", width: "sm", height: "h1" },
  { variant: "received", width: "md", height: "h1" },
  { variant: "sent", width: "md", height: "h2" },
  { variant: "received", width: "xl", height: "h3" },
  { variant: "received", width: "sm", height: "h1" },
  { variant: "sent", width: "lg", height: "h2" },
  { variant: "received", width: "md", height: "h1" },
];

/**
 * Loading state for the conversation list. Rendered as an absolute overlay
 * inside `.hub__chat-conversation__list` by `ChatVirtualList`, so the actual
 * Virtuoso list can mount and paint behind it without any "blank" frame
 * between the skeleton and the real bubbles — the skeleton then fades out once
 * Virtuoso has had a frame to lay out its items.
 */
export const ChatConversationSkeleton = ({
  isLoading,
}: {
  isLoading: boolean;
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<SkeletonState>(
    isLoading ? "visible" : "hidden",
  );

  useEffect(() => {
    if (isLoading) {
      setState("visible");
      return;
    }
    const raf = requestAnimationFrame(() => {
      setState((current) => (current === "visible" ? "leaving" : current));
    });
    return () => cancelAnimationFrame(raf);
  }, [isLoading]);

  if (state === "hidden") {
    return null;
  }
  const leaving = state === "leaving";

  return (
    <div
      className={clsx(
        "hub__chat-conversation__skeleton",
        leaving && "hub__chat-conversation__skeleton--leaving",
      )}
      role="status"
      aria-busy="true"
      aria-label={t("Loading messages…")}
      onTransitionEnd={(event) => {
        // `transitionend` bubbles, so we restrict the callback to the root
        // node's own opacity transition — guards against any child element
        // that might animate opacity (now or later).
        if (
          event.target === event.currentTarget &&
          event.propertyName === "opacity" &&
          leaving
        ) {
          setState("hidden");
        }
      }}
    >
      {SKELETON_ROWS.map((row, index) => (
        <div key={index} className="hub__chat-conversation__row">
          <div className="hub__chat-conversation__row-inner">
            <div
              className={clsx(
                "hub__chat-bubble-skeleton",
                `hub__chat-bubble-skeleton--${row.variant}`,
              )}
            >
              {row.variant === "received" && (
                <span
                  className="hub__chat-bubble-skeleton__avatar"
                  aria-hidden="true"
                />
              )}
              <span
                className={clsx(
                  "hub__chat-bubble-skeleton__body",
                  `hub__chat-bubble-skeleton__body--${row.width}`,
                  `hub__chat-bubble-skeleton__body--${row.height}`,
                )}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
