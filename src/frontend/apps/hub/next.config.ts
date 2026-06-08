import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle WASM files with ?url query string as assets
    // This is used by wasm-bindgen generated bindings
    config.module.rules.push({
      test: /\.wasm\?url$/,
      type: "asset/resource",
      generator: {
        filename: isServer ? "../static/wasm/[name]-[hash][ext]" : "static/wasm/[name]-[hash][ext]",
      },
    });

    // Handle standard WASM imports as WebAssembly modules
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
      exclude: /\.wasm\?url$/,
    });

    config.output.webassemblyModuleFilename =
      isServer ? "../static/wasm/[modulehash].wasm" : "static/wasm/[modulehash].wasm";

    return config;
  },
};

export default nextConfig;
