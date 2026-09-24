import {
  createContext,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";

import type { AccountId } from "@/features/drivers/types";

type EncryptionSettings = {
  accountId: AccountId | null;
  menuTriggerRef: RefObject<HTMLButtonElement | null>;
  open: (accountId: AccountId, trigger?: HTMLElement | null) => void;
  close: () => void;
};

const EncryptionSettingsContext = createContext<EncryptionSettings | null>(
  null,
);

export const EncryptionSettingsProvider = ({ children }: PropsWithChildren) => {
  const [accountId, setAccountId] = useState<AccountId | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <EncryptionSettingsContext.Provider
      value={{
        accountId,
        menuTriggerRef,
        open: (id, trigger) => {
          returnFocus.current = trigger ?? menuTriggerRef.current;
          setAccountId(id);
        },
        close: () => {
          setAccountId(null);
          requestAnimationFrame(() => {
            // A successful verification removes the prompt above the composer.
            const target = returnFocus.current?.isConnected
              ? returnFocus.current
              : menuTriggerRef.current;
            target?.focus();
          });
        },
      }}
    >
      {children}
    </EncryptionSettingsContext.Provider>
  );
};

export const useEncryptionSettings = () => {
  const context = useContext(EncryptionSettingsContext);
  if (!context) {
    throw new Error("Encryption settings require EncryptionSettingsProvider");
  }
  return context;
};
