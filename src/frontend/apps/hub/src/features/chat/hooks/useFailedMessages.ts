import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type { ChatMessage, ChatRef } from "@/features/drivers/types";

import {
  getFailedMessages,
  removeFailedMessage,
  subscribeToFailedMessages,
  withFailedMessages,
} from "../composer/failedMessagesStore";

/**
 * The loaded messages of a conversation or thread, then what could not be sent.
 * A message thought lost can have reached the server just before the tab closed:
 * once it shows among the loaded ones, it is no longer listed as failed.
 */
export const useMessagesWithFailed = (
  ref: ChatRef,
  threadId: string | undefined,
  messages: ChatMessage[],
  { isEnabled = true }: { isEnabled?: boolean } = {},
): ChatMessage[] => {
  // Who owns the list is only known once the account is registered.
  useDriverEntries();
  const getSnapshot = useCallback(
    () => getFailedMessages(ref, threadId),
    [ref, threadId],
  );
  const failed = useSyncExternalStore(
    subscribeToFailedMessages,
    getSnapshot,
    getSnapshot,
  );
  const delivered = useMemo(
    () => new Set(messages.map(({ transactionId }) => transactionId)),
    [messages],
  );
  const stillFailed = useMemo(
    () => failed.filter(({ transactionId }) => !delivered.has(transactionId)),
    [delivered, failed],
  );
  useEffect(() => {
    failed
      .filter(({ transactionId }) => delivered.has(transactionId))
      .forEach(({ id }) => removeFailedMessage(ref, threadId, id));
  }, [delivered, failed, ref, threadId]);

  return useMemo(
    () => (isEnabled ? withFailedMessages(messages, stillFailed) : messages),
    [isEnabled, messages, stillFailed],
  );
};
