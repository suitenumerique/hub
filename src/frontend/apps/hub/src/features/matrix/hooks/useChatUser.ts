import { sendLoginRequest } from '../utils/auth';
import { matrixUserStore } from '../stores/MatrixUserStore';
import { User } from '@/features/auth/types';
import { useQuery } from '@tanstack/react-query';

export const useMatrixChatUser = (user: User | null | undefined) => {
  const { data: chatUser = null } = useQuery({
    queryKey: ['useMatrixChatUser', user], // Refetch when chatUser changes
    queryFn: async () => {
      const currentUser = matrixUserStore.getUser();
      if (currentUser) {
        console.log('**** already has user');
        return currentUser;
      }
      console.log('**** No user found, fetching new user');
      const mxUser = await sendLoginRequest('', '');
      matrixUserStore.saveUser(mxUser);
      return mxUser;
    },
    enabled: !!user, // Only run query when user exists
    staleTime: Infinity, // Client doesn't stale
    retry: 1,
  });

  return { chatUser };
};
