import {
  Error as ErrorIcon,
  Info,
  Warning,
} from "@gouvfr-lasuite/ui-kit/icons";
import clsx from "clsx";
import { ReactNode } from "react";

export type ToastVariant = "brand" | "error" | "warning";

export type ToastAction = {
  label: string;
  /** Invoked on click; the toast is then dismissed. */
  onClick: () => void;
};

export type ToastProps = {
  variant?: ToastVariant;
  message: ReactNode;
  /**
   * Secondary text rendered next to the message in a dimmer colour — the "15%"
   * slot in the Figma component. Optional.
   */
  sideText?: ReactNode;
  /**
   * Leading icon. Defaults to the variant's semantic icon; pass `null`/`false`
   * to render none, or any node to override.
   */
  icon?: ReactNode;
  /** Trailing action buttons ("See" / "Cancel" in the Figma component). */
  actions?: ToastAction[];
  /** Supplied by react-toastify; lets action buttons dismiss the toast. */
  closeToast?: () => void;
};

// Semantic default icons, tinted by the variant's primary content colour.
const DEFAULT_ICONS: Record<ToastVariant, ReactNode> = {
  brand: <Info />,
  error: <ErrorIcon />,
  warning: <Warning />,
};

/**
 * DINUM/DSFR toast surface (Figma UI kit, node 3003:1534). Renders the full
 * surface itself — react-toastify only positions and animates it (its own
 * chrome is neutralised in `styles/toast.scss`).
 */
export const Toast = ({
  variant = "brand",
  message,
  sideText,
  icon,
  actions,
  closeToast,
}: ToastProps) => {
  const resolvedIcon = icon === undefined ? DEFAULT_ICONS[variant] : icon;

  return (
    <div className={clsx("hub__toast", `hub__toast--${variant}`)}>
      <div className="hub__toast__row">
        <div className="hub__toast__content">
          {resolvedIcon != null && resolvedIcon !== false && (
            <span className="hub__toast__icon" aria-hidden="true">
              {resolvedIcon}
            </span>
          )}
          <div className="hub__toast__text">
            <span className="hub__toast__message">{message}</span>
            {sideText != null && (
              <span className="hub__toast__side">{sideText}</span>
            )}
          </div>
        </div>
        {actions && actions.length > 0 && (
          <div className="hub__toast__actions">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="hub__toast__action"
                onClick={() => {
                  action.onClick();
                  closeToast?.();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
