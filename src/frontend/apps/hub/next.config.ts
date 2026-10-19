import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: false,
  // Floating development badges cover the account menu or chat header actions.
  devIndicators: false,
  // HTTPS development origin used to sign in to Tchap (`make run-tchap`).
  allowedDevOrigins: ["hub.localhost"],
  // The Tchap dev server builds apart, so it can run beside `yarn dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
