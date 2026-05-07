import Link from "next/link";
import { useTranslation } from "react-i18next";

import { HomeLayout } from "@/features/layouts/HomeLayout";

export default function Forbidden() {
  const { t } = useTranslation();
  return (
    <HomeLayout>
      <h1>{t("403 Forbidden")}</h1>
      <p>
        <Link href="/">{t("Back to home")}</Link>
      </p>
    </HomeLayout>
  );
}
