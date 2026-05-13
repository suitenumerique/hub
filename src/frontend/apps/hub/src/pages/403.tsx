import Link from "next/link";
import { useTranslation } from "react-i18next";

import { HubLayout } from "@/features/layouts/HubLayout";

export default function Forbidden() {
  const { t } = useTranslation();
  return (
    <HubLayout>
      <h1>{t("403 Forbidden")}</h1>
      <p>
        <Link href="/">{t("Back to home")}</Link>
      </p>
    </HubLayout>
  );
}
