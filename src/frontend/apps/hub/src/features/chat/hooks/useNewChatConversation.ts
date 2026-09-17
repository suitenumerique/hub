import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ChatRef, ChatUser } from "@/features/drivers/types";
import { notify } from "@/features/ui/components/toast";

import { useComposerAccountId } from "./useChatAccounts";
import { useChatCreationSupport } from "./useChatCreationSupport";
import { useChatEncryptionSupport } from "./useChatEncryptionSupport";
import { useAccountChatCompositionSupport } from "./useChatCompositionSupport";
import { useChatForUsers } from "./useChatForUsers";
import { useCreateChatForUsers } from "./useCreateChatForUsers";
import { useSendChatMessage } from "./useSendChatMessage";

type UseNewChatConversationOptions = {
  isNew: boolean;
  focusComposer: () => void;
  onSent: (ref: ChatRef) => void;
};

/** Owns participant selection and lazy conversation creation for `/chat/new`. */
export const useNewChatConversation = ({
  isNew,
  focusComposer,
  onSent,
}: UseNewChatConversationOptions) => {
  const { t } = useTranslation();
  const accountId = useComposerAccountId();
  const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
  const [query, setQuery] = useState("");
  const [createdChatRef, setCreatedChatRef] = useState<ChatRef | null>(null);
  // Encryption is chosen before the room exists and cannot be changed after:
  // `m.room.encryption` is a one-way door in Matrix. So it lives here, next to
  // the participant selection, and is spent once at creation.
  const [encrypted, setEncrypted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const inFlightCreationsRef = useRef<Map<string, Promise<ChatRef>>>(new Map());
  const creationTargetRef = useRef<string | null>(null);

  const selectedUserIds = useMemo(
    () => selectedUsers.map((user) => user.id),
    [selectedUsers],
  );
  const selectionTarget = useMemo(
    () =>
      accountId && selectedUserIds.length > 0
        ? JSON.stringify([accountId, [...selectedUserIds].sort(), encrypted])
        : null,
    [accountId, encrypted, selectedUserIds],
  );
  // A one-to-one is always encrypted; only a group carries the choice.
  const isDirect = selectedUserIds.length === 1;
  const willEncrypt = isDirect || encrypted;
  // "The conversation with these people" depends on what is being asked for:
  // a clear room and its encrypted twin are different conversations. The
  // lookup is told which one, so an existing private message shows up as soon
  // as the person is picked, and a clear group request never lands in an
  // encrypted room.
  const { chat } = useChatForUsers(isNew ? selectedUserIds : [], {
    encrypted: willEncrypt,
  });
  const isCreationSupported = useChatCreationSupport(accountId);
  const isCompositionSupported = useAccountChatCompositionSupport(accountId);
  const isEncryptionSupported = useChatEncryptionSupport(accountId);
  const { createChatForUsers } = useCreateChatForUsers(accountId);
  const { sendMessageTo } = useSendChatMessage(null);

  const reset = useCallback(() => {
    setSelectedUsers([]);
    setQuery("");
    setEncrypted(false);
    setCreatedChatRef(null);
    creationTargetRef.current = null;
    inFlightCreationsRef.current.clear();
  }, []);

  // A fresh `/chat/new` always starts in the people field.
  useEffect(() => {
    if (!isNew) {
      return;
    }
    reset();
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isNew, reset]);

  // Participant ids from one account must never leak into another one.
  useEffect(() => reset(), [accountId, reset]);

  const focusSearch = useCallback(() => {
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const clearResolvedConversation = useCallback(() => {
    setCreatedChatRef(null);
    creationTargetRef.current = null;
  }, []);

  const addUser = useCallback(
    (user: ChatUser) => {
      setSelectedUsers((current) => {
        if (current.some((selected) => selected.id === user.id)) {
          return current;
        }
        return [...current, user];
      });
      clearResolvedConversation();
      setQuery("");
      focusSearch();
    },
    [clearResolvedConversation, focusSearch],
  );

  const removeUser = useCallback(
    (userId: string) => {
      setSelectedUsers((current) =>
        current.filter((user) => user.id !== userId),
      );
      clearResolvedConversation();
      focusSearch();
    },
    [clearResolvedConversation, focusSearch],
  );

  const resolveSelectionChat = useCallback(async (): Promise<ChatRef> => {
    if (chat) {
      return chat.ref;
    }
    if (createdChatRef) {
      return createdChatRef;
    }
    if (!selectionTarget || !isCreationSupported) {
      throw new Error("Conversation creation is not available.");
    }

    creationTargetRef.current = selectionTarget;
    let creation = inFlightCreationsRef.current.get(selectionTarget);
    if (!creation) {
      creation = createChatForUsers(selectedUserIds, { encrypted });
      inFlightCreationsRef.current.set(selectionTarget, creation);
    }

    try {
      const ref = await creation;
      if (creationTargetRef.current === selectionTarget) {
        setCreatedChatRef(ref);
      }
      return ref;
    } finally {
      if (inFlightCreationsRef.current.get(selectionTarget) === creation) {
        inFlightCreationsRef.current.delete(selectionTarget);
      }
    }
  }, [
    chat,
    createChatForUsers,
    createdChatRef,
    encrypted,
    isCreationSupported,
    selectedUserIds,
    selectionTarget,
  ]);

  const confirmSelection = useCallback(() => {
    if (!selectionTarget) {
      return;
    }
    if (chat || createdChatRef) {
      focusComposer();
      return;
    }

    void resolveSelectionChat()
      .then(() => {
        if (creationTargetRef.current === selectionTarget) {
          focusComposer();
        }
      })
      .catch(() => {
        if (creationTargetRef.current !== selectionTarget) {
          return;
        }
        notify.error(
          t("The conversation could not be created. Please try again."),
        );
        focusSearch();
      });
  }, [
    chat,
    createdChatRef,
    focusComposer,
    focusSearch,
    resolveSelectionChat,
    selectionTarget,
    t,
  ]);

  const submitDraft = useCallback(
    async (content: string) => {
      const target = selectionTarget;
      if (!target) {
        throw new Error("Conversation creation requires participants.");
      }
      const ref = await resolveSelectionChat();
      if (creationTargetRef.current !== target) {
        throw new Error("The conversation participants changed before send.");
      }
      await sendMessageTo(ref, content);
      onSent(ref);
    },
    [onSent, resolveSelectionChat, selectionTarget, sendMessageTo],
  );

  const chatRef = chat?.ref ?? createdChatRef;
  const canComposeDraft =
    isNew &&
    selectedUsers.length > 0 &&
    !chatRef &&
    isCreationSupported &&
    isCompositionSupported;

  return {
    selectedUsers,
    query,
    searchInputRef,
    setQuery,
    addUser,
    removeUser,
    confirmSelection,
    chatRef,
    canUseChatTools: Boolean(chatRef),
    canComposeDraft,
    submitDraft,
    encrypted: willEncrypt,
    setEncrypted,
    // Shown only where there is something to decide: a group, before it
    // exists. A one-to-one is always encrypted, and once the room is created
    // the choice has been spent - Matrix offers no way back.
    canChooseEncryption: isEncryptionSupported && !chatRef && !isDirect,
    // A one-to-one has no choice to offer, but the fact still has to be said.
    isEncryptionForced: isEncryptionSupported && isDirect,
  };
};
