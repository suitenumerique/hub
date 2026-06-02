import { PostHogProvider } from "posthog-js/react";

import { useConfig } from "../config/ConfigProvider";

export const AnalyticsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { config } = useConfig();
  const posthogKey =
    typeof config?.POSTHOG_KEY === "string" && config.POSTHOG_KEY.length > 0
      ? config.POSTHOG_KEY
      : null;

  if (!posthogKey) {
    return children;
  }

  return (
    <PostHogProvider
      apiKey={posthogKey}
      options={{
        api_host: config?.POSTHOG_HOST,
        defaults: "2025-05-24",
        opt_out_useragent_filter:
          process.env.NEXT_PUBLIC_POSTHOG_TEST_MODE === "true",
        request_batching: process.env.NEXT_PUBLIC_POSTHOG_TEST_MODE !== "true",
      }}
    >
      {children}
    </PostHogProvider>
  );
};
