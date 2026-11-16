import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";

import type { AccountId } from "@/features/drivers/types";

export type SettingsTab = "general" | "encryption";

type OpenOptions = {
  /** Account whose encryption the "Encryption" tab shows. */
  accountId?: AccountId;
  /** Gets the focus back on close; the account menu button otherwise. */
  trigger?: HTMLElement | null;
};

type Settings = {
  /** The tab shown, `null` while the settings are closed. */
  tab: SettingsTab | null;
  /** Account asked for by the last `open`, `null` for the default one. */
  accountId: AccountId | null;
  /** Wraps the account menu, whose button the ui-kit keeps to itself. */
  menuRef: RefObject<HTMLDivElement | null>;
  menuButton: () => HTMLButtonElement | null;
  open: (tab: SettingsTab, options?: OpenOptions) => void;
  selectTab: (tab: SettingsTab) => void;
  close: () => void;
};

const SettingsContext = createContext<Settings | null>(null);

export const SettingsProvider = ({ children }: PropsWithChildren) => {
  const [tab, setTab] = useState<SettingsTab | null>(null);
  const [accountId, setAccountId] = useState<AccountId | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOpen = useRef(false);

  const menuButton = useCallback(
    () => menuRef.current?.querySelector("button") ?? null,
    [],
  );

  // Stable: effects that open the settings depend on it.
  const open = useCallback(
    (next: SettingsTab, options: OpenOptions = {}) => {
      // Opening again from inside the settings keeps where the focus returns.
      if (!isOpen.current) {
        returnFocus.current = options.trigger ?? menuButton();
      }
      isOpen.current = true;
      setTab(next);
      if (options.accountId) setAccountId(options.accountId);
    },
    [menuButton],
  );

  const close = useCallback(() => {
    isOpen.current = false;
    setTab(null);
    setAccountId(null);
    requestAnimationFrame(() => {
      // A successful verification removes the prompt above the composer.
      const target = returnFocus.current?.isConnected
        ? returnFocus.current
        : menuButton();
      target?.focus();
    });
  }, [menuButton]);

  const value = useMemo(
    () => ({
      tab,
      accountId,
      menuRef,
      menuButton,
      open,
      selectTab: setTab,
      close,
    }),
    [tab, accountId, menuButton, open, close],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("Settings require SettingsProvider");
  }
  return context;
};
