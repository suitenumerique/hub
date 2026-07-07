import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { chatHref } from "@/features/chat/chatRefs";
import type { ChatRef, ChatUser } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { useComposerAccountId } from "../hooks/useChatAccounts";
import { useChatCreationSupport } from "../hooks/useChatCreationSupport";
import { useChatForUsers } from "../hooks/useChatForUsers";
import { useCreateChatForUsers } from "../hooks/useCreateChatForUsers";

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
  const { t } = useTranslation();
  const composerAccountId = useComposerAccountId();
  const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
  const [query, setQuery] = useState("");
  const [createdChatRef, setCreatedChatRef] = useState<ChatRef | null>(null);
  // Bumped on Enter (empty search) to move focus into the composer.
  const [composerFocusSignal, setComposerFocusSignal] = useState(0);
  const isCreatingRef = useRef(false);
  const creationTargetRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedUserIds = useMemo(
    () => selectedUsers.map((user) => user.id),
    [selectedUsers],
  );
  // Only resolve from the search while on the new-chat route.
  const { chat } = useChatForUsers(isNew ? selectedUserIds : []);
  const isCreationSupported = useChatCreationSupport(composerAccountId);
  const { createChatForUsers, isCreating } =
    useCreateChatForUsers(composerAccountId);

  // The host stays mounted across routes, so wipe the search state whenever we
  // (re-)enter new mode to start a fresh `/chat/new` instead of an old draft.
  useEffect(() => {
    if (isNew) {
      setSelectedUsers([]);
      setQuery("");
      setCreatedChatRef(null);
      isCreatingRef.current = false;
      creationTargetRef.current = null;
    }
  }, [isNew]);

  useEffect(() => {
    setCreatedChatRef(null);
    isCreatingRef.current = false;
    creationTargetRef.current = null;
  }, [composerAccountId]);

  const resolvedChatRef = isNew ? (chat?.ref ?? createdChatRef) : urlChatRef;
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
    setCreatedChatRef(null);
    creationTargetRef.current = null;
    isCreatingRef.current = false;
    setQuery("");
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const removeUser = useCallback((userId: string) => {
    setSelectedUsers((current) => current.filter((user) => user.id !== userId));
    setCreatedChatRef(null);
    creationTargetRef.current = null;
    isCreatingRef.current = false;
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  // Enter on an empty search confirms the selection: move focus into the
  // composer when the conversation exists, or create it first when it does not.
  const confirmSelection = useCallback(() => {
    if (selectedUserIds.length === 0) {
      return;
    }
    if (chat || createdChatRef) {
      setComposerFocusSignal((signal) => signal + 1);
      return;
    }
    if (!isCreationSupported || isCreating || isCreatingRef.current) {
      return;
    }

    const participantIds = selectedUserIds;
    const creationTarget = JSON.stringify([
      composerAccountId,
      [...participantIds].sort(),
    ]);
    isCreatingRef.current = true;
    creationTargetRef.current = creationTarget;
    void createChatForUsers(participantIds)
      .then((ref) => {
        if (creationTargetRef.current !== creationTarget) {
          return;
        }
        setCreatedChatRef(ref);
        setComposerFocusSignal((signal) => signal + 1);
      })
      .catch(() => {
        if (creationTargetRef.current !== creationTarget) {
          return;
        }
        notify.error(
          t("The conversation could not be created. Please try again."),
        );
        requestAnimationFrame(() => searchInputRef.current?.focus());
      })
      .finally(() => {
        if (creationTargetRef.current === creationTarget) {
          isCreatingRef.current = false;
          creationTargetRef.current = null;
        }
      });
  }, [
    chat,
    composerAccountId,
    createChatForUsers,
    createdChatRef,
    isCreating,
    isCreationSupported,
    selectedUserIds,
    t,
  ]);

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
        canUseChatTools={Boolean((chat || createdChatRef) && onToggleTool)}
        onQueryChange={setQuery}
        onAddUser={addUser}
        onRemoveUser={removeUser}
        onConfirm={confirmSelection}
        onToggleTool={onToggleTool}
      />
    ),
    [
      addUser,
      chat,
      confirmSelection,
      createdChatRef,
      query,
      removeUser,
      selectedUsers,
    ],
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
      composerFocusSignal={composerFocusSignal}
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
