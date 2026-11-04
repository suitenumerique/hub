import Head from "next/head";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Footer,
  Hero,
  HomeGutter,
  MainLayout,
} from "@gouvfr-lasuite/ui-components";
import { Button } from "@gouvfr-lasuite/ui-components";

import { login, useAuth } from "@/features/auth/Auth";
import { useConfig } from "@/features/config/ConfigProvider";
import { useRedirectAfterLogin } from "@/hooks/useRedirectAfterLogin";
import { useThemeCustomization } from "@/hooks/useThemeCustomization";

export default function HomePage() {
  const { user } = useAuth();

  useRedirectAfterLogin();

  if (user) {
    return null;
  }

  return <HomePageContent />;
}

const HomePageContent = () => {
  const { t } = useTranslation();
  const { config } = useConfig();
  const footerCustomization = useThemeCustomization("footer");
  const [redirectFailed, setRedirectFailed] = useState(false);

  useEffect(() => {
    const checkSiteAndRedirect = async () => {
      if (!config?.FRONTEND_EXTERNAL_HOME_URL) {
        return;
      }
      try {
        await fetch(config.FRONTEND_EXTERNAL_HOME_URL, {
          method: "HEAD",
          mode: "no-cors",
        });
        window.location.replace(config.FRONTEND_EXTERNAL_HOME_URL);
      } catch (error) {
        console.warn("Site is not reachable:", error);
        setRedirectFailed(true);
      }
    };

    void checkSiteAndRedirect();
  }, [config?.FRONTEND_EXTERNAL_HOME_URL]);

  if (config?.FRONTEND_EXTERNAL_HOME_URL && !redirectFailed) {
    return null;
  }

  return (
    <div className="hub__home">
      <Head>
        <title>{t("LaSuite Tchap v2")}</title>
        <meta
          name="description"
          content={t(
            "LaSuite Tchap v2: create a group for your team or project and find its chat, shared files and video calls in one place. Add or remove a member in one click.",
          )}
        />
      </Head>

      <MainLayout
        enableResize
        hideLeftPanelOnDesktop
        icon={<div className="hub__header__logo" />}
      >
        <HomeGutter>
          <Hero
            logo={<div className="hub__logo-icon" />}
            banner=""
            title={t(
              "LaSuite Tchap v2: chat, files and video calls for your team, in one place.",
            )}
            subtitle={t(
              "Login to La Suite collaborative tools from one place. Soon, you will also be able to manage your account information here.",
            )}
            mainButton={
              <div className="c__hero__buttons">
                <Button onClick={() => login()} fullWidth>
                  {t("Login")}
                </Button>
              </div>
            }
          />
        </HomeGutter>
        <Footer {...footerCustomization} />
      </MainLayout>
    </div>
  );
};
