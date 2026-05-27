import { ArrowUp } from "@gouvfr-lasuite/ui-kit/icons";
import { useTranslation } from "react-i18next";

type ChatComposerProps = {
  /** Input placeholder. Defaults to the conversation composer wording. */
  placeholder?: string;
  /** Accessible name of the input. Defaults to "Message". */
  inputLabel?: string;
};

export const ChatComposer = ({
  placeholder,
  inputLabel,
}: ChatComposerProps) => {
  const { t } = useTranslation();

  return (
    <form
      className="hub__chat-composer"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="hub__chat-composer__field">
        <input
          type="text"
          className="hub__chat-composer__input"
          placeholder={placeholder ?? t("Your message")}
          aria-label={inputLabel ?? t("Message")}
        />
      </div>
      <div className="hub__chat-composer__actions">
        <button type="button" className="hub__chat-composer__attach">
          <span className="material-icons" aria-hidden="true">
            attach_file
          </span>
          <span className="hub__chat-composer__attach-label">
            {t("Attach a file")}
          </span>
        </button>
        <button
          type="submit"
          className="hub__chat-composer__send"
          aria-label={t("Send message")}
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </form>
  );
};
