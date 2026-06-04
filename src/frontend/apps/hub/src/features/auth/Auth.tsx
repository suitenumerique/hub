import { Spinner } from "@gouvfr-lasuite/ui-kit";
import { posthog } from "posthog-js";
import React, { PropsWithChildren, useEffect, useState } from "react";

import { fetchAPI } from "@/features/api/fetchApi";
import { User } from "@/features/auth/types";
import { APIError } from "../api/APIError";
import { baseApiUrl } from "../api/utils";
import {
  ChatScopesProvider,
  useChatAccountsBootstrap,
} from "../chat/hooks/useChatAccounts";
import { useChatConnections } from "../chat/hooks/useChatConnection";
import { useConfig } from "../config/ConfigProvider";
import { getRegistry } from "../drivers/DriverRegistry";
import { ChatLocalUser } from "../drivers/types";
import { authUrl } from "./authUrl";
import { attemptSilentLogin, canAttemptSilentLogin } from "./silentLogin";

export const logout = () => {
  getRegistry().destroyAll();
  window.location.replace(new URL("logout/", baseApiUrl()).href);
  posthog.reset();
};

export const login = (returnTo?: string) => {
  const url = authUrl({ returnTo });
  window.location.replace(url.href);
};

interface AuthContextInterface {
  user?: User | null;
  init?: () => Promise<User | null>;
  refreshUser?: () => Promise<void>;
  chatUser?: ChatLocalUser | null;
}

export const AuthContext = React.createContext<AuthContextInterface>({});

export const useAuth = () => React.useContext(AuthContext);

export const Auth = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>();
  const { config } = useConfig();
  const chatAccounts = useChatAccountsBootstrap();

  // Backend-agnostic chat connection: the driver owns the handshake, the UI
  // only observes a generic aggregate status.
  const { status: chatStatus, chatUser, redirectTo } = useChatConnections(user);
  console.log("chatStatus", chatStatus, chatUser, redirectTo);

  const init = async () => {
    try {
      const response = await fetchAPI(`users/me/`, undefined, {
        redirectOn40x: false,
      });
      const data = (await response.json()) as User;
      setUser(data);
      return data;
    } catch (error) {
      if (
        config.FRONTEND_SILENT_LOGIN_ENABLED &&
        error instanceof APIError &&
        error.code === 401
      ) {
        if (canAttemptSilentLogin()) {
          attemptSilentLogin(30);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      return null;
    }
  };

  const refreshUser = async () => {
    void init();
  };

  useEffect(() => {
    void init();
  }, []);

  useEffect(() => {
    if (user) {
      posthog.identify(user.email, {
        email: user.email,
      });
    }
  }, [user]);

  useEffect(() => {
    if (redirectTo) {
      window.location.assign(redirectTo);
    }
  }, [redirectTo]);

  if (
    user === undefined ||
    chatAccounts.isPending ||
    chatAccounts.isReconciling ||
    chatStatus === "connecting"
  ) {
    return (
      <div className="hub-auth-loader">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <ChatScopesProvider value={chatAccounts}>
      <AuthContext.Provider
        value={{
          user,
          init,
          refreshUser,
          chatUser,
        }}
      >
        {children}
      </AuthContext.Provider>
    </ChatScopesProvider>
  );
};
