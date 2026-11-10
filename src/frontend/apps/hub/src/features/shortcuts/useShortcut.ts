import { useEffect, useRef } from "react";

import {
  isModalOpen,
  matchesShortcut,
  type ShortcutName,
} from "./keyboardShortcuts";

type UseShortcutOptions = {
  enabled?: boolean;
  /**
   * Listen before the page's own handlers, as the search does to win over
   * editors and comboboxes. Otherwise a key one of them already handled
   * (`defaultPrevented`) is left alone.
   */
  capture?: boolean;
  /** Also while a modal dialog is open. */
  overModals?: boolean;
};

/**
 * Runs `handler` when the shortcut is pressed anywhere in the page. Returning
 * `false` leaves the key to the browser.
 */
export const useShortcut = (
  name: ShortcutName,
  handler: (event: KeyboardEvent) => boolean | void,
  {
    enabled = true,
    capture = false,
    overModals = false,
  }: UseShortcutOptions = {},
) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        (!capture && event.defaultPrevented) ||
        !matchesShortcut(event, name) ||
        (!overModals && isModalOpen())
      ) {
        return;
      }
      if (handlerRef.current(event) === false) {
        return;
      }
      event.preventDefault();
      if (capture) {
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, capture);
    return () => window.removeEventListener("keydown", onKeyDown, capture);
  }, [capture, enabled, name, overModals]);
};
