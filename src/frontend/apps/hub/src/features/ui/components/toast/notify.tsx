import { Id, ToastOptions, toast } from "react-toastify";

import { Toast, ToastProps, ToastVariant } from "./Toast";

export type NotifyOptions = Omit<
  ToastProps,
  "message" | "variant" | "closeToast"
> & {
  /** Forwarded to react-toastify (autoClose, position, …). */
  toastOptions?: ToastOptions;
};

const show = (
  variant: ToastVariant,
  message: ToastProps["message"],
  { toastOptions, ...toastProps }: NotifyOptions = {},
): Id =>
  toast(
    ({ closeToast }) => (
      <Toast
        variant={variant}
        message={message}
        closeToast={closeToast}
        {...toastProps}
      />
    ),
    // The custom component draws its own surface, so suppress the library's
    // default close button (the Figma toast has none).
    { closeButton: false, ...toastOptions },
  );

/**
 * Show a toast that renders the DINUM/DSFR `Toast` component, one entry per
 * Figma variant. Mirrors react-toastify's `toast.*` ergonomics.
 */
export const notify = {
  brand: (message: ToastProps["message"], options?: NotifyOptions) =>
    show("brand", message, options),
  error: (message: ToastProps["message"], options?: NotifyOptions) =>
    show("error", message, options),
  warning: (message: ToastProps["message"], options?: NotifyOptions) =>
    show("warning", message, options),
};
