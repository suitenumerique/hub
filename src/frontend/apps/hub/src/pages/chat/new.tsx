import { useTranslation } from "react-i18next";

import { HubLayout } from "@/features/layouts/HubLayout";
import type { NextPageWithLayout } from "@/features/layouts/NextPageWithLayout";

const NewChatPage: NextPageWithLayout = () => {
  const { t } = useTranslation();
  return <p>{t("New discussion")}</p>;
};

NewChatPage.getLayout = (page) => <HubLayout>{page}</HubLayout>;

export default NewChatPage;
