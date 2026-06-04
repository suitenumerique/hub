import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { chatHref } from "@/features/chat/chatRefs";
import type { ChatRef, ChatUser } from "@/features/drivers/types";

import { useChatForUsers } from "../hooks/useChatForUsers";

import { ChatView } from "./ChatView";
import { NewChatPlaceholder } from "./NewChatPlaceholder";
import { NewChatSearchBar } from "./NewChatSearchBar";
import type { ChatTool } from "./tools-panel/ChatToolsPanel";

type ChatSurfaceProps = {
  /** Whether we are on `/chat/new` (people search) or an existing `/chat?…`. */
  isNew: boolean;
  /** Conversation addressed by the URL, when on an existing `/chat?…` route. */
  urlChatRef: ChatRef | null;
};

/**
 * Single chat surface host for both `/chat/new` and `/chat?…`. Rendering one
 * component type for both routes keeps `<ChatView>` (and its virtualized list)
 * mounted across the transition, so sending the first message to an existing
 * conversation from the new-chat search can commit the URL with no remount or
 * flicker. In new mode it drives the people search and resolves the matching
 * conversation; otherwise it is a transparent pass-through to the URL chat.
 */
export const ChatSurface = ({ isNew, urlChatRef }: ChatSurfaceProps) => {
  const router = useRouter();
  const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedUserIds = useMemo(
    () => selectedUsers.map((user) => user.id),
    [selectedUsers],
  );
  // Only resolve from the search while on the new-chat route.
  const { chat } = useChatForUsers(isNew ? selectedUserIds : []);

  // The host stays mounted across routes, so wipe the search state whenever we
  // (re-)enter new mode to start a fresh `/chat/new` instead of an old draft.
  useEffect(() => {
    if (isNew) {
      setSelectedUsers([]);
      setQuery("");
    }
  }, [isNew]);

  const resolvedChatRef = isNew ? (chat?.ref ?? null) : urlChatRef;
  // Defensive fallback: should the router momentarily report the new pathname
  // before its query is populated, keep showing the last conversation so the
  // body never blanks for a frame during the redirect.
  const lastChatRef = useRef<ChatRef | null>(resolvedChatRef);
  if (resolvedChatRef) {
    lastChatRef.current = resolvedChatRef;
  }
  const chatRef = resolvedChatRef ?? (isNew ? null : lastChatRef.current);

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

  // Sending to a resolved existing conversation from the search commits the URL
  // to it. `ChatRoute` renders this same host for `/chat?…`, so the navigation
  // re-renders in place (same `ChatView` + list) instead of remounting.
  const handleSent = useCallback(
    (ref: ChatRef) => {
      void router.replace(chatHref(ref));
    },
    [router],
  );

  return (
    <ChatView
      chatRef={chatRef}
      onSent={isNew ? handleSent : undefined}
      renderHeader={
        isNew
          ? ({ activeTool, onToggleTool }) =>
              searchBar({ activeTool, onToggleTool })
          : undefined
      }
      renderEmpty={
        isNew
          ? () => (
              <div className="hub__new-chat-empty">
                <NewChatPlaceholder />
              </div>
            )
          : undefined
      }
    />
  );
};
