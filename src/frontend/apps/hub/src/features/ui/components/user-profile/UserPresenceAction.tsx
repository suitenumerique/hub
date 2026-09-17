import {
  DropdownMenu,
  type DropdownMenuOption,
  UserMenuItem,
} from "@gouvfr-lasuite/ui-components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useChatSelfPresencePreference } from "@/features/chat/hooks/useChatSelfPresencePreference";
import { useChatUserPresence } from "@/features/chat/hooks/useChatUserPresence";
import { useSetSelfPresencePreference } from "@/features/chat/hooks/useSetSelfPresencePreference";
import { useDriverEntries } from "@/features/drivers/DriverRegistry";
import type {
  AccountId,
  ChatSelfPresencePreference,
} from "@/features/drivers/types";
import { UserPresenceIndicator } from "@/features/ui/components/presence/UserPresenceIndicator";

const PRESENCE_OPTIONS: ReadonlyArray<{
  state: ChatSelfPresencePreference;
  label: string;
}> = [
  { state: "online", label: "Online" },
  { state: "offline", label: "Offline" },
];

const isPresencePreference = (
  value: string,
): value is ChatSelfPresencePreference =>
  PRESENCE_OPTIONS.some(({ state }) => state === value);

const usePresencePreferenceControl = (accountId: AccountId) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const preference = useChatSelfPresencePreference(accountId);
  const { setSelfPresencePreference, isPending } =
    useSetSelfPresencePreference(accountId);
  const options: DropdownMenuOption[] = PRESENCE_OPTIONS.map(
    ({ state, label }) => ({
      label: t(label),
      value: state,
      isChecked: preference === state,
      isDisabled: isPending,
    }),
  );
  const onSelectValue = (value: string) => {
    if (isPresencePreference(value) && !isPending) {
      setSelfPresencePreference(value);
    }
  };

  return {
    isOpen,
    setIsOpen,
    preference,
    options,
    onSelectValue,
    isPending,
  };
};

export const UserPresenceAction = ({
  accountId,
  accountLabel,
  showAccountLabel,
}: {
  accountId: AccountId;
  accountLabel: string;
  showAccountLabel: boolean;
}) => {
  const { t } = useTranslation();
  const control = usePresencePreferenceControl(accountId);
  const label = showAccountLabel
    ? t("Availability — {{account}}", { account: accountLabel })
    : t("Availability");

  return (
    <DropdownMenu
      options={control.options}
      isOpen={control.isOpen}
      onOpenChange={control.setIsOpen}
      selectedValues={control.preference ? [control.preference] : []}
      onSelectValue={control.onSelectValue}
    >
      <UserMenuItem
        label={control.isPending ? t("Updating availability…") : label}
        icon={<UserPresenceIndicator state={control.preference} decorative />}
        onClick={() => {
          if (!control.isPending) {
            control.setIsOpen((current) => !current);
          }
        }}
      />
    </DropdownMenu>
  );
};

/** Large click target over the profile avatar; its dot is the effective state. */
export const UserPresenceQuickControl = ({
  accountId,
  userId,
}: {
  accountId: AccountId;
  userId: string;
}) => {
  const { t } = useTranslation();
  const control = usePresencePreferenceControl(accountId);
  const presence = useChatUserPresence(accountId, userId);
  const label = t("Availability");

  return (
    <DropdownMenu
      options={control.options}
      isOpen={control.isOpen}
      onOpenChange={control.setIsOpen}
      selectedValues={control.preference ? [control.preference] : []}
      onSelectValue={control.onSelectValue}
    >
      <button
        type="button"
        className="hub__user-profile__presence-control"
        aria-label={label}
        title={label}
        disabled={control.isPending}
        onClick={() => control.setIsOpen((current) => !current)}
      >
        <UserPresenceIndicator state={presence?.state ?? null} decorative />
      </button>
    </DropdownMenu>
  );
};

/** One correctly scoped action for every connected presence-capable account. */
export const UserPresenceActions = () => {
  const entries = useDriverEntries();
  const accounts = entries.flatMap((entry) => {
    if (!entry.driver.supportsPresence) return [];
    const userId = entry.driver.getCurrentUserId();
    return userId ? [{ ...entry, userId }] : [];
  });

  return accounts.map((account) => (
    <UserPresenceAction
      key={account.accountId}
      accountId={account.accountId}
      accountLabel={account.label}
      showAccountLabel={accounts.length > 1}
    />
  ));
};
