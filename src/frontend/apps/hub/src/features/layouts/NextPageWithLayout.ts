import type { NextPage } from "next";
import type { AppProps } from "next/app";
import type { ReactElement, ReactNode } from "react";

/**
 * Page type that may expose a static `getLayout` function. `_app.tsx` reads
 * this to wrap the page in a persistent layout — see the Next.js
 * "Persistent Layouts" pattern (https://nextjs.org/docs/pages/building-your-application/routing/pages-and-layouts#with-typescript).
 * The layout instance lives above `<Component>` in the React tree, so it
 * survives navigations across page files instead of remounting.
 */
export type NextPageWithLayout<P = object, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

export type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};
