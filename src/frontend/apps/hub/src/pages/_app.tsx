import {
  ContextMenuProvider,
  CunninghamProvider,
} from "@gouvfr-lasuite/ui-components";
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
import { ToastContainer } from "react-toastify";

import "react-toastify/ReactToastify.css";
import "@/i18n/initI18n";
import "../styles/globals.scss";

import { AnalyticsProvider } from "@/features/analytics/AnalyticsProvider";
import { APIError, errorToString } from "@/features/api/APIError";
import { Auth, prefetchCurrentUser } from "@/features/auth/Auth";
import { ChatEmptyIllustration } from "@/features/chat/components/ChatEmptyIllustration";
import { ConfigProvider } from "@/features/config/ConfigProvider";
import type { AppPropsWithLayout } from "@/features/layouts/NextPageWithLayout";
import { useLocales } from "@/i18n/useLocale";

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
  const currentLocale = useLocales();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    prefetchCurrentUser();
  }, []);

  // Persistent layouts: the page declares its layout via `getLayout`, and the
  // layout instance lives here (above `<Component>`) so it survives navigations
  // between pages instead of remounting on every route change.
  const getLayout = Component.getLayout ?? ((page) => page);

  return (
    <>
      <Head>
        <title>{t("LaSuite Tchap")}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/assets/favicon.png" type="image/png" />
      </Head>
      <div className="hub__desktop-app">
        <QueryClientProvider client={queryClient}>
          <CunninghamProvider currentLocale={currentLocale} theme="dsfr-light">
            {/* Renders the one right-click menu that every `ContextMenu` opens. */}
            <ContextMenuProvider>
              <ConfigProvider>
                <AnalyticsProvider>
                  <Auth>{getLayout(<Component {...pageProps} />)}</Auth>
                </AnalyticsProvider>
              </ConfigProvider>
            </ContextMenuProvider>
          </CunninghamProvider>
          <ToastContainer
            position="top-center"
            autoClose={5000}
            hideProgressBar
            newestOnTop
            closeOnClick
            pauseOnFocusLoss={false}
            theme="light"
          />
          {process.env.NODE_ENV === "development" && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </div>
      <section
        className="hub__small-screen"
        aria-labelledby="hub-small-screen-title"
      >
        <ChatEmptyIllustration variant="small-screen" />
        <div className="hub__small-screen__copy">
          <h1 id="hub-small-screen-title">{t("Screen too small")}</h1>
          <p>
            {t(
              "This app isn't available at this size yet. Use a computer or widen your window for now. We're working on support for smaller screens.",
            )}
          </p>
        </div>
      </section>
    </>
  );
}
