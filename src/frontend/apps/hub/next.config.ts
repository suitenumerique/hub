import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: false,
  // Floating development badges cover the account menu or chat header actions.
  devIndicators: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
