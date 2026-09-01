import { Button } from "@gouvfr-lasuite/ui-components";
import { Logout } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import { logout } from "../Auth";

export const LogoutButton = () => {
  const { t } = useTranslation();
  return (
    <Button
      variant="tertiary"
      color="neutral"
      icon={<Logout size={16} />}
      onClick={logout}
      fullWidth
    >
      {t("Logout")}
    </Button>
  );
};
