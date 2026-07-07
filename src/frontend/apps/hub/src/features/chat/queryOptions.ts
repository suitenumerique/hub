/**
 * Chat data is backed by a live driver stream. Once a slice has loaded, keep it
 * warm for the browser session: events patch/invalidate it explicitly, and
 * remounting a chat should not fall back to a cold loading state after the
 * default 5-minute TanStack Query GC window.
 */
export const CHAT_SESSION_QUERY_OPTIONS = {
  staleTime: Infinity,
  gcTime: Infinity,
} as const;
