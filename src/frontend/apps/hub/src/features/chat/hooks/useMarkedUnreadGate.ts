import { useCallback, useEffect, useMemo, useRef } from "react";

import type { ChatRef, ChatUnread } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";
import { useCachedQueryData } from "./useCachedQueryData";
import { useClearChatMarkedUnread } from "./useClearChatMarkedUnread";

export type MarkedUnreadGate = {
  isMarkedUnread: boolean;
  /** Whether reading the timeline may clear the flag now. */
  canClear: () => boolean;
  /** Called on a user interaction with the timeline, such as a scroll. */
  allowClear: () => void;
  /** Clears the flag after a read, unless it was marked unread meanwhile. */
  clearIfAllowed: () => void;
};

/**
 * When reading the open conversation clears its "marked unread" flag. Opened
 * marked unread, it is read like unread messages. Marked while open, it stays
 * unread until the user interacts with its timeline.
 */
export const useMarkedUnreadGate = (ref: ChatRef): MarkedUnreadGate => {
  // Read without fetching: the conversation list owns this query.
  const accountUnread = useCachedQueryData<Record<string, ChatUnread>>(
    chatKeys.unreadOf(ref.accountId),
  );
  const isMarkedUnread = accountUnread?.[ref.chatId]?.markedUnread ?? false;
  const clear = useClearChatMarkedUnread(ref);
  const canClearRef = useRef(true);
  // `null` until the read state is loaded: the first known flag is the one
  // the conversation was opened with.
  const wasMarkedUnreadRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (accountUnread === undefined) {
      return;
    }
    if (isMarkedUnread && wasMarkedUnreadRef.current === false) {
      canClearRef.current = false;
    }
    wasMarkedUnreadRef.current = isMarkedUnread;
  }, [accountUnread, isMarkedUnread]);

  const canClear = useCallback(() => canClearRef.current, []);
  const allowClear = useCallback(() => {
    canClearRef.current = true;
  }, []);
  const clearIfAllowed = useCallback(() => {
    if (canClearRef.current) {
      clear();
    }
  }, [clear]);

  return useMemo(
    () => ({ isMarkedUnread, canClear, allowClear, clearIfAllowed }),
    [allowClear, canClear, clearIfAllowed, isMarkedUnread],
  );
};
