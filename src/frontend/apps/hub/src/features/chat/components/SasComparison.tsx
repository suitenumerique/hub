import { useTranslation } from "react-i18next";

import type { ChatSecuritySnapshot } from "@/features/drivers/security";

import { sasEmojiName } from "../sasEmojiNames";

import { InlineEmoji } from "./InlineEmoji";

type SasComparisonProps = Pick<
  ChatSecuritySnapshot["verification"],
  "emojis" | "decimals"
>;

/** What both devices show: seven emojis, or three numbers without them. */
export const SasComparison = ({ emojis, decimals }: SasComparisonProps) => {
  const { t } = useTranslation();

  if (emojis) {
    return (
      <ol
        className="hub__security-sas"
        aria-label={t("The seven verification symbols")}
      >
        {emojis.map(([emoji, name], index) => (
          <li key={index}>
            <span aria-hidden="true">
              <InlineEmoji emoji={emoji} />
            </span>
            <span>{sasEmojiName(t, emoji, name)}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (decimals) {
    return (
      <p>
        {t(
          "This app uses three numbers instead of emojis. Compare all three in the same order.",
        )}{" "}
        <strong>{decimals.join(" · ")}</strong>
      </p>
    );
  }
  return (
    <p role="alert">
      {t("No compatible comparison code. Cancel and try again.")}
    </p>
  );
};
