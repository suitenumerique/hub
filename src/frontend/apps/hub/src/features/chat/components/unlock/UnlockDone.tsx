import { useId } from "react";
import { useTranslation } from "react-i18next";

import { TchapLogoMark } from "@/features/layouts/LeftPanel/TchapLogo";

/** Shown for a moment, then the card leaves. */
export const UnlockDone = ({
  isHistoryComplete,
}: {
  isHistoryComplete: boolean;
}) => {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <section
      className="hub__message-unlock__card hub__message-unlock__card--done"
      aria-labelledby={titleId}
    >
      <TchapLogoMark className="hub__message-unlock__mark" />
      <div className="hub__message-unlock__head">
        <div role="status">
          <h1 id={titleId} tabIndex={-1}>
            {t("Your Tchap account is ready")}
          </h1>
          <p>{t("You can now read and reply to your messages.")}</p>
          {!isHistoryComplete && (
            <p>
              {t(
                "Some message history could not be recovered. Messages already recovered remain available.",
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
