import { useTranslation } from "react-i18next";

import { useUserRoles } from "./useRoles";

export const RoleBadge = ({ role }: { role: string }) => {
  const { t } = useTranslation();
  if (!role) return null;
  const tone = ["PO", "PM", "DEV"].includes(role)
    ? role.toLowerCase()
    : "other";
  return (
    <span
      className={`hub__role-badge hub__role-badge--${tone}`}
      title={t("Role: {{role}}", { role })}
    >
      {role}
    </span>
  );
};

export const UserRoleBadge = ({ userId }: { userId: string }) => {
  const roles = useUserRoles([userId]);
  return <RoleBadge role={roles[userId] ?? ""} />;
};
