import type { LocalChat } from "@/features/drivers/types";

export type SearchFreshness = "awaiting-sync" | "current" | "stale";
export type SearchPreparation =
  | "awaiting-sync"
  | "unknown-count"
  | "pending"
  | "loading"
  | "complete"
  | "error";

export type ConversationSearchStatus = {
  freshness: SearchFreshness;
  storageAvailable: boolean;
  ready: number;
  eligible: number;
  hasNameOnlyRooms: boolean;
  hasUnknownRooms: boolean;
  hasDeferredRooms: boolean;
  hasFailures: boolean;
};

export const EMPTY_SEARCH_STATUS: ConversationSearchStatus = {
  freshness: "awaiting-sync",
  storageAvailable: true,
  ready: 0,
  eligible: 0,
  hasNameOnlyRooms: false,
  hasUnknownRooms: false,
  hasDeferredRooms: false,
  hasFailures: false,
};

export type ConversationSearchResult = {
  chat: LocalChat;
  subtitle: string;
};

export type ConversationSearchRequest = {
  query: string;
  /** Local display window, never a limit on the searchable universe. */
  limit?: number;
  signal?: AbortSignal;
};

export type ConversationSearchPage = {
  results: ConversationSearchResult[];
  total: number;
};
