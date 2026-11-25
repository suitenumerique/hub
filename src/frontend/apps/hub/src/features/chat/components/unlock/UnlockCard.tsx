import clsx from "clsx";
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { UnlockStepper } from "./UnlockStepper";

/** Unlocking, comparing the emojis, then confirming on the other device. */
const STEP_COUNT = 3;

type UnlockCardProps = {
  title: string;
  text?: ReactNode;
  step?: number;
  hasFailed?: boolean;
  /** Buttons one below the other, at both ends of a row, or at its end. */
  actionsLayout?: "stack" | "spread" | "end";
  actions?: ReactNode;
  children?: ReactNode;
};

/** The look shared by every screen of the unlocking. */
export const UnlockCard = ({
  title,
  text,
  step,
  hasFailed = false,
  actionsLayout = "stack",
  actions,
  children,
}: UnlockCardProps) => {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <section className="hub__message-unlock__card" aria-labelledby={titleId}>
      <div className="hub__message-unlock__head">
        <div>
          {/* Focused when the screen changes: see `MessageUnlock`. */}
          <h1 id={titleId} tabIndex={-1}>
            {title}
          </h1>
          {text && <p>{text}</p>}
        </div>
        {step !== undefined && (
          <UnlockStepper current={step} total={STEP_COUNT} />
        )}
      </div>
      {children}
      {hasFailed && (
        <p className="hub__message-unlock__error" role="alert">
          {t(
            "This action could not be completed. Check your connection and try again.",
          )}
        </p>
      )}
      {actions && (
        <div
          className={clsx("hub__message-unlock__actions", {
            "hub__message-unlock__actions--spread": actionsLayout === "spread",
            "hub__message-unlock__actions--end": actionsLayout === "end",
          })}
        >
          {actions}
        </div>
      )}
    </section>
  );
};
