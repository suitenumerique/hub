import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

/** Whether the page shows: not for a tab in the background. */
export const usePageVisible = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => document.visibilityState === "visible",
    () => true,
  );
