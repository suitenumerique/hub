import {
  completeOidcLogin,
  getOIDCAuthUrl,
  getUserIdFromAccessToken,
} from '../utils/auth';
import { matrixUserStore } from '../stores/matrixUserStore';
import { User } from '@/features/auth/types';
import { useQuery } from '@tanstack/react-query';
import { fetchHomeserverForEmail } from '../utils/autodiscovery';
import { useRouter } from 'next/router';
import { useState } from 'react';

export const useMatrixChatUser = (user: User | null | undefined) => {
  const router = useRouter();
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  const [homeserver, setHomeserver] = useState('');

  const { data: chatUser = null } = useQuery({
    queryKey: ['useMatrixChatUser', user], // Refetch when chatUser changes
    queryFn: async () => {
      const currentUser = matrixUserStore.getUser();
      if (currentUser) {
        console.log('**** already has user');
        return currentUser;
      }

      // Check if we're in OIDC callback
      const { code, state } = router.query;
      if (code && state) {
        console.log('**** Processing OIDC callback');
        setIsProcessingCallback(true);
        const oidcResult = await completeOidcLogin({ code, state }, 'fragment');
        const {
          user_id: userId,
          device_id: deviceId,
          is_guest: isGuest,
        } = await getUserIdFromAccessToken(oidcResult.accessToken, homeserver);

        const matrixUser = {
          homeserverUrl: homeserver,
          mxId: userId,
          deviceId: deviceId,
          accessToken: oidcResult.accessToken,
          refreshToken: oidcResult.refreshToken,
          guest: isGuest,
        };
        matrixUserStore.saveUser(matrixUser);
        matrixUserStore.persistOIDC(
          oidcResult.clientId,
          oidcResult.issuer,
          oidcResult.idToken,
        );
        // Clean up URL params
        router.replace(router.pathname, undefined, { shallow: true });
        setIsProcessingCallback(false);
        return matrixUser;
      }

      console.log('**** No user found, fetching new user');
      // Find correct homeserver url
      // TODO Should use user?.email, for now only using hardcoded email
      let email = user?.email || '';
      if (process.env.NODE_ENV === 'development') {
        email = 'marc3@tchap.beta.gouv.fr';
      }
      if (!homeserver) {
        const hs = await fetchHomeserverForEmail(email);
        setHomeserver(hs!.base_url);
      }
      const authUrl = await getOIDCAuthUrl(homeserver, email);
      // start oidc flow in tchap MAS
      window.location.href = authUrl;
      return null;
    },
    enabled: !!user, // Only run query when user exists
    staleTime: Infinity, // Client doesn't stale
    retry: 1,
  });

  return { chatUser, isProcessingCallback };
};
