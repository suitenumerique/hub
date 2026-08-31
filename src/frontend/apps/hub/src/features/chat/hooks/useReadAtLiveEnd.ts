import { useCallback, useEffect, useRef } from "react";

import type { MarkChatReadResult } from "@/features/drivers/Driver";

const MARK_READ_DEBOUNCE_MS = 500;

type UseReadAtLiveEndOptions = {
  chatKey: string;
  enabled: boolean;
  messageId: string | null;
  markRead: (messageId: string) => Promise<MarkChatReadResult>;
};

/** Marks a visible event after it remains stable in a focused window. */
export const useReadAtLiveEnd = ({
  chatKey,
  enabled,
  messageId,
  markRead,
}: UseReadAtLiveEndOptions): ((
  messageId: string,
) => Promise<MarkChatReadResult>) => {
  const lastSubmittedRef = useRef<{
    markerKey: string;
    promise: Promise<MarkChatReadResult>;
  } | null>(null);

  useEffect(() => {
    lastSubmittedRef.current = null;
  }, [chatKey]);

  const submitRead = useCallback(
    (targetMessageId: string): Promise<MarkChatReadResult> => {
      const markerKey = `${chatKey}:${targetMessageId}`;
      if (lastSubmittedRef.current?.markerKey === markerKey) {
        return lastSubmittedRef.current.promise;
      }

      const promise = markRead(targetMessageId)
        .then((result) => {
          if (
            result.status === "unavailable" &&
            lastSubmittedRef.current?.markerKey === markerKey
          ) {
            lastSubmittedRef.current = null;
          }
          return result;
        })
        .catch((error: unknown) => {
          if (lastSubmittedRef.current?.markerKey === markerKey) {
            lastSubmittedRef.current = null;
          }
          throw error;
        });
      lastSubmittedRef.current = { markerKey, promise };
      return promise;
    },
    [chatKey, markRead],
  );

  useEffect(() => {
    if (!enabled || !messageId) {
      return;
    }

    let timer: number | null = null;
    const schedule = () => {
      if (!document.hasFocus()) {
        return;
      }
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        timer = null;
        if (document.hasFocus()) {
          void submitRead(messageId).catch(() => undefined);
        }
      }, MARK_READ_DEBOUNCE_MS);
    };

    schedule();
    window.addEventListener("focus", schedule);
    return () => {
      window.removeEventListener("focus", schedule);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [enabled, messageId, submitRead]);

  return submitRead;
};
