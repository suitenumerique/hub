import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { decorateChat } from "@/features/chat/chatRefs";
import { getHubApi } from "@/features/config/HubApi";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { AccountId, ChatRef, HubGroup } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export type HubGroupFormValues = {
  name: string;
  emoji: string;
  allowExternalGuests: boolean;
};

type CreateVariables = HubGroupFormValues & {
  invitees: string[];
  sourceRoomId?: string;
  idempotencyKey: string;
};

export type CreatedHubGroup = {
  group: HubGroup;
  ref: ChatRef;
};

export const useCreateHubGroup = (accountId: AccountId | null) => {
  const queryClient = useQueryClient();
  const mutation = useMutation<CreatedHubGroup, Error, CreateVariables>({
    mutationFn: async ({
      name,
      emoji,
      allowExternalGuests,
      invitees,
      sourceRoomId,
      idempotencyKey,
    }) => {
      if (!accountId) {
        throw new Error("No Matrix account is selected.");
      }
      const driver = getRegistry().get(accountId);
      const proof = await driver.getMatrixIdentityProof();
      const commonPayload = {
        matrix_account_id: accountId,
        matrix_access_token: proof.accessToken,
        name,
        emoji,
        invitees,
        allow_external_guests: allowExternalGuests,
      };
      const group = sourceRoomId
        ? await getHubApi().promoteConversation(
            { ...commonPayload, source_room_id: sourceRoomId },
            idempotencyKey,
          )
        : await getHubApi().createGroup(commonPayload, idempotencyKey);
      if (!group.matrix) {
        throw new Error("The group does not have an active Matrix room.");
      }
      const localChat = await driver.joinHubGroupRoom(
        group.matrix.room_id,
        group.matrix.via,
      );
      const chat = decorateChat(accountId, {
        ...localChat,
        name,
        kind: "hub_group",
        visual: { kind: "emoji", emoji },
        hubGroup: group,
      });
      queryClient.setQueryData(chatKeys.chat(chat.ref), chat);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: chatKeys.chatsOf(accountId),
        }),
        queryClient.invalidateQueries({ queryKey: chatKeys.chatsAll() }),
        queryClient.invalidateQueries({
          queryKey: chatKeys.hubGroupsOf(accountId),
        }),
        queryClient.invalidateQueries({
          queryKey: chatKeys.chatForUsersOf(accountId),
        }),
      ]);
      return { group, ref: chat.ref };
    },
    meta: { noGlobalError: true },
  });

  const createGroup = useCallback(
    (values: HubGroupFormValues, invitees: string[], sourceRoomId?: string) =>
      mutation.mutateAsync({
        ...values,
        invitees,
        sourceRoomId,
        idempotencyKey: crypto.randomUUID(),
      }),
    [mutation],
  );

  return {
    createGroup,
    isCreating: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
};
