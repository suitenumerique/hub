import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import type { MarkChatReadResult } from "@/features/drivers/Driver";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

export type MainTimelineReadActions = {
  advanceReadReceipt: (messageId?: string) => Promise<MarkChatReadResult>;
  advanceFullyRead: (messageId?: string) => Promise<MarkChatReadResult>;
  markAllRead: () => Promise<void>;
};

const mutationOptions = {
  retry: 3,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
  meta: { noGlobalError: true },
} as const;

const requireAvailableReadState = (
  result: MarkChatReadResult,
): MarkChatReadResult => {
  if (result.status === "unavailable") {
    throw new Error("The main timeline read state is unavailable");
  }
  return result;
};

/** Independent Matrix read-receipt and fully-read writes for one conversation. */
export const useMarkChatRead = (ref: ChatRef): MainTimelineReadActions => {
  const { mutateAsync: mutateReadReceipt } = useMutation<
    MarkChatReadResult,
    Error,
    string | undefined
  >({
    mutationFn: async (messageId) =>
      requireAvailableReadState(
        await getRegistry()
          .get(ref.accountId)
          .advanceMainReadReceipt({ chatId: ref.chatId, messageId }),
      ),
    ...mutationOptions,
  });
  const { mutateAsync: mutateFullyRead } = useMutation<
    MarkChatReadResult,
    Error,
    string | undefined
  >({
    mutationFn: async (messageId) =>
      requireAvailableReadState(
        await getRegistry()
          .get(ref.accountId)
          .advanceMainFullyRead({ chatId: ref.chatId, messageId }),
      ),
    ...mutationOptions,
  });

  const advanceReadReceipt = useCallback(
    (messageId?: string) => mutateReadReceipt(messageId),
    [mutateReadReceipt],
  );
  const advanceFullyRead = useCallback(
    (messageId?: string) => mutateFullyRead(messageId),
    [mutateFullyRead],
  );
  const markAllRead = useCallback(async () => {
    const results = await Promise.all([
      advanceReadReceipt(),
      advanceFullyRead(),
    ]);
    if (results.some(({ status }) => status === "unavailable")) {
      throw new Error("The main timeline read state is unavailable");
    }
  }, [advanceFullyRead, advanceReadReceipt]);

  return useMemo(
    () => ({ advanceReadReceipt, advanceFullyRead, markAllRead }),
    [advanceFullyRead, advanceReadReceipt, markAllRead],
  );
};
