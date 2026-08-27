import { useCallback, useEffect, useState } from "react";

import type { ChatRef } from "@/features/drivers/types";

type UseComposerFocusSignalOptions = {
  isNew: boolean;
  urlChatRef: ChatRef | null;
};

/** Coordinates imperative composer focus without exposing its input ref. */
export const useComposerFocusSignal = ({
  isNew,
  urlChatRef,
}: UseComposerFocusSignalOptions) => {
  const [composerFocusSignal, setComposerFocusSignal] = useState(0);
  const accountId = urlChatRef?.accountId ?? null;
  const chatId = urlChatRef?.chatId ?? null;

  const focusComposer = useCallback(() => {
    setComposerFocusSignal((signal) => signal + 1);
  }, []);

  useEffect(() => {
    if (isNew) {
      setComposerFocusSignal(0);
      return;
    }
    if (accountId && chatId) {
      focusComposer();
    }
  }, [accountId, chatId, focusComposer, isNew]);

  return { composerFocusSignal, focusComposer };
};
