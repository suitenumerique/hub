import { Spinner } from "@gouvfr-lasuite/ui-kit";
import { posthog } from "posthog-js";
import React, { PropsWithChildren, useEffect, useState } from "react";

import { fetchAPI } from "@/features/api/fetchApi";
import { User } from "@/features/auth/types";
import { APIError } from "../api/APIError";
import { baseApiUrl } from "../api/utils";
import { getDriver } from "../config/Config";
import { useConfig } from "../config/ConfigProvider";
import { MatrixDriver } from "../drivers/implementations/MatrixDriver";
import { ChatLocalUser } from "../drivers/types";
import { matrixUserStore } from "../matrix/stores/matrixUserStore";
import { authUrl } from "./authUrl";
import { attemptSilentLogin, canAttemptSilentLogin } from "./silentLogin";

export const logout = () => {
  window.location.replace(new URL('logout/', baseApiUrl()).href);
  matrixUserStore.removeUser();
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
  const driver = getDriver();

  // TODO: is it a good place to put ?
  // Some driver may need an initialization process
  if (driver instanceof MatrixDriver) {
    driver.initialize();
  }

  // Fetch Matrix chat user credentials when regular user is authenticated
  const useChatLocalUser = driver.useChatLocalUser(user);
  const { chatUser, isProcessingCallback, isStartOidcFlow } = useChatLocalUser();

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

  if (user === undefined || isProcessingCallback || isStartOidcFlow) {
    return (
      <div className="hub-auth-loader">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
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
  );
};
