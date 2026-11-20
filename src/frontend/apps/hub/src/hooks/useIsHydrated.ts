import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the pre-rendered HTML and during hydration, true afterwards.
 *
 * The pre-render runs without the `hub_language` cookie, so it is always in
 * English, while the browser's first render is already in the user's language.
 * Text rendered outside `<Auth>` must wait for this flag, otherwise React
 * reports a hydration mismatch for every non-English user.
 */
export const useIsHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
