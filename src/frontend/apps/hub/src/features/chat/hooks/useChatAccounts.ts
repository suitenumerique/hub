import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  createElement,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getHubApi } from "@/features/config/HubApi";
import { getRegistry } from "@/features/drivers/DriverRegistry";
import type { AccountId, ChatScope } from "@/features/drivers/types";

import { chatKeys } from "../chatKeys";

const CHAT_SCOPE_STORAGE_KEY = "hub:chat:scope";

export type ChatScopesContextValue = {
  scopes: ChatScope[];
  activeScope: ChatScope | null;
  activeScopeId: string | null;
  setActiveScopeId: (scopeId: string) => void;
};

const ChatScopesContext = createContext<ChatScopesContextValue>({
  scopes: [],
  activeScope: null,
  activeScopeId: null,
  setActiveScopeId: () => {},
});

const readStoredScopeId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(CHAT_SCOPE_STORAGE_KEY);
};

const persistScopeId = (scopeId: string): void => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CHAT_SCOPE_STORAGE_KEY, scopeId);
  }
};

const resolveActiveScope = (
  scopes: ChatScope[],
  requestedScopeId: string | null,
): ChatScope | null => {
  if (scopes.length === 0) {
    return null;
  }
  return (
    scopes.find((scope) => scope.scopeId === requestedScopeId) ??
    scopes.find((scope) => scope.isDefault) ??
    scopes[0]
  );
};

export const useChatAccountsBootstrap = () => {
  const hubApi = getHubApi();
  const [requestedScopeId, setRequestedScopeId] = useState<string | null>(
    readStoredScopeId,
  );
  const [reconciledScopeId, setReconciledScopeId] = useState<string | null>(
    null,
  );

  const query = useQuery({
    queryKey: chatKeys.scopes(),
    queryFn: () => hubApi.getChatScopes(),
    staleTime: Infinity,
    meta: { noGlobalError: true },
  });

  const scopes = query.data ?? [];
  const activeScope = useMemo(
    () => resolveActiveScope(scopes, requestedScopeId),
    [requestedScopeId, scopes],
  );
  const activeScopeId = activeScope?.scopeId ?? null;

  const setActiveScopeId = useCallback((scopeId: string) => {
    persistScopeId(scopeId);
    setRequestedScopeId(scopeId);
  }, []);

  useEffect(() => {
    if (activeScope) {
      getRegistry().reconcile(activeScope.accounts);
      setReconciledScopeId(activeScope.scopeId);
    }
  }, [activeScope]);

  useEffect(
    () => () => {
      getRegistry().destroyAll();
    },
    [],
  );

  const isReconciling =
    activeScope !== null && reconciledScopeId !== activeScope.scopeId;

  return {
    ...query,
    scopes,
    activeScope,
    activeScopeId,
    setActiveScopeId,
    isReconciling,
  };
};

export const ChatScopesProvider = ({
  children,
  value,
}: PropsWithChildren<{ value: ChatScopesContextValue }>) =>
  createElement(ChatScopesContext.Provider, { value }, children);

export const useChatScopes = (): ChatScopesContextValue =>
  useContext(ChatScopesContext);

/**
 * The account a new conversation should be composed under: within the active
 * scope, the required account if there is one, otherwise the first enabled one.
 * `null` until the scope manifest has loaded. Drives the new-chat people search
 * and existing-conversation resolution (see `useChatUserSearch` /
 * `useChatForUsers`).
 */
export const useComposerAccountId = (): AccountId | null => {
  const { activeScope } = useChatScopes();
  if (!activeScope) {
    return null;
  }
  const account =
    activeScope.accounts.find(
      (candidate) => candidate.enabled && candidate.criticality === "required",
    ) ??
    activeScope.accounts.find((candidate) => candidate.enabled) ??
    activeScope.accounts[0];
  return account?.accountId ?? null;
};
