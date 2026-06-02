import { useCallback, useMemo, useRef, useState } from "react";

import type { ChatUser } from "@/features/drivers/types";

import { useChatForUsers } from "../hooks/useChatForUsers";

import { ChatView } from "./ChatView";
import { NewChatPlaceholder } from "./NewChatPlaceholder";
import { NewChatSearchBar } from "./NewChatSearchBar";
import type { ChatTool } from "./tools-panel/ChatToolsPanel";

export const NewChatView = () => {
  const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedUserIds = useMemo(
    () => selectedUsers.map((user) => user.id),
    [selectedUsers],
  );
  const { chat } = useChatForUsers(selectedUserIds);

  const addUser = useCallback((user: ChatUser) => {
    setSelectedUsers((current) => {
      if (current.some((selected) => selected.id === user.id)) {
        return current;
      }
      return [...current, user];
    });
    setQuery("");
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const removeUser = useCallback((userId: string) => {
    setSelectedUsers((current) => current.filter((user) => user.id !== userId));
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const searchBar = useCallback(
    ({
      activeTool = null,
      onToggleTool,
    }: {
      activeTool?: ChatTool | null;
      onToggleTool?: (tool: ChatTool) => void;
    } = {}) => (
      <NewChatSearchBar
        selectedUsers={selectedUsers}
        query={query}
        inputRef={searchInputRef}
        activeTool={activeTool}
        canUseChatTools={Boolean(chat && onToggleTool)}
        onQueryChange={setQuery}
        onAddUser={addUser}
        onRemoveUser={removeUser}
        onToggleTool={onToggleTool}
      />
    ),
    [addUser, chat, query, removeUser, selectedUsers],
  );

  return (
    <ChatView
      chatId={chat?.id ?? null}
      renderHeader={({ activeTool, onToggleTool }) =>
        searchBar({ activeTool, onToggleTool })
      }
      renderEmpty={() => (
        <div className="hub__new-chat-empty">
          <NewChatPlaceholder />
        </div>
      )}
    />
  );
};
