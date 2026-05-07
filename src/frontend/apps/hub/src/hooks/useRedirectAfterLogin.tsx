import { useEffect } from "react";

import { SESSION_STORAGE_REDIRECT_AFTER_LOGIN_URL } from "@/features/api/fetchApi";
import { useAuth } from "@/features/auth/Auth";

export const useRedirectAfterLogin = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (user) {
      const attemptedUrl = sessionStorage.getItem(
        SESSION_STORAGE_REDIRECT_AFTER_LOGIN_URL,
      );
      if (attemptedUrl) {
        sessionStorage.removeItem(SESSION_STORAGE_REDIRECT_AFTER_LOGIN_URL);
        window.location.href = attemptedUrl;
      } else {
        window.location.href = "/";
      }
    }
  }, [user]);
};
