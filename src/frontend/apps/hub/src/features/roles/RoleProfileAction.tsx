import { UserMenuItem } from "@gouvfr-lasuite/ui-components";
import { Edit } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";

import { useRoleControl } from "./RoleProfileProvider";

export const RoleProfileAction = ({ onOpen }: { onOpen?: () => void }) => {
  const { t } = useTranslation();
  const { editRole } = useRoleControl();
  return (
    <UserMenuItem
      label={t("My role")}
      icon={<Edit />}
      onClick={() => {
        onOpen?.();
        editRole();
      }}
    />
  );
};
