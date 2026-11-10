import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import {
  isMac,
  type KeyCombo,
  SHORTCUTS,
  type ShortcutName,
} from "./keyboardShortcuts";

const keyLabel = (key: string, t: TFunction): string => {
  switch (key) {
    case "ArrowUp":
      return "↑";
    case "ArrowDown":
      return "↓";
    case "Enter":
      return t("Enter", { description: "Name of the keyboard key" });
    case "Escape":
      return t("Esc", { description: "Name of the keyboard key" });
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
};

/** The keys of a shortcut as they read on this system: ⌘ ⇧ U, or Ctrl Shift U. */
export const useShortcutKeys = (name: ShortcutName): string[] => {
  const { t } = useTranslation();
  const combo: KeyCombo = SHORTCUTS[name];
  const mac = isMac();
  const keys: string[] = [];
  if (combo.mod) {
    keys.push(
      mac ? "⌘" : t("Ctrl", { description: "Name of the keyboard key" }),
    );
  }
  if (combo.alt) {
    keys.push(
      mac ? "⌥" : t("Alt", { description: "Name of the keyboard key" }),
    );
  }
  if (combo.shift) {
    keys.push(
      mac ? "⇧" : t("Shift", { description: "Name of the keyboard key" }),
    );
  }
  keys.push(keyLabel(combo.key, t));
  return keys;
};

export const ShortcutKeys = ({ name }: { name: ShortcutName }) => {
  const keys = useShortcutKeys(name);
  return (
    <kbd className="hub__shortcut-keys">
      {keys.map((key) => (
        <kbd key={key} className="hub__shortcut-keys__key">
          {key}
        </kbd>
      ))}
    </kbd>
  );
};
