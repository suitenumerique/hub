import {
  Button,
  Input,
  Modal,
  ModalSize,
  Select,
} from "@gouvfr-lasuite/ui-components";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { chatHref } from "@/features/chat/chatRefs";
import { SelectedUserChip } from "@/features/chat/components/SelectedUserChip";
import { useComposerAccountId } from "@/features/chat/hooks/useChatAccounts";
import { useChatUserSearch } from "@/features/chat/hooks/useChatUserSearch";
import { useCreateChatForUsers } from "@/features/chat/hooks/useCreateChatForUsers";
import type { ChatUser, Space } from "@/features/drivers/types";
import { Avatar } from "@/features/ui/components/avatar/Avatar";
import { notify } from "@/features/ui/components/toast";

type CreateSalonModalProps = {
  isOpen: boolean;
  onClose: () => void;
  spaces: Space[];
  /** Preselected when the modal opens — the currently-active espace, if
   * any — but the user picks (and can change) which one the new salon
   * actually joins before creating it. */
  defaultSpaceId: string | null;
};

const MIN_MEMBERS = 2;

/** Name-and-pick-members dialog for the New menu's "Salon" choice. */
export const CreateSalonModal = ({
  isOpen,
  onClose,
  spaces,
  defaultSpaceId,
}: CreateSalonModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const accountId = useComposerAccountId();
  const { createChatForUsers, isCreating } = useCreateChatForUsers(accountId);
  const [spaceId, setSpaceId] = useState<string | null>(defaultSpaceId);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
  const excludedUserIds = useMemo(
    () => selectedUsers.map((user) => user.id),
    [selectedUsers],
  );
  const { users, isInitialLoading } = useChatUserSearch(query, excludedUserIds);
  const trimmedName = name.trim();
  const requiresSpace = spaces.length > 0;
  const canCreate =
    (!requiresSpace || spaceId !== null) &&
    trimmedName.length > 0 &&
    selectedUsers.length >= MIN_MEMBERS &&
    !isCreating;

  // Re-sync to the currently-active espace each time the modal (re)opens,
  // rather than keeping whatever was last picked in a previous session.
  useEffect(() => {
    if (isOpen) {
      setSpaceId(defaultSpaceId);
    }
  }, [isOpen, defaultSpaceId]);

  const reset = () => {
    setName("");
    setQuery("");
    setSelectedUsers([]);
  };

  const close = () => {
    if (isCreating) return;
    reset();
    onClose();
  };

  const addUser = (user: ChatUser) => {
    setSelectedUsers((current) =>
      current.some((selected) => selected.id === user.id)
        ? current
        : [...current, user],
    );
    setQuery("");
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((current) => current.filter((user) => user.id !== userId));
  };

  const handleCreate = () => {
    if (!canCreate) return;
    createChatForUsers(
      selectedUsers.map((user) => user.id),
      trimmedName,
      spaceId ?? undefined,
      true, // forceNew: a named salon is always a genuinely new room, even
      // if the same people already share an unrelated chat elsewhere.
    )
      .then((ref) => {
        reset();
        onClose();
        void router.push(chatHref(ref, spaceId), undefined, {
          shallow: true,
        });
      })
      .catch(() => {
        notify.error(t("The room could not be created. Please try again."));
      });
  };

  const spaceOptions = spaces.map((space) => ({
    value: space.id,
    label: space.name,
  }));

  return (
    <Modal
      isOpen={isOpen}
      size={ModalSize.SMALL}
      title={t("New room")}
      aria-label={t("New room")}
      onClose={close}
      closeOnClickOutside={!isCreating}
      closeOnEsc={!isCreating}
      preventClose={isCreating}
      rightActions={
        <>
          <Button
            type="button"
            variant="secondary"
            color="neutral"
            fullWidth
            disabled={isCreating}
            onClick={close}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="button"
            fullWidth
            disabled={!canCreate}
            onClick={handleCreate}
          >
            {isCreating ? t("Creating…") : t("Create")}
          </Button>
        </>
      }
    >
      <div className="hub__create-salon">
        {requiresSpace && (
          <Select
            label={t("Space")}
            options={spaceOptions}
            value={spaceId ?? undefined}
            onChange={(event) =>
              setSpaceId(
                typeof event.target.value === "string"
                  ? event.target.value
                  : null,
              )
            }
          />
        )}

        <Input
          label={t("Room name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />

        <div className="hub__create-salon__members">
          <span className="hub__create-salon__members-label">
            {t("Members")}
          </span>

          {selectedUsers.length > 0 && (
            <div className="hub__create-salon__chips">
              {selectedUsers.map((user) => (
                <SelectedUserChip
                  key={user.id}
                  user={user}
                  armed={false}
                  onRemove={() => removeUser(user.id)}
                />
              ))}
            </div>
          )}

          <Input
            label={t("Search people")}
            hideLabel
            variant="classic"
            placeholder={t("Search people")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {query.trim().length > 0 && (
            <ul className="hub__create-salon__results">
              {users.length === 0 && (
                <li className="hub__create-salon__results-empty" role="status">
                  {isInitialLoading
                    ? t("Searching people…")
                    : t("No people found")}
                </li>
              )}
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="hub__create-salon__result"
                    onClick={() => addUser(user)}
                  >
                    <Avatar
                      label={user.name}
                      color={user.color}
                      size="sm"
                      decorative
                    >
                      {user.initials}
                    </Avatar>
                    <span className="hub__create-salon__result-body">
                      <span className="hub__create-salon__result-name">
                        {user.name}
                      </span>
                      <span className="hub__create-salon__result-subtitle">
                        {user.subtitle}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
};
