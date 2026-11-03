import { Tooltip } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";

// The design's shield outline, placed in its 20px box.
const SHIELD_PATH =
  "M14.1667 10.0004C14.1667 14.167 11.25 16.2504 7.78333 17.4587C7.6018 17.5202 7.40461 17.5173 7.225 17.4504C3.75 16.2504 0.833333 14.167 0.833333 10.0004V4.16704C0.833333 3.94603 0.921131 3.73407 1.07741 3.57779C1.23369 3.42151 1.44565 3.33371 1.66667 3.33371C3.33333 3.33371 5.41667 2.33371 6.86667 1.06704C7.04321 0.916207 7.26779 0.833333 7.5 0.833333C7.73221 0.833333 7.95679 0.916207 8.13333 1.06704C9.59167 2.34204 11.6667 3.33371 13.3333 3.33371C13.5543 3.33371 13.7663 3.42151 13.9226 3.57779C14.0789 3.73407 14.1667 3.94603 14.1667 4.16704V10.0004Z";

/**
 * Stands for a message still being decrypted: an animated shield instead of a
 * status text, so that it cannot be taken for what someone wrote.
 */
export const MessageDecrypting = () => {
  const { t } = useTranslation();
  const label = t("Decrypting message…");

  return (
    <Tooltip content={label} placement="top" className="hub__delayed-tooltip">
      <span className="hub__message-decrypting" role="img" aria-label={label}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <g transform="translate(2.5 0.833333)">
            <path className="hub__message-decrypting__track" d={SHIELD_PATH} />
            <path
              className="hub__message-decrypting__segment"
              d={SHIELD_PATH}
              pathLength={1}
            />
          </g>
        </svg>
      </span>
    </Tooltip>
  );
};
