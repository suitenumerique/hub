import Link from "next/link";
import { useTranslation } from "react-i18next";

import { HubLayout } from "@/features/layouts/HubLayout";
import type { NextPageWithLayout } from "@/features/layouts/NextPageWithLayout";

const Forbidden: NextPageWithLayout = () => {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t("403 Forbidden")}</h1>
      <p>
        <Link href="/">{t("Back to home")}</Link>
      </p>
    </>
  );
};

Forbidden.getLayout = (page) => <HubLayout>{page}</HubLayout>;

export default Forbidden;
