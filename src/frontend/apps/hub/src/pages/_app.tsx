import { CunninghamProvider } from "@gouvfr-lasuite/ui-kit";
import {
  MutationCache,
  Query,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import Head from "next/head";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import "@/i18n/initI18n";
import "../styles/globals.scss";

import { AnalyticsProvider } from "@/features/analytics/AnalyticsProvider";
import { APIError, errorToString } from "@/features/api/APIError";
import { Auth } from "@/features/auth/Auth";
import { ConfigProvider } from "@/features/config/ConfigProvider";
import type { AppPropsWithLayout } from "@/features/layouts/NextPageWithLayout";

const onError = (error: Error, query: unknown) => {
  if ((query as Query).meta?.noGlobalError) {
    return;
  }
  if (error instanceof APIError) {
    if (error.code === 401) {
      return;
    }
    if (error.code === 403 && !(query as Query).meta?.showErrorOn403) {
      return;
    }
  }
  console.error(errorToString(error));
};

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      onError(error, mutation),
  }),
  queryCache: new QueryCache({
    onError: (error, query) => onError(error, query),
  }),
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Persistent layouts: the page declares its layout via `getLayout`, and the
  // layout instance lives here (above `<Component>`) so it survives navigations
  // between pages instead of remounting on every route change.
  const getLayout = Component.getLayout ?? ((page) => page);

  return (
    <>
      <Head>
        <title>{t("LaSuite Hub")}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/assets/favicon.png" type="image/png" />
      </Head>
      <QueryClientProvider client={queryClient}>
        <CunninghamProvider currentLocale={i18n.language} theme="dsfr-light">
          <ConfigProvider>
            <AnalyticsProvider>
              <Auth>{getLayout(<Component {...pageProps} />)}</Auth>
            </AnalyticsProvider>
          </ConfigProvider>
        </CunninghamProvider>
        {process.env.NODE_ENV === "development" && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </>
  );
}
