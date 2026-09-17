import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { decorateSpace } from "@/features/chat/chatRefs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { AccountId, Space } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

export type UseCreateSpaceResult = {
  /** Creates a new espace and resolves with it. */
  createSpace: (name: string) => Promise<Space>;
  isCreating: boolean;
};

/**
 * Starts a brand-new espace. Invalidates the espace lists so it appears in
 * the Espaces row right away — belt and suspenders alongside the driver's
 * own `chats:changed` event, which already triggers the same invalidation
 * once the room syncs in (see `useChatEvents.ts`).
 */
export const useCreateSpace = (
  accountId: AccountId | null,
): UseCreateSpaceResult => {
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useMutation<Space, Error, string>({
    mutationFn: async (name) => {
      if (!accountId) {
        throw new Error(
          "useCreateSpace: no account to create the espace under.",
        );
      }
      const localSpace = await getRegistry().get(accountId).createSpace(name);
      const space: Space = decorateSpace(accountId, localSpace);

      void queryClient.invalidateQueries({
        queryKey: chatKeys.spacesOf(accountId),
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.spacesAll() });

      return space;
    },
    meta: { noGlobalError: true },
  });

  const createSpace = useCallback(
    (name: string) => mutateAsync(name),
    [mutateAsync],
  );

  return { createSpace, isCreating: isPending };
};
