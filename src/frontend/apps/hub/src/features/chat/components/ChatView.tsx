import { chatTypeOf, trackEvent } from "@/features/analytics/analytics";
import {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type {
  AccountId,
  Chat,
  ChatAttachment,
  ChatComposedMessage,
  ChatRef,
  ChatThreadDetail,
  ChatUser,
} from "@/features/drivers/types";

import {
  ChatAttachmentPreviewProvider,
  type ChatAttachmentPreviewContextValue,
  type PreviewedAttachment,
} from "../ChatAttachmentPreviewContext";
import { chatKeys } from "../chatKeys";
import { NEW_CHAT_DRAFT_ID } from "../composer/composerDraftStore";
import { isInvitationChat } from "../chatMembership";
import {
  ChatMessageEditProvider,
  type EditingChatMessage,
} from "../ChatMessageEditContext";
import type { ChatMessageJump } from "../ChatMessageJumpContext";
import {
  ChatPanelProvider,
  type DraftThreadRoot,
  type ChatPanelContextValue,
  type OpenThreadOptions,
  type ThreadInitialMessage,
} from "../ChatPanelContext";
import {
  type ChatMessagesData,
  rootOnlyThreadDetail,
} from "../hooks/chatCompositionCache";
import { useChat } from "../hooks/useChat";
import { useComposerAccountId } from "../hooks/useChatAccounts";
import { useUploadChatAttachment } from "../hooks/useChatAttachmentActions";
import {
  securitySendState,
  useChatSecurity,
  useChatSendState,
} from "../hooks/useChatSecurity";
import { useChatTyping } from "../hooks/useChatTyping";
import { useEditChatMessage } from "../hooks/useEditChatMessage";
import type { ComposerMentionSource } from "../hooks/useMentionCandidates";
import { useChatMessagesLoaded } from "../hooks/useChatMessages";
import { useIgnoreStrayFileDrops } from "../hooks/useIgnoreStrayFileDrops";
import { useChatThreadsKeyedByRoot } from "../hooks/useChatThreadCompositionSupport";
import { useChatUnreadThreads } from "../hooks/useChatUnreadThreads";
import { useSendChatMessage } from "../hooks/useSendChatMessage";

import { ChatAttachmentPreview } from "./ChatAttachmentPreview";
import { ChatComposer } from "./ChatComposer";
import { ChatEncryptionPrompt } from "./ChatEncryptionPrompt";
import { ChatConversation } from "./ChatConversation";
import { ChatInvitationView } from "./ChatInvitationView";
import { ChatHeader } from "./header/ChatHeader";
import { ChatToolsPanel, ChatTool } from "./tools-panel/ChatToolsPanel";
import { ToolsPanelResizeHandle } from "./tools-panel/ToolsPanelResizeHandle";
import { useToolsPanelFits } from "./tools-panel/useToolsPanelFits";
import { UnreadThreadsBanner } from "./UnreadThreadsBanner";
import { TypingIndicator } from "./TypingIndicator";

const FLOATING_STACK_SAFETY_GAP = 8;

type ChatViewProps = {
  chatRef: ChatRef | null;
  renderHeader?: (props: {
    chat: Chat | null;
    activeTool: ChatTool | null;
    onToggleTool: (tool: ChatTool) => void;
  }) => ReactNode;
  /** Rendered in the main area when there is no conversation yet. */
  renderEmpty?: () => ReactNode;
  /**
   * Called once a message is queued, without waiting for it to be sent. Lets
   * the new-chat host commit the URL to the resolved (or freshly created)
   * conversation once the user actually sends.
   */
  onSent?: (ref: ChatRef) => void;
  /** Bumped by the host to move focus into the composer. */
  composerFocusSignal?: number;
  /** Asks the host for that, as the jump to the latest messages does. */
  onFocusComposer: () => void;
  /** Enables drafting before a selected participant set has a conversation. */
  canComposeDraft?: boolean;
  /** Account of that draft, so files can be uploaded before it exists. */
  draftAccountId?: AccountId;
  /** People chosen for that draft, the only ones `@` can mention in it. */
  draftParticipants?: readonly ChatUser[];
  /**
   * Resolves or creates that conversation, then sends the draft text or one
   * of its files.
   */
  onSubmitDraft?: (
    message: ChatComposedMessage,
    attachment?: ChatAttachment,
  ) => Promise<unknown>;
};

/**
 * Top-level chat surface. Keeps its shell mounted across conversation
 * switches (so the shell and panel state survive) by taking
 * `chatRef` directly and loading the conversation through `useChat` —
 * `<ChatHeader>` renders a skeleton while the chat is being fetched.
 */
export const ChatView = ({
  chatRef,
  renderHeader,
  renderEmpty,
  onSent,
  composerFocusSignal,
  onFocusComposer,
  canComposeDraft = false,
  draftAccountId,
  draftParticipants,
  onSubmitDraft,
}: ChatViewProps) => {
  const { t } = useTranslation();
  // On `/chat/new`: what is typed has no conversation yet.
  const isNewChat = draftParticipants !== undefined;
  const mentionSource = useMemo<ComposerMentionSource | undefined>(() => {
    if (chatRef) {
      return { accountId: chatRef.accountId, chatRef };
    }
    return draftAccountId && draftParticipants?.length
      ? {
          accountId: draftAccountId,
          chatRef: null,
          participants: draftParticipants,
        }
      : undefined;
  }, [chatRef, draftAccountId, draftParticipants]);
  const { chat } = useChat(chatRef);
  const chatSendState = useChatSendState(chatRef);
  const composerAccountId = useComposerAccountId();
  const securityAccountId = chatRef?.accountId ?? composerAccountId;
  const { security: draftSecurity } = useChatSecurity(composerAccountId);
  const sendState = chatRef ? chatSendState : securitySendState(draftSecurity);
  const securityBlocked = sendState === "blocked";
  // Typing stays possible while security resolves; only sending waits.
  const securityChecking = sendState === "checking";
  // A pending incoming invitation replaces the timeline/composer/tools surfaces
  // with the invitation detail view until it is accepted.
  const invitationChat = isInvitationChat(chat) ? chat : null;
  const isInvitation = invitationChat !== null;
  const {
    sendMessage,
    sendAttachment,
    retryFailedMessage,
    discardFailedMessage,
    isSupported: isCompositionSupported,
  } = useSendChatMessage(chatRef);
  // Before a New Chat draft has a conversation, files go to its account only.
  const uploadAttachment = useUploadChatAttachment(
    chatRef ?? (draftAccountId ? { accountId: draftAccountId } : null),
  );
  const canUploadAttachments = chatRef
    ? isCompositionSupported
    : canComposeDraft;
  // Files dropped anywhere on the conversation go to its composer.
  const mainRef = useRef<HTMLDivElement>(null);
  useIgnoreStrayFileDrops();
  const { editMessage, isEditing } = useEditChatMessage(chatRef);
  // Typing loads the room members: let the first messages show before it.
  const messagesLoaded = useChatMessagesLoaded(chatRef);
  const { users: typingUsers, onTypingActivity } = useChatTyping(chatRef, {
    watchIncoming: messagesLoaded,
  });
  const [editingMessage, setEditingMessage] =
    useState<EditingChatMessage | null>(null);
  const chatKey = chatRef ? `${chatRef.accountId}:${chatRef.chatId}` : null;

  // The same composer submits either a new event or an in-place edit. Notify
  // `onSent` only for new messages so editing never changes navigation state.
  const handleSubmit = useCallback(
    async (composed: ChatComposedMessage) => {
      if (editingMessage) {
        const message = await editMessage(editingMessage.id, composed);
        setEditingMessage(null);
        return message;
      }
      if (!chatRef) {
        if (!onSubmitDraft) {
          throw new Error("Draft composition is not available.");
        }
        return onSubmitDraft(composed);
      }
      // As in Element, typing goes on during the send. Messages leave in order,
      // and one that fails stays in the conversation, where it is reported.
      void sendMessage(composed).catch(() => {});
      onSent?.(chatRef);
    },
    [chatRef, editMessage, editingMessage, onSent, onSubmitDraft, sendMessage],
  );

  const handleSendAttachment = useCallback(
    async (attachment: ChatAttachment) => {
      if (!chatRef) {
        if (!onSubmitDraft) {
          throw new Error("Draft composition is not available.");
        }
        return onSubmitDraft({ content: "" }, attachment);
      }
      void sendAttachment(attachment).catch(() => {});
      onSent?.(chatRef);
    },
    [chatRef, onSent, onSubmitDraft, sendAttachment],
  );

  const [previewedAttachment, setPreviewedAttachment] =
    useState<PreviewedAttachment | null>(null);
  const closeAttachmentPreview = useCallback(
    () => setPreviewedAttachment(null),
    [],
  );
  const attachmentPreviewContext = useMemo<ChatAttachmentPreviewContextValue>(
    () => ({ openAttachment: setPreviewedAttachment }),
    [],
  );

  const [activeTool, setActiveTool] = useState<ChatTool | null>(null);
  const [displayedTool, setDisplayedTool] = useState<ChatTool | null>(null);
  // Thread whose detail view is open; `null` keeps the threads tool on its
  // list view.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadComposerFocusSignal, setThreadComposerFocusSignal] = useState(0);
  const [threadInitialMessage, setThreadInitialMessage] =
    useState<ThreadInitialMessage | null>(null);
  const [draftThreadRoot, setDraftThreadRoot] =
    useState<DraftThreadRoot | null>(null);
  // Set by the conversation's message list while it is shown.
  const conversationJumpRef = useRef<ChatMessageJump | null>(null);
  const handleConversationJumpChange = useCallback(
    (jump: ChatMessageJump | null) => {
      conversationJumpRef.current = jump;
    },
    [],
  );
  const queryClient = useQueryClient();
  const threadsKeyedByRoot = useChatThreadsKeyedByRoot(chatRef);
  useEffect(() => {
    if (activeTool !== null) {
      setDisplayedTool(activeTool);
    }
  }, [activeTool]);

  // A thread id belongs to a single conversation — reset panel state on switch.
  useEffect(() => {
    setActiveThreadId(null);
    setThreadComposerFocusSignal(0);
    setDraftThreadRoot(null);
    setEditingMessage(null);
    setPreviewedAttachment(null);
  }, [chatRef?.accountId, chatRef?.chatId]);

  const toggleTool = (tool: ChatTool) => {
    const willOpen = activeTool !== tool;
    setActiveTool(willOpen ? tool : null);
    // Opening the threads tool from the header always lands on the list; on
    // close the thread id is left untouched so the detail view does not flash
    // back to the list during the slide-out animation.
    if (willOpen && tool === "threads") {
      setActiveThreadId(null);
      setThreadComposerFocusSignal(0);
    }
  };

  const closePanel = () => setActiveTool(null);

  // Too narrow for the panel beside the conversation, it opens over it.
  const viewRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const panelFits = useToolsPanelFits(viewRef);
  // Adjusted while rendering, not in an effect: no render ever shows the
  // panel open over the conversation in between, which would make it inert
  // and take the focus from its composer.
  const [panelFitted, setPanelFitted] = useState(panelFits);
  if (panelFitted !== panelFits) {
    setPanelFitted(panelFits);
    // The window became too narrow while the panel was beside the
    // conversation: it closes rather than leave the conversation narrower.
    if (!panelFits) {
      setActiveTool(null);
    }
  }

  const openThread = useCallback(
    (threadId: string, options?: OpenThreadOptions) => {
      setActiveTool("threads");
      setActiveThreadId(threadId);
      setThreadComposerFocusSignal((signal) =>
        options?.focusComposer ? signal + 1 : 0,
      );
      setThreadInitialMessage(
        options?.messageId ? { messageId: options.messageId } : null,
      );
      setDraftThreadRoot(null);
    },
    [],
  );

  const jumpToConversationMessage = useCallback(async (messageId: string) => {
    await conversationJumpRef.current?.jumpTo(messageId);
  }, []);

  const openThreadList = useCallback(() => {
    setActiveTool("threads");
    setActiveThreadId(null);
    setThreadComposerFocusSignal(0);
    setDraftThreadRoot(null);
  }, []);

  const openDraftThread = useCallback(
    (root: DraftThreadRoot) => {
      if (chatRef && threadsKeyedByRoot) {
        // As Element's ThreadView, open the root's thread at once, created in
        // memory: its first message is an ordinary reply, shown while it is
        // sent, and no draft is left for another view once it is confirmed.
        const rootId = root.message.id;
        const cachedRoot = queryClient
          .getQueryData<ChatMessagesData>(chatKeys.messages(chatRef))
          ?.pages.flatMap((page) => page.messages)
          .find((message) => message.id === rootId);
        queryClient.setQueryData<ChatThreadDetail>(
          chatKeys.thread(chatRef, rootId),
          (detail) =>
            detail ??
            rootOnlyThreadDetail(cachedRoot ?? root.message, root.author),
        );
        openThread(rootId, { focusComposer: true });
        return;
      }
      setActiveTool("threads");
      setActiveThreadId(null);
      setThreadComposerFocusSignal((signal) => signal + 1);
      setDraftThreadRoot(root);
    },
    [chatRef, openThread, queryClient, threadsKeyedByRoot],
  );

  const closeThread = useCallback(() => {
    setActiveThreadId(null);
    setThreadComposerFocusSignal(0);
    setDraftThreadRoot(null);
  }, []);

  const panelContext = useMemo<ChatPanelContextValue>(
    () => ({
      openThread,
      openDraftThread,
      openThreadList,
      jumpToConversationMessage,
    }),
    [jumpToConversationMessage, openDraftThread, openThread, openThreadList],
  );
  // Their button leaves with the row: the focus goes on to the composer.
  const [refocusSignal, setRefocusSignal] = useState(0);
  const editContext = useMemo(
    () => ({
      startEditing: setEditingMessage,
      retryFailedMessage: (id: string) => {
        retryFailedMessage(id);
        setRefocusSignal((signal) => signal + 1);
      },
      discardFailedMessage: (id: string) => {
        discardFailedMessage(id);
        setRefocusSignal((signal) => signal + 1);
      },
    }),
    [discardFailedMessage, retryFailedMessage],
  );

  // Over the conversation, the panel shuts it behind a backdrop, out of reach
  // of the pointer and the keyboard: the focus goes into the panel, unless
  // something in it took it already.
  const panelOverlays =
    !panelFits && activeTool !== null && chatRef !== null && !isInvitation;
  useEffect(() => {
    if (!panelOverlays) {
      return;
    }
    const panel = document.getElementById(panelId);
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus();
    }
  }, [panelId, panelOverlays]);

  // A click on the backdrop closes it, and so does Escape, once what is open
  // inside it (a menu, an edit) has had it, also when the focus fell back on
  // the page. The focus goes back to the conversation's composer.
  const closeOverlay = useCallback(() => {
    setActiveTool(null);
    setRefocusSignal((signal) => signal + 1);
  }, []);
  useEffect(() => {
    if (!panelOverlays) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        (panelRef.current?.contains(event.target as Node) ||
          event.target === document.body)
      ) {
        closeOverlay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOverlay, panelOverlays]);

  const renderConversation = () => {
    if (invitationChat && chatRef) {
      return <ChatInvitationView chatRef={chatRef} chat={invitationChat} />;
    }
    if (chatRef) {
      return (
        <ChatConversation
          chatRef={chatRef}
          onMessageJumpChange={handleConversationJumpChange}
          onJumpToLatest={onFocusComposer}
        />
      );
    }
    return renderEmpty?.();
  };
  let composerPlaceholder: string | undefined;
  if (securityBlocked) {
    composerPlaceholder = t("Verify encryption before sending a message.");
  } else if (chatRef && !isCompositionSupported) {
    composerPlaceholder = t(
      "Sending messages isn't available on this account yet.",
    );
  }

  return (
    <ChatMessageEditProvider value={editContext}>
      <ChatAttachmentPreviewProvider value={attachmentPreviewContext}>
        <ChatPanelProvider value={panelContext}>
          <div
            ref={viewRef}
            className="hub__chat-view"
            data-panel-open={activeTool !== null}
            data-panel-layout={panelFits ? "inline" : "overlay"}
            data-header-variant={renderHeader ? "search" : "chat"}
          >
            <div className="hub__chat-view__header" inert={panelOverlays}>
              {renderHeader ? (
                renderHeader({
                  chat,
                  activeTool,
                  onToggleTool: toggleTool,
                })
              ) : (
                <ChatHeader
                  chat={chat}
                  activeTool={activeTool}
                  onToggleTool={toggleTool}
                  showTools={!isInvitation}
                />
              )}
            </div>

            <div
              className="hub__chat-view__main"
              ref={mainRef}
              inert={panelOverlays}
            >
              <div className="hub__chat-view__content">
                {renderConversation()}
              </div>
              {/* An invitation suppresses the composer until it is accepted. */}
              {!isInvitation && (
                <div className="hub__chat-view__composer">
                  {/* The composer keeps a single instance across the empty → chat
                  transition so an in-progress draft and the input focus survive
                  when a conversation resolves. */}
                  <div className="hub__chat-composer-stack">
                    {securityBlocked && securityAccountId && (
                      <ChatEncryptionPrompt accountId={securityAccountId} />
                    )}
                    <div className="hub__chat-composer-overlay-anchor">
                      <ComposerFloatingArea key={chatKey ?? "draft"}>
                        <TypingIndicator
                          accountId={chatRef?.accountId ?? null}
                          users={typingUsers}
                        />
                        <div className="hub__chat-composer-floating-banners">
                          {chatRef && (
                            <ConversationUnreadBanner chatRef={chatRef} />
                          )}
                        </div>
                      </ComposerFloatingArea>
                      <ChatComposer
                        conversationId={
                          chatKey ?? (isNewChat ? NEW_CHAT_DRAFT_ID : undefined)
                        }
                        followsSelection={isNewChat}
                        placeholder={composerPlaceholder}
                        disabled={
                          securityBlocked ||
                          (chatRef ? !isCompositionSupported : !canComposeDraft)
                        }
                        isSubmitting={isEditing}
                        focusSignal={(composerFocusSignal ?? 0) + refocusSignal}
                        errorMessage={
                          editingMessage
                            ? t(
                                "Your message could not be edited. Please try again.",
                              )
                            : undefined
                        }
                        editDraft={editingMessage}
                        onCancelEdit={() => setEditingMessage(null)}
                        onTypingActivity={onTypingActivity}
                        onSubmit={
                          (chatRef || canComposeDraft) && !securityChecking
                            ? handleSubmit
                            : undefined
                        }
                        onMessageSent={({ trigger, hasAttachment }) =>
                          trackEvent("message:sent", {
                            trigger,
                            has_attachment: hasAttachment,
                            // A new conversation has no chat yet: its people
                            // tell what it will be.
                            chat_type: chatTypeOf(
                              chat ?? {
                                kind:
                                  (draftParticipants?.length ?? 0) > 1
                                    ? "group"
                                    : "direct",
                              },
                            ),
                          })
                        }
                        onSendAttachment={handleSendAttachment}
                        onUploadAttachment={
                          canUploadAttachments ? uploadAttachment : undefined
                        }
                        dropTargetRef={mainRef}
                        mentions={mentionSource}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {!panelFits && chatRef && !isInvitation && (
              <div
                className="hub__chat-view__backdrop"
                aria-hidden="true"
                onClick={closeOverlay}
              />
            )}
            <div className="hub__chat-view__panel" ref={panelRef}>
              {chatRef && !isInvitation && activeTool !== null && panelFits && (
                <ToolsPanelResizeHandle viewRef={viewRef} panelId={panelId} />
              )}
              {chatRef && !isInvitation && (
                <ChatToolsPanel
                  id={panelId}
                  tool={activeTool ?? displayedTool}
                  isOpen={activeTool !== null}
                  chatRef={chatRef}
                  threadId={activeThreadId}
                  threadComposerFocusSignal={threadComposerFocusSignal}
                  threadInitialMessage={threadInitialMessage}
                  draftThreadRoot={draftThreadRoot}
                  onClose={panelOverlays ? closeOverlay : closePanel}
                  onOpenThread={openThread}
                  onCloseThread={closeThread}
                />
              )}
            </div>
          </div>
          {previewedAttachment && chatRef && (
            <ChatAttachmentPreview
              // A new file opens with fresh loading and error state.
              key={`${previewedAttachment.accountId}:${previewedAttachment.messageId}`}
              chatRef={chatRef}
              {...previewedAttachment}
              onClose={closeAttachmentPreview}
            />
          )}
        </ChatPanelProvider>
      </ChatAttachmentPreviewProvider>
    </ChatMessageEditProvider>
  );
};

const ConversationUnreadBanner = ({ chatRef }: { chatRef: ChatRef }) => {
  // Read after the messages. The full thread list loads with its panel.
  const unreadThreads = useChatUnreadThreads(chatRef, {
    enabled: useChatMessagesLoaded(chatRef),
  });

  if (unreadThreads.length === 0) {
    return null;
  }

  return (
    <UnreadThreadsBanner chatRef={chatRef} unreadThreads={unreadThreads} />
  );
};

const ComposerFloatingArea = ({ children }: { children: ReactNode }) => {
  const stackRef = useRef<HTMLDivElement>(null);
  const [reservedHeight, setReservedHeight] = useState(0);

  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (!stack) {
      return;
    }
    const reserveVisibleHeight = () => {
      const visibleHeight = Math.ceil(stack.getBoundingClientRect().height);
      // Mirror the current overlay only; its own exit transition keeps the
      // reserve long enough to disappear without leaving a permanent gap.
      setReservedHeight(
        visibleHeight > 0 ? visibleHeight + FLOATING_STACK_SAFETY_GAP : 0,
      );
    };
    const observer = new ResizeObserver(reserveVisibleHeight);
    observer.observe(stack);
    reserveVisibleHeight();
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="hub__chat-composer-safety-space"
      style={{ height: reservedHeight }}
    >
      <div ref={stackRef} className="hub__chat-composer-floating-stack">
        {children}
      </div>
    </div>
  );
};
