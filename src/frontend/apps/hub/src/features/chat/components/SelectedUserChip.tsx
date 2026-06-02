import { XMark } from "@gouvfr-lasuite/ui-kit/icons";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

import type { ChatUser } from "@/features/drivers/types";

type SelectedUserChipProps = {
  user: ChatUser;
  armed: boolean;
  onRemove: () => void;
};

export const SelectedUserChip = ({
  user,
  armed,
  onRemove,
}: SelectedUserChipProps) => {
  const { t } = useTranslation();

  return (
    <span
      className={clsx("hub__new-chat-search__chip", {
        "hub__new-chat-search__chip--armed": armed,
      })}
      data-armed={armed}
    >
      <span className="hub__new-chat-search__chip-label">{user.name}</span>
      <button
        type="button"
        className="hub__new-chat-search__chip-remove"
        onClick={onRemove}
        aria-label={t("Remove {{name}}", { name: user.name })}
      >
        <XMark size={16} aria-hidden="true" />
        <span className="hub__visually-hidden">
          {t("Remove {{name}}", { name: user.name })}
        </span>
      </button>
    </span>
  );
};
