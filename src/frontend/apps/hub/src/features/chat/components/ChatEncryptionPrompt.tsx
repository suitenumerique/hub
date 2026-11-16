import { Button } from "@gouvfr-lasuite/ui-components";
import { Key } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import type { AccountId } from "@/features/drivers/types";
import { useSettings } from "@/features/settings/SettingsContext";

export const ChatEncryptionPrompt = ({
  accountId,
}: {
  accountId: AccountId;
}) => {
  const { t } = useTranslation();
  const { open } = useSettings();

  return (
    <div className="hub__encryption-prompt">
      <p role="status">{t("Set up encryption to send messages.")}</p>
      <Button
        size="small"
        variant="secondary"
        icon={<Key aria-hidden="true" />}
        onClick={(event) =>
          open("encryption", { accountId, trigger: event.currentTarget })
        }
      >
        {t("Open encryption settings")}
      </Button>
    </div>
  );
};
