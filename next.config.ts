import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Orca previews proxy HTTP without the HMR WebSocket. The React debug
    // channel waits on that socket and otherwise blocks client hydration.
    reactDebugChannel: false,
  },
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
