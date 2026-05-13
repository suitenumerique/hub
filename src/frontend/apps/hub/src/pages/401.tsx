import Link from "next/link";
import { useTranslation } from "react-i18next";

import { HubLayout } from "@/features/layouts/HubLayout";

export default function Unauthorized() {
  const { t } = useTranslation();
  return (
    <HubLayout requireAuth={false}>
      <h1>{t("401 Unauthorized")}</h1>
      <p>
        <Link href="/">{t("Back to home")}</Link>
      </p>
    </HubLayout>
  );
}
