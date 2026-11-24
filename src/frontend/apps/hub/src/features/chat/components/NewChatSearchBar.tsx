import { Thread, UserSearch } from "@gouvfr-lasuite/ui-components/icons";
import {
  type ContextType,
  KeyboardEvent,
  type MutableRefObject,
  RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ComboBox,
  ComboBoxStateContext,
  Input,
  Popover,
} from "react-aria-components";
import type { Key } from "react-aria-components";
import { useTranslation } from "react-i18next";

import type { ChatUser } from "@/features/drivers/types";
import { CreateGroupModal } from "@/features/groups/components/CreateGroupModal";

import { useComposerAccountId } from "../hooks/useChatAccounts";
import { useChatUserSearch } from "../hooks/useChatUserSearch";

import { SelectedUserChip } from "./SelectedUserChip";
import type { ChatTool } from "./tools-panel/ChatToolsPanel";
import { CREATE_GROUP_KEY, UserSearchListBox } from "./UserSearchListBox";

export type NewChatSearchBarProps = {
  selectedUsers: ChatUser[];
  query: string;
  inputRef: RefObject<HTMLInputElement | null>;
  activeTool: ChatTool | null;
  canUseChatTools: boolean;
  onQueryChange: (query: string) => void;
  onAddUser: (user: ChatUser) => void;
  onRemoveUser: (userId: string) => void;
  /** Called on Enter with an empty search and at least one selected participant. */
  onConfirm?: () => void;
  onToggleTool?: (tool: ChatTool) => void;
  /** After a group was created from the selected people. */
  onGroupCreated?: () => void;
};

/** A group gathers the current user and at least two other people. */
const MIN_GROUP_INVITEES = 2;

type ComboBoxStateValue = ContextType<typeof ComboBoxStateContext>;

/**
 * Hands the ComboBox state to the search bar, which renders the ComboBox (its
 * Popover hides the state from the menu content, too).
 */
const ComboBoxStateBridge = ({
  stateRef,
}: {
  stateRef: MutableRefObject<ComboBoxStateValue>;
}) => {
  const state = useContext(ComboBoxStateContext);
  useEffect(() => {
    stateRef.current = state;
  }, [state, stateRef]);
  return null;
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
  onConfirm,
  onToggleTool,
  onGroupCreated,
}: NewChatSearchBarProps) => {
  const { t } = useTranslation();
  const accountId = useComposerAccountId();
  const [armedUserId, setArmedUserId] = useState<string | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const comboBoxStateRef = useRef<ComboBoxStateValue>(null);
  const canCreateGroup = selectedUsers.length >= MIN_GROUP_INVITEES;
  // Once someone is chosen the menu stays open: ready for the next search
  // result, or to create a group.
  const showsMenu = query.trim().length > 0 || selectedUsers.length > 0;
  const selectedCount = selectedUsers.length;
  const previousSelectedCountRef = useRef(selectedCount);
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

  // Choosing someone closes the ComboBox: open it again on what follows.
  // Runs after the ComboBox's own effects, which close it on a selection.
  useEffect(() => {
    const hasAdded = selectedCount > previousSelectedCountRef.current;
    previousSelectedCountRef.current = selectedCount;
    if (hasAdded) {
      comboBoxStateRef.current?.open(null, "manual");
    }
  }, [selectedCount]);

  const openCreateGroup = () => {
    // An open ComboBox hides the rest of the page from assistive technologies,
    // even with its menu gone: the modal must not open under it.
    comboBoxStateRef.current?.close();
    setIsCreateGroupOpen(true);
  };

  // The modal gives the focus back to the field while it unmounts, unseen by
  // React Aria: tell the ComboBox, or typing would not open its menu again.
  const returnToSearch = () => {
    requestAnimationFrame(() => {
      comboBoxStateRef.current?.setFocused(true);
      inputRef.current?.focus();
    });
  };

  const handleSelectionChange = (key: Key | null) => {
    if (key === null) {
      return;
    }
    if (key === CREATE_GROUP_KEY) {
      // An action, normally run by its `onAction`: never a selection.
      openCreateGroup();
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
      if (hasFocusedOption) {
        // A dropdown option is highlighted — let the ComboBox select it.
        return;
      }
      if (query.trim().length > 0) {
        if (users.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          onAddUser(users[0]);
        }
        return;
      }
      // Empty search with people chosen: confirm the selection so focus moves
      // into the composer (preview the conversation when it exists, or start
      // composing the first message of a new one).
      if (selectedUsers.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        // The people are chosen: the menu kept open for more closes.
        comboBoxStateRef.current?.close();
        onConfirm?.();
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
        <ComboBoxStateBridge stateRef={comboBoxStateRef} />
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

        {showsMenu && (
          <Popover
            className="hub__new-chat-dropdown"
            placement="bottom start"
            offset={0}
          >
            <UserSearchListBox
              users={users}
              isLoading={isInitialLoading}
              query={query}
              canCreateGroup={canCreateGroup}
              onCreateGroup={openCreateGroup}
            />
          </Popover>
        )}
      </ComboBox>

      <div className="hub__new-chat-search__actions">
        {canUseChatTools && onToggleTool && (
          <div className="hub__new-chat-search__tool-selector">
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
          </div>
        )}
      </div>

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        accountId={accountId}
        invitees={selectedUsers}
        onClose={() => {
          setIsCreateGroupOpen(false);
          returnToSearch();
        }}
        onCreated={() => {
          setIsCreateGroupOpen(false);
          onGroupCreated?.();
          returnToSearch();
        }}
      />
    </header>
  );
};
