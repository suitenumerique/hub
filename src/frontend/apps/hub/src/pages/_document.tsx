import { Html, Head, Main, NextScript } from "next/document";

import { THEME_INIT_SCRIPT } from "@/features/theme/useTheme";

export default function Document() {
  return (
    <Html lang="en-US">
      <Head>
        <meta name="robots" content="noindex" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
