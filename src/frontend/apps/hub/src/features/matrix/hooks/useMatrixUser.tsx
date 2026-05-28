import { User } from "@/features/auth/types";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { matrixUserStore } from "../stores/matrixUserStore";
import { MatrixUserInterface } from "../types";
import {
  completeOidcLogin,
  getOIDCAuthUrl,
  getUserIdFromAccessToken,
} from "../utils/auth";
import { fetchHomeserverForEmail } from "../utils/autodiscovery";

const OIDC_HS = 'oidc_hs';

export const useMatrixChatUser = (user: User | null | undefined) => {
  const router = useRouter();
  const [chatUser, setChatUser] = useState<MatrixUserInterface | null>(null);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  const [isStartOidcFlow, setisStartOidcFlow] = useState(false);

  useEffect(() => {
    if (!user) return;

    const initializeUser = async () => {
      const currentUser = matrixUserStore.getUser();
      let currentHomeserverSelected = sessionStorage.getItem(OIDC_HS);

      if (currentUser) {
        console.log('**** already has user');
        return currentUser;
      }

      console.log('**** No user found, fetching new user');
      setisStartOidcFlow(true);
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
      const authUrl = await getOIDCAuthUrl(currentHomeserverSelected, email);
      setisStartOidcFlow(false);
      // start oidc flow in tchap MAS
      window.location.href = authUrl;
    }

    initializeUser();

  }, [user]);

  // Effect 1: Handle OIDC callback (independent of user prop)
  useEffect(() => {
    if (!router.isReady) return;
    const { code, state } = router.query;
    console.log("*** code, state", code, state);
    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') return;
    console.log("*** processing callback oidc");

    const processCallback = async () => {
      setIsProcessingCallback(true);
      try {
        const currentHomeserverSelected = sessionStorage.getItem(OIDC_HS);
        const oidcResult = await completeOidcLogin({ code, state });

        if (!currentHomeserverSelected) {
          throw new Error("No homeserver was set");
        }

        const { user_id: userId, device_id: deviceId, is_guest: isGuest } =
          await getUserIdFromAccessToken(oidcResult.accessToken, currentHomeserverSelected);

        const matrixUser: MatrixUserInterface = {
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

        setChatUser(matrixUser);
        router.replace(router.pathname, undefined, { shallow: true });
      } finally {
        setIsProcessingCallback(false);
      }
    };

    processCallback();
  }, [router.isReady, router.query.code, router.query.state, router.pathname]);

  return { chatUser, isProcessingCallback, isStartOidcFlow };
};
