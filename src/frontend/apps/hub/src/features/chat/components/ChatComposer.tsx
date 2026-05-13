import { ArrowUp } from "@gouvfr-lasuite/ui-kit/icons";
import { useTranslation } from "react-i18next";

export const ChatComposer = () => {
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
          placeholder={t("Your message")}
          aria-label={t("Message")}
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
