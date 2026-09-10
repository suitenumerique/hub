import {
  searchDatabaseName,
  SearchStorage,
} from "@/features/chat/search/storage";
import type { MatrixUserInterface } from "@/features/matrix/types";

import type { AccountId, User } from "../types";

export const MATRIX_USER_STORAGE_KEY = "matrixUser";

export const matrixStorageOwner = (
  settings: Record<string, unknown>,
  user?: User | null,
): string | null =>
  (typeof settings.loginHint === "string" && settings.loginHint
    ? settings.loginHint
    : (user?.email ?? "")
  ).trim() || null;

export const matrixStorageKey = (
  accountId: AccountId,
  key: string,
  owner?: string | null,
): string => {
  const ownedKey = owner ? `${key}:${owner}` : key;
  return accountId === "default" ? ownedKey : `${ownedKey}:${accountId}`;
};

/** Clears a search cache without loading or connecting a Matrix client. */
export const clearStoredConversationSearch = async (
  accountId: AccountId,
  owner: string | null,
): Promise<void> => {
  const raw = localStorage.getItem(
    matrixStorageKey(accountId, MATRIX_USER_STORAGE_KEY, owner),
  );
  if (!raw) return;
  let user: MatrixUserInterface;
  try {
    user = JSON.parse(raw) as MatrixUserInterface;
  } catch {
    return;
  }
  if (
    !user ||
    typeof user.homeserverUrl !== "string" ||
    typeof user.mxId !== "string"
  )
    return;
  await SearchStorage.remove(
    searchDatabaseName(owner ?? "", accountId, user.homeserverUrl, user.mxId),
  );
};
