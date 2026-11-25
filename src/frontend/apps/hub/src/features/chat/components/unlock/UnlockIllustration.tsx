import { Checkmark2 } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import { FluentEmoji } from "../FluentEmoji";

const EMOJIS = ["🌙", "🎸", "🐧"];

const DeviceEmojis = () => (
  <span className="hub__message-unlock__emojis">
    {EMOJIS.map((emoji) => (
      <FluentEmoji
        key={emoji}
        className="hub__message-unlock__emoji"
        emoji={emoji}
        decorative
      />
    ))}
  </span>
);

/** The same emojis on both devices: what unlocking the messages asks for. */
export const UnlockIllustration = () => {
  const { t } = useTranslation();

  return (
    <div className="hub__message-unlock__illustration" aria-hidden="true">
      <div className="hub__message-unlock__device" data-current="true">
        <div className="hub__message-unlock__laptop">
          <span className="hub__message-unlock__window-bar">
            <i />
            <i />
            <i />
          </span>
          <DeviceEmojis />
        </div>
        <span>{t("This computer")}</span>
      </div>
      <span className="hub__message-unlock__match">
        <Checkmark2 />
      </span>
      <div className="hub__message-unlock__device">
        <div className="hub__message-unlock__phone">
          <DeviceEmojis />
        </div>
        <span>{t("Your phone")}</span>
      </div>
    </div>
  );
};
