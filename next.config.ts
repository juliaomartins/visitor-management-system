import path from "node:path";

import type { NextConfig } from "next";

/**
 * The backend is a separate origin (uvicorn on :8000) and emits no CORS headers —
 * django-cors-headers is not installed. Rather than ask the backend to change,
 * the dashboard proxies to it, so every browser request is same-origin:
 *
 *   - no CORS preflight on the Authorization header
 *   - the httpOnly refresh cookie is set and sent as a first-party cookie
 *   - visitor photos resolve, since DRF builds absolute URLs from the Host header
 *     and would otherwise point at :3000 with no route behind it
 *
 * Set VMS_BACKEND_ORIGIN to the server's LAN address for the event.
 */
const BACKEND_ORIGIN = process.env.VMS_BACKEND_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.101.196.41', '192.168.0.63'],
  
  // @vms/contracts ships TypeScript source, not a build.
  transpilePackages: ["@vms/contracts"],

  // The contracts package is a file: dependency symlinked to ../vms-contracts.
  // Without the monorepo root, the bundler refuses to follow a symlink that
  // leaves the app directory and cannot resolve it at all.
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
  },

  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` },
      { source: "/media/:path*", destination: `${BACKEND_ORIGIN}/media/:path*` },
    ];
  },
};

export default nextConfig;
