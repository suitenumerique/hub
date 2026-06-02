import { Plus, Shapes } from "@gouvfr-lasuite/ui-kit/icons";
import clsx from "clsx";
import { ListBox, ListBoxItem } from "react-aria-components";
import { useTranslation } from "react-i18next";

import type { ChatUser } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";

type UserSearchListBoxProps = {
  isLoading: boolean;
};

export const UserSearchListBox = ({ isLoading }: UserSearchListBoxProps) => {
  const { t } = useTranslation();

  return (
    <>
      <ListBox<ChatUser>
        className="hub__new-chat-dropdown__list"
        renderEmptyState={() => (
          <div className="hub__new-chat-dropdown__state" role="status">
            {isLoading ? t("Searching people…") : t("No people found")}
          </div>
        )}
      >
        {(user) => (
          <ListBoxItem
            id={user.id}
            textValue={`${user.name} ${user.subtitle}`}
            className={({ isFocused }) =>
              clsx(
                "hub__new-chat-dropdown__user",
                isFocused && "hub__new-chat-dropdown__user--focused",
              )
            }
          >
            <Avatar label={user.name} color={user.color} size="sm" decorative>
              {user.initials}
            </Avatar>
            <span className="hub__new-chat-dropdown__user-body">
              <span className="hub__new-chat-dropdown__user-name">
                {user.name}
              </span>
              <span className="hub__new-chat-dropdown__user-subtitle">
                {user.subtitle}
              </span>
            </span>
            <span
              className="hub__new-chat-dropdown__user-action"
              aria-hidden="true"
            >
              {t("Add")}
              <Plus size={16} />
            </span>
          </ListBoxItem>
        )}
      </ListBox>
      <div className="hub__new-chat-dropdown__separator" />
      <button
        type="button"
        className="hub__new-chat-dropdown__create-group"
        disabled
      >
        <Shapes size={24} aria-hidden="true" />
        <span>{t("Create group")}</span>
      </button>
    </>
  );
};
