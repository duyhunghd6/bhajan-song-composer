import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LAN browsers need the dev WebSocket to stay connected rather than retry/reload.
  allowedDevOrigins: ["10.0.1.143"],
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
