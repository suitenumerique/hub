import { useTranslation } from "react-i18next";

import { HubLayout } from "@/features/layouts/HubLayout";

export default function NewChatPage() {
  const { t } = useTranslation();

  return (
    <HubLayout>
      <p>{t("New discussion")}</p>
    </HubLayout>
  );
}
