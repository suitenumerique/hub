import { useRouter } from "next/router";
import { useCallback } from "react";

import { chatHref } from "@/features/chat/chatRefs";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { ChatRef } from "@/features/drivers/types";

const WAIT_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The backend creates the conversation: the chat driver learns about it from
 * its own sync, a moment later. Resolves once the driver can read it.
 */
const waitForChat = async (ref: ChatRef) => {
  const driver = getRegistry().get(ref.accountId);
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  for (;;) {
    try {
      return await driver.getChat(ref.chatId);
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
    }
    await wait(RETRY_DELAY_MS);
  }
};

/** Opens the conversation the backend created for a new group (#32). */
export const useOpenGroupConversation = () => {
  const router = useRouter();
  return useCallback(
    async (ref: ChatRef) => {
      await waitForChat(ref);
      await router.push(chatHref(ref));
    },
    [router],
  );
};
