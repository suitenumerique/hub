/* eslint-disable @typescript-eslint/no-explicit-any */
import i18n from "@/i18n/initI18n";
import { AppError } from "../errors/AppError";

export class APIError extends Error {
  data?: any;
  code: number;

  constructor(code: number, data?: any) {
    super();
    this.data = data;
    this.code = code;
  }
}

export const errorToString = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof APIError) {
    const data = error.data;
    if (typeof data === "string") {
      return data;
    }

    if (
      data?.errors &&
      Array.isArray(data?.errors) &&
      data?.errors?.length > 0
    ) {
      return data.errors[0].detail;
    }

    if (data) {
      return Object.entries(error.data)
        .map(([, value]) => `${value}`)
        .join("\n");
    }
    return i18n.t("api.error.unexpected");
  }
  if (error instanceof AppError) {
    return error.message;
  }
  return i18n.t("api.error.unexpected");
};
