import { Plus, Shapes } from "@gouvfr-lasuite/ui-components/icons";
import clsx from "clsx";
import { Collection, ListBox, ListBoxItem } from "react-aria-components";
import { useTranslation } from "react-i18next";

import type { ChatUser } from "@/features/drivers/types";

import { useComposerAccountId } from "../hooks/useChatAccounts";
import { ChatUserAvatar } from "./ChatUserAvatar";

/** Key of the "Create group" option, after the people found. */
export const CREATE_GROUP_KEY = "hub:create-group";

type UserSearchListBoxProps = {
  users: ChatUser[];
  isLoading: boolean;
  /** Empty while the menu stays open after a selection, ready for the next. */
  query: string;
  canCreateGroup: boolean;
  onCreateGroup: () => void;
};

export const UserSearchListBox = ({
  users,
  isLoading,
  query,
  canCreateGroup,
  onCreateGroup,
}: UserSearchListBoxProps) => {
  const { t } = useTranslation();
  // The search runs on the composer's account: its results are that account's.
  const accountId = useComposerAccountId();
  const hasQuery = query.trim().length > 0;

  return (
    <>
      {hasQuery && users.length === 0 && (
        <div className="hub__new-chat-dropdown__state" role="status">
          {isLoading ? t("Searching people…") : t("No people found")}
        </div>
      )}
      <ListBox className="hub__new-chat-dropdown__list">
        <Collection items={users}>
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
              <ChatUserAvatar accountId={accountId} user={user} />
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
        </Collection>
        {/* An action, not a person: the arrows reach it after the results,
            and Enter or a click runs it. */}
        <ListBoxItem
          id={CREATE_GROUP_KEY}
          textValue={t("Create group")}
          isDisabled={!canCreateGroup}
          onAction={onCreateGroup}
          className={({ isFocused }) =>
            clsx(
              "hub__new-chat-dropdown__create-group",
              hasQuery && "hub__new-chat-dropdown__create-group--separated",
              isFocused && "hub__new-chat-dropdown__create-group--focused",
            )
          }
        >
          <Shapes size={24} aria-hidden="true" />
          <span>{t("Create group")}</span>
        </ListBoxItem>
      </ListBox>
    </>
  );
};
