import { useTranslation } from "react-i18next";

type UnlockStepperProps = {
  current: number;
  total: number;
};

/** The ui-kit has no stepper: its colours, as one bar per step. */
export const UnlockStepper = ({ current, total }: UnlockStepperProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="hub__message-unlock__stepper"
      role="img"
      aria-label={t("Step {{current}} of {{total}}", { current, total })}
    >
      {Array.from({ length: total }, (_, index) => (
        <span key={index} data-active={index < current} />
      ))}
    </div>
  );
};
