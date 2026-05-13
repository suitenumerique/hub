import { CunninghamProvider } from "@gouvfr-lasuite/ui-kit";
import {
  MutationCache,
  Query,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import "@/i18n/initI18n";
import "../styles/globals.scss";

import { APIError, errorToString } from "@/features/api/APIError";
import { AnalyticsProvider } from "@/features/analytics/AnalyticsProvider";
import { Auth } from "@/features/auth/Auth";
import { ConfigProvider } from "@/features/config/ConfigProvider";

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
    onError: (error, _variables, _context, mutation) => onError(error, mutation),
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

export default function MyApp({ Component, pageProps }: AppProps) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

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
              <Auth>
                <Component {...pageProps} />
              </Auth>
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
