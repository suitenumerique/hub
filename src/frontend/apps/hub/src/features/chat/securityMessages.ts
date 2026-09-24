import type { TFunction } from "i18next";

import type { ChatSecurityFailureReason } from "@/features/drivers/security";

export const securityFailureMessage = (
  reason: ChatSecurityFailureReason,
  t: TFunction,
): string => {
  switch (reason) {
    case "network":
      return t(
        "The server could not be reached. Check your connection and try again.",
      );
    case "permission":
      return t(
        "The server denied this action. Check your access to this conversation or account.",
      );
    case "session":
      return t(
        "Your session is no longer valid. Reconnect your account and try again.",
      );
    case "rate-limited":
      return t(
        "The server is receiving too many requests. Wait a moment and try again.",
      );
    case "trust":
      return t(
        "The devices’ encryption could not be verified. Check encryption settings before retrying.",
      );
    case "storage":
      return t(
        "Encryption storage is unavailable in this browser. Check available storage and try again.",
      );
    case "unknown":
      return t("This action could not be completed. Please try again.");
  }
};
