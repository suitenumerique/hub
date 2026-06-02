import { File, Meet, Thread, UserSearch } from "@gouvfr-lasuite/ui-kit/icons";
import { KeyboardEvent, RefObject, useEffect, useMemo, useState } from "react";
import { ComboBox, Input, Popover } from "react-aria-components";
import type { Key } from "react-aria-components";
import { useTranslation } from "react-i18next";

import type { ChatUser } from "@/features/drivers/types";
import { AccountSelector } from "@/features/layouts/components/AccountSelector/AccountSelector";

import { useChatUserSearch } from "../hooks/useChatUserSearch";

import { SelectedUserChip } from "./SelectedUserChip";
import type { ChatTool } from "./tools-panel/ChatToolsPanel";
import { UserSearchListBox } from "./UserSearchListBox";

export type NewChatSearchBarProps = {
  selectedUsers: ChatUser[];
  query: string;
  inputRef: RefObject<HTMLInputElement | null>;
  activeTool: ChatTool | null;
  canUseChatTools: boolean;
  onQueryChange: (query: string) => void;
  onAddUser: (user: ChatUser) => void;
  onRemoveUser: (userId: string) => void;
  onToggleTool?: (tool: ChatTool) => void;
};

export const NewChatSearchBar = ({
  selectedUsers,
  query,
  inputRef,
  activeTool,
  canUseChatTools,
  onQueryChange,
  onAddUser,
  onRemoveUser,
  onToggleTool,
}: NewChatSearchBarProps) => {
  const { t } = useTranslation();
  const [armedUserId, setArmedUserId] = useState<string | null>(null);
  const excludedUserIds = useMemo(
    () => selectedUsers.map((user) => user.id),
    [selectedUsers],
  );
  const { users, isInitialLoading } = useChatUserSearch(query, excludedUserIds);
  const armedUser = selectedUsers.find((user) => user.id === armedUserId);

  useEffect(() => {
    if (
      armedUserId !== null &&
      (query.length > 0 ||
        !selectedUsers.some((user) => user.id === armedUserId))
    ) {
      setArmedUserId(null);
    }
  }, [armedUserId, query, selectedUsers]);

  const handleSelectionChange = (key: Key | null) => {
    if (key === null) {
      return;
    }

    const user = users.find((candidate) => candidate.id === key.toString());
    if (user) {
      onAddUser(user);
    }
  };

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter") {
      const hasFocusedOption = Boolean(
        inputRef.current?.getAttribute("aria-activedescendant"),
      );
      if (!hasFocusedOption && query.trim().length > 0 && users.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        onAddUser(users[0]);
      }
      return;
    }

    if (event.key === "Backspace" && query.length === 0) {
      if (selectedUsers.length === 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (armedUserId === null) {
        setArmedUserId(selectedUsers[selectedUsers.length - 1].id);
      } else {
        onRemoveUser(armedUserId);
        setArmedUserId(null);
      }
    }
  };

  return (
    <header className="hub__new-chat-search" aria-label={t("New chat search")}>
      <ComboBox<ChatUser>
        className="hub__new-chat-search__field-shell"
        aria-label={t("Search users")}
        inputValue={query}
        items={users}
        allowsCustomValue
        allowsEmptyCollection
        menuTrigger="input"
        onInputChange={onQueryChange}
        onSelectionChange={handleSelectionChange}
      >
        <div
          className="hub__new-chat-search__field"
          onClick={() => inputRef.current?.focus()}
          onKeyDownCapture={handleKeyDownCapture}
        >
          <UserSearch size={24} aria-hidden="true" />
          <div className="hub__new-chat-search__selection">
            {selectedUsers.map((user) => (
              <SelectedUserChip
                key={user.id}
                user={user}
                armed={user.id === armedUserId}
                onRemove={() => onRemoveUser(user.id)}
              />
            ))}
            <Input
              ref={inputRef}
              className="hub__new-chat-search__input"
              aria-label={t("Search users")}
              placeholder={
                selectedUsers.length === 0 ? t("Search people") : undefined
              }
            />
          </div>
          <span
            className="hub__visually-hidden hub__new-chat-search__backspace-status"
            role="status"
          >
            {armedUser
              ? t("Press Backspace again to remove {{name}}", {
                  name: armedUser.name,
                })
              : ""}
          </span>
        </div>

        {query.trim().length > 0 && (
          <Popover
            className="hub__new-chat-dropdown"
            placement="bottom start"
            offset={0}
          >
            <UserSearchListBox isLoading={isInitialLoading} />
          </Popover>
        )}
      </ComboBox>

      <div className="hub__new-chat-search__actions">
        {canUseChatTools && onToggleTool && (
          <div className="hub__new-chat-search__tool-selector">
            <button
              type="button"
              className="hub__new-chat-search__icon-button"
              aria-label={t("Start a meeting")}
            >
              <Meet aria-hidden="true" />
              <span className="hub__visually-hidden">
                {t("Start a meeting")}
              </span>
            </button>
            <span
              className="hub__new-chat-search__separator"
              aria-hidden="true"
            />
            <button
              type="button"
              className="hub__new-chat-search__icon-button"
              aria-label={t("Threads")}
              aria-pressed={activeTool === "threads"}
              data-active={activeTool === "threads"}
              onClick={() => onToggleTool("threads")}
            >
              <Thread aria-hidden="true" />
              <span className="hub__visually-hidden">{t("Threads")}</span>
            </button>
            <button
              type="button"
              className="hub__new-chat-search__icon-button"
              aria-label={t("Files")}
              aria-pressed={activeTool === "files"}
              data-active={activeTool === "files"}
              onClick={() => onToggleTool("files")}
            >
              <File aria-hidden="true" />
              <span className="hub__visually-hidden">{t("Files")}</span>
            </button>
          </div>
        )}
        <AccountSelector />
      </div>
    </header>
  );
};
