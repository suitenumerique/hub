import { PostHogProvider } from "posthog-js/react";

import { useConfig } from "../config/ConfigProvider";

/**
 * Parameters of the current URL that identify a conversation or an account,
 * and those of the sign-in redirect. PostHog receives them masked.
 */
const SENSITIVE_URL_PARAMETERS = ["account", "chat", "code", "state"];

export const AnalyticsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { config } = useConfig();
  const { id, host } = config.POSTHOG_KEY ?? {};

  // Both or nothing: without a host, the SDK would send to its US region.
  if (!id || !host) {
    return children;
  }

  const environment = config.ENVIRONMENT;
  const release = config.RELEASE;

  return (
    <PostHogProvider
      apiKey={id}
      options={{
        api_host: host,
        ui_host: "https://eu.posthog.com",
        defaults: "2025-05-24",
        // Only explicit events leave: a click must never send message content,
        // and a recording would hold decrypted messages.
        autocapture: false,
        disable_session_recording: true,
        // Separate from autocapture, and a project setting can turn it on: it
        // sends the text of an error.
        capture_exceptions: false,
        // As in Docs: Web Vitals stay out, whatever the project says.
        capture_performance: { web_vitals: false },
        cross_subdomain_cookie: false,
        mask_personal_data_properties: true,
        custom_personal_data_properties: SENSITIVE_URL_PARAMETERS,
        // Logs each event in the console. Elsewhere, `?__posthog_debug=true`
        // does the same, which passing `false` here would override.
        ...(environment === "development" ? { debug: true } : {}),
        opt_out_useragent_filter:
          process.env.NEXT_PUBLIC_POSTHOG_TEST_MODE === "true",
        request_batching: process.env.NEXT_PUBLIC_POSTHOG_TEST_MODE !== "true",
        loaded: (posthog) => posthog.register({ environment, release }),
      }}
    >
      {children}
    </PostHogProvider>
  );
};
