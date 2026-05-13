import { useRouter } from "next/router";
import { useEffect } from "react";

import { useAuth } from "@/features/auth/Auth";
import type { User } from "@/features/auth/types";

/**
 * Redirects to /home when the user is anonymous, returns the user otherwise.
 *
 * `user === undefined` means the auth bootstrap is still in flight: we leave
 * the caller render-null while waiting. `user === null` means the user is
 * confirmed anonymous, which is the only case that triggers the redirect.
 *
 * Pass `enabled: false` to opt-out of the redirect side-effect (used by
 * public-facing error pages so they stay reachable to anonymous users).
 */
export const useRequireAuth = (
  enabled: boolean = true,
): User | null | undefined => {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (enabled && user === null) {
      void router.replace("/home");
    }
  }, [enabled, user, router]);

  return user;
};
