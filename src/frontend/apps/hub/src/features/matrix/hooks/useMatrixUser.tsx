import { User } from "@/features/auth/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useState } from "react";
import { matrixUserStore } from "../stores/matrixUserStore";
import {
  completeOidcLogin,
  getOIDCAuthUrl,
  getUserIdFromAccessToken,
} from "../utils/auth";
import { fetchHomeserverForEmail } from "../utils/autodiscovery";

const OIDC_HS = 'oidc_hs';
const OIDC_RESPONSE_MODE = 'oidc_response_mode';

export const useMatrixChatUser = (user: User | null | undefined) => {
  const router = useRouter();
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

  const { data: chatUser = null } = useQuery({
    queryKey: ['useMatrixChatUser', user], // Refetch when chatUser changes
    queryFn: async () => {
      const currentUser = matrixUserStore.getUser();
      if (currentUser) {
        console.log('**** already has user');
        return currentUser;
      }
      let currentHomeserverSelected = sessionStorage.get(OIDC_HS);
      // Check if we're in OIDC callback
      const { code, state } = router.query;
      if (code && state) {
        console.log('**** Processing OIDC callback');
        setIsProcessingCallback(true);
        const responseMode = sessionStorage.get(OIDC_RESPONSE_MODE) || 'fragment';
        const oidcResult = await completeOidcLogin({ code, state }, responseMode);
        const {
          user_id: userId,
          device_id: deviceId,
          is_guest: isGuest,
        } = await getUserIdFromAccessToken(oidcResult.accessToken, currentHomeserverSelected);

        const matrixUser = {
          homeserverUrl: currentHomeserverSelected,
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
      if (!currentHomeserverSelected) {
        const hs = await fetchHomeserverForEmail(email);
        currentHomeserverSelected = hs!.base_url;
        sessionStorage.setItem(OIDC_HS, hs!.base_url);
      }
      const { authUrl, responseMode } = await getOIDCAuthUrl(currentHomeserverSelected, email);
      sessionStorage.setItem(OIDC_RESPONSE_MODE, responseMode);

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
