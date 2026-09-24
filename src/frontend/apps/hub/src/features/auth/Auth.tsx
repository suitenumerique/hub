import { Button, Spinner } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";
import { posthog } from "posthog-js";
import React, { PropsWithChildren, useEffect, useState } from "react";

import { fetchAPI } from "@/features/api/fetchApi";
import { User } from "@/features/auth/types";
import { APIError } from "../api/APIError";
import { baseApiUrl } from "../api/utils";
import { useChatAccountsBootstrap } from "../chat/hooks/useChatAccounts";
import { useChatConnections } from "../chat/hooks/useChatConnection";
import { useConfig } from "../config/ConfigProvider";
import { getRegistry } from "../drivers/DriverRegistry";
import { ChatLocalUser } from "../drivers/types";
import { authUrl } from "./authUrl";
import { attemptSilentLogin, canAttemptSilentLogin } from "./silentLogin";

export const logout = async () => {
  const registry = getRegistry();
  // Cleanup remains under device ownership until all pending work has stopped.
  const cleanup = registry.getSnapshot().map(({ driver }) => driver.logout());
  registry.destroyAll();
  // Unavailable local storage must not prevent logout from Hub itself.
  await Promise.allSettled(cleanup);
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
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>();
  const [replacingDevice, setReplacingDevice] = useState(false);
  const [replacementFailed, setReplacementFailed] = useState(false);
  const { config } = useConfig();
  const chatAccounts = useChatAccountsBootstrap(user?.id ?? null);

  // Backend-agnostic chat connection: the driver owns the handshake, the UI
  // only observes a generic aggregate status.
  const {
    status: chatStatus,
    chatUser,
    redirectTo,
    reason,
  } = useChatConnections(user);

  const init = async () => {
    try {
      const response = await fetchAPI(`users/me/`, undefined, {
        redirectOn40x: false,
      });
      const data = (await response.json()) as User;
      if (user?.id && user.id !== data.id) {
        // Retire the entire old page before connecting a different Hub person:
        // late mutation callbacks must not write into the next person's caches.
        setUser(undefined);
        await getRegistry().shutdownAll();
        window.location.reload();
        return data;
      }
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
    chatAccounts.isReconciling ||
    chatStatus === "connecting"
  ) {
    return (
      <div className="hub-auth-loader">
        <Spinner size="xl" />
      </div>
    );
  }

  if (chatStatus === "blocked" || chatStatus === "error") {
    let message: string;
    switch (reason) {
      case "another-tab":
        message = t(
          "Another Hub tab is using this session. Close that tab, then try again here. You can keep Element open.",
        );
        break;
      case "unsupported":
        message = t(
          "This browser cannot protect encryption storage. Use a browser that supports Web Locks.",
        );
        break;
      case "storage-continuity":
        message = t(
          "This device’s local keys are missing or no longer match its session. Stored data has not been deleted. A new device session is required.",
        );
        break;
      default:
        message = t(
          "The server or storage is unavailable. Your keys are preserved. Try again when the connection is restored.",
        );
    }
    return (
      <main className="hub__connection-error">
        <h1>{t("Chat connection interrupted")}</h1>
        <p role="alert">{message}</p>
        <Button onClick={() => window.location.reload()}>
          {t("Try again")}
        </Button>
        {reason === "storage-continuity" && user && (
          <Button
            disabled={replacingDevice}
            onClick={() => {
              setReplacingDevice(true);
              setReplacementFailed(false);
              const driver = getRegistry()
                .getSnapshot()
                .find((entry) => entry.criticality === "required")?.driver;
              void driver
                ?.replaceLostDeviceSession(user)
                .then((state) => {
                  if (state.redirectTo)
                    window.location.assign(state.redirectTo);
                })
                .finally(() => setReplacingDevice(false))
                .catch(() => setReplacementFailed(true));
            }}
          >
            {t("Reconnect Hub with a new device")}
          </Button>
        )}
        {replacementFailed && (
          <p role="alert">
            {t("Reconnection failed. Check your connection and try again.")}
          </p>
        )}
        <Button
          variant="tertiary"
          onClick={() => {
            void logout();
          }}
        >
          {t("Log out")}
        </Button>
      </main>
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
