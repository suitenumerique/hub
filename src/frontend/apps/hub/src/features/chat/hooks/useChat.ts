import { useQuery } from '@tanstack/react-query';
import type { Chat } from '@/features/drivers/types';
import {
  useDriver,
  useIsDriverReady,
} from '@/features/drivers/components/useDriver';

export interface GetChatSnapshot {
  chat: Chat | null | undefined;
  isLoading: boolean;
  isError: boolean;
}
export const useChat = (chatId: string): GetChatSnapshot => {
  const driver = useDriver();
  const isDriverReady = useIsDriverReady();

  const query = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => driver!.getChat(chatId),
    staleTime: Infinity,
    enabled: isDriverReady && !!driver,
    meta: { noGlobalError: true },
  });

  return {
    chat: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
