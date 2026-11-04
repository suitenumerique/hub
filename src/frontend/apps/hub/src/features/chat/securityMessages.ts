import type { TFunction } from "i18next";

import {
  type ChatSecurityFailureReason,
  ChatSecuritySendError,
} from "@/features/drivers/security";

/** Why a message could not be sent, or `fallback` for an ordinary failure. */
export const sendFailureMessage = (
  error: unknown,
  t: TFunction,
  fallback: string,
): string => {
  if (!(error instanceof ChatSecuritySendError)) {
    return fallback;
  }
  if (error.reason === "not-ready") {
    return t(
      "Verify this device and wait for its keys before sending messages.",
    );
  }
  if (error.reason === "send-failed") {
    return t(
      "The encrypted message was rejected or interrupted. Check your connection and device security, then try again.",
    );
  }
  return securityFailureMessage(error.reason, t);
};

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
