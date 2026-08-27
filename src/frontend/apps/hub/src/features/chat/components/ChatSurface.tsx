import { useRouter } from "next/router";
import { useCallback, useRef } from "react";

import { chatHref } from "@/features/chat/chatRefs";
import type { ChatRef } from "@/features/drivers/types";

import { useComposerFocusSignal } from "../hooks/useComposerFocusSignal";
import { useNewChatConversation } from "../hooks/useNewChatConversation";

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

/** Shared view host for `/chat/new` and an existing conversation route. */
export const ChatSurface = ({ isNew, urlChatRef }: ChatSurfaceProps) => {
  const router = useRouter();
  const handleSent = useCallback(
    (ref: ChatRef) => {
      void router.replace(chatHref(ref));
    },
    [router],
  );
  const { composerFocusSignal, focusComposer } = useComposerFocusSignal({
    isNew,
    urlChatRef,
  });
  const {
    selectedUsers,
    query,
    searchInputRef,
    setQuery,
    addUser,
    removeUser,
    confirmSelection,
    chatRef: newChatRef,
    canUseChatTools,
    canComposeDraft,
    submitDraft,
  } = useNewChatConversation({ isNew, focusComposer, onSent: handleSent });

  const resolvedChatRef = isNew ? newChatRef : urlChatRef;
  const lastChatRef = useRef<ChatRef | null>(resolvedChatRef);
  if (resolvedChatRef) {
    lastChatRef.current = resolvedChatRef;
  }
  const chatRef = resolvedChatRef ?? (isNew ? null : lastChatRef.current);

  const renderNewChatHeader = useCallback(
    ({
      activeTool,
      onToggleTool,
    }: {
      activeTool: ChatTool | null;
      onToggleTool: (tool: ChatTool) => void;
    }) => (
      <NewChatSearchBar
        selectedUsers={selectedUsers}
        query={query}
        inputRef={searchInputRef}
        activeTool={activeTool}
        canUseChatTools={canUseChatTools}
        onQueryChange={setQuery}
        onAddUser={addUser}
        onRemoveUser={removeUser}
        onConfirm={confirmSelection}
        onToggleTool={onToggleTool}
      />
    ),
    [
      addUser,
      canUseChatTools,
      confirmSelection,
      query,
      removeUser,
      searchInputRef,
      selectedUsers,
      setQuery,
    ],
  );

  const renderNewChatEmpty = useCallback(
    () =>
      selectedUsers.length === 0 ? (
        <div className="hub__new-chat-empty">
          <NewChatPlaceholder />
        </div>
      ) : null,
    [selectedUsers.length],
  );

  return (
    <ChatView
      chatRef={chatRef}
      onSent={isNew ? handleSent : undefined}
      composerFocusSignal={composerFocusSignal}
      canComposeDraft={canComposeDraft}
      onSubmitDraft={canComposeDraft ? submitDraft : undefined}
      renderHeader={isNew ? renderNewChatHeader : undefined}
      renderEmpty={isNew ? renderNewChatEmpty : undefined}
    />
  );
};
