import Link from "next/link";
import { useTranslation } from "react-i18next";

import { HubLayout } from "@/features/layouts/HubLayout";
import type { NextPageWithLayout } from "@/features/layouts/NextPageWithLayout";

const Unauthorized: NextPageWithLayout = () => {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t("401 Unauthorized")}</h1>
      <p>
        <Link href="/">{t("Back to home")}</Link>
      </p>
    </>
  );
};

Unauthorized.getLayout = (page) => (
  <HubLayout requireAuth={false}>{page}</HubLayout>
);

export default Unauthorized;
