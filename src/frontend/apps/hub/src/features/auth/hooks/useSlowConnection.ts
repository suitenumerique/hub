import { useEffect, useState } from "react";

const SLOW_CONNECTION_DELAY_MS = 2 * 60 * 1000;

/** Whether the chat has been connecting for an unexpectedly long time. */
export const useSlowConnection = (isConnecting: boolean): boolean => {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!isConnecting) return;
    const timer = window.setTimeout(
      () => setIsSlow(true),
      SLOW_CONNECTION_DELAY_MS,
    );
    return () => {
      window.clearTimeout(timer);
      setIsSlow(false);
    };
  }, [isConnecting]);

  return isSlow;
};
