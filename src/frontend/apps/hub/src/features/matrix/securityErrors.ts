import {
  ConnectionError,
  HTTPError,
  MatrixError,
} from "matrix-js-sdk/lib/http-api";

import {
  ChatSecuritySendError,
  type ChatSecurityFailureReason,
} from "@/features/drivers/security";

/** Classify failures without exposing SDK error messages or request URLs to UI. */
export const securityFailureReason = (
  error: unknown,
): ChatSecurityFailureReason => {
  if (error instanceof MatrixError) {
    if (["M_UNKNOWN_TOKEN", "M_MISSING_TOKEN"].includes(error.errcode ?? ""))
      return "session";
    if (error.errcode === "M_FORBIDDEN") return "permission";
    if (error.isRateLimitError()) return "rate-limited";
  }
  if (error instanceof ConnectionError) return "network";
  if (error instanceof HTTPError) {
    if (error.httpStatus === 401) return "session";
    if (error.httpStatus === 403) return "permission";
    if (error.httpStatus === 429) return "rate-limited";
    if ((error.httpStatus ?? 0) >= 500) return "network";
  }
  if (error instanceof Error) {
    if (["TimeoutError", "NetworkError"].includes(error.name)) return "network";
    if (
      ["QuotaExceededError", "InvalidStateError", "UnknownError"].includes(
        error.name,
      )
    )
      return "storage";
    if (
      [
        "UnknownDeviceError",
        "EncryptionError",
        "DecryptionKeyDoesNotMatchError",
      ].includes(error.name)
    )
      return "trust";
  }
  return "unknown";
};

export const securitySendError = (cause: unknown): ChatSecuritySendError => {
  if (cause instanceof ChatSecuritySendError) return cause;
  return new ChatSecuritySendError(securityFailureReason(cause), { cause });
};
