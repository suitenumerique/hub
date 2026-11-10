import type { KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * A key and its modifiers. `mod` is ⌘ on macOS and Ctrl elsewhere, as in
 * Element's `ctrlOrCmdKey`. `key` is compared with `KeyboardEvent.key`.
 */
export type KeyCombo = {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
};

/**
 * Every keyboard shortcut of the Hub, with Element Web's default keys. The
 * shortcuts help (`KeyboardShortcutsModal`) lists them from here.
 */
export const SHORTCUTS = {
  // Navigation
  searchChats: { key: "k", mod: true },
  previousChat: { key: "ArrowUp", alt: true },
  nextChat: { key: "ArrowDown", alt: true },
  previousUnreadChat: { key: "ArrowUp", alt: true, shift: true },
  nextUnreadChat: { key: "ArrowDown", alt: true, shift: true },
  toggleToolsPanel: { key: ".", mod: true },
  showShortcuts: { key: "/", mod: true },
  // Chat
  attachFile: { key: "u", mod: true, shift: true },
  // Composer
  sendMessage: { key: "Enter" },
  newLine: { key: "Enter", shift: true },
  editPreviousMessage: { key: "ArrowUp" },
  editNextMessage: { key: "ArrowDown" },
  cancelEdit: { key: "Escape" },
  bold: { key: "b", mod: true },
  italic: { key: "i", mod: true },
  code: { key: "e", mod: true },
  quote: { key: ">", mod: true },
  link: { key: "l", mod: true, shift: true },
} as const satisfies Record<string, KeyCombo>;

export type ShortcutName = keyof typeof SHORTCUTS;

/** Read when called: the static export renders without `navigator`. */
export const isMac = (): boolean =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

/** A character other than a letter or a digit, such as "/" or ".". */
const isSymbol = (key: string) =>
  key.length === 1 && !/[\p{L}\p{N}]/u.test(key);

/**
 * True when `event` presses `combo`. A symbol is read as typed: Shift is
 * needed for "/" or "." on some layouts (AZERTY), so it is not compared.
 */
export const matchesCombo = (
  event: KeyboardEvent | ReactKeyboardEvent,
  combo: KeyCombo,
): boolean => {
  // Held down, a toggle such as Ctrl+. would flicker: only its first press
  // counts. Arrows keep repeating, to go through a list.
  if (event.repeat && combo.mod) {
    return false;
  }
  const mac = isMac();
  const mod = mac ? event.metaKey : event.ctrlKey;
  const otherMod = mac ? event.ctrlKey : event.metaKey;
  if (
    mod !== Boolean(combo.mod) ||
    otherMod ||
    event.altKey !== Boolean(combo.alt)
  ) {
    return false;
  }
  if (!isSymbol(combo.key) && event.shiftKey !== Boolean(combo.shift)) {
    return false;
  }
  return event.key.toLowerCase() === combo.key.toLowerCase();
};

export const matchesShortcut = (
  event: KeyboardEvent | ReactKeyboardEvent,
  name: ShortcutName,
): boolean => matchesCombo(event, SHORTCUTS[name]);

/** `aria-keyshortcuts` value of a shortcut, such as "Meta+K". */
export const ariaKeyShortcuts = (name: ShortcutName): string => {
  const combo: KeyCombo = SHORTCUTS[name];
  const keys = [
    combo.mod && (isMac() ? "Meta" : "Control"),
    combo.alt && "Alt",
    combo.shift && "Shift",
    combo.key.length === 1 ? combo.key.toUpperCase() : combo.key,
  ];
  return keys.filter(Boolean).join("+");
};

/**
 * True while a modal dialog holds the page: shortcuts acting on what is
 * behind it wait until it closes. Some stay in the page while hidden, such as
 * La Gaufre's.
 */
export const isModalOpen = (): boolean =>
  Array.from(
    document.querySelectorAll('[role="dialog"][aria-modal="true"]'),
  ).some((dialog) => dialog.getClientRects().length > 0);
