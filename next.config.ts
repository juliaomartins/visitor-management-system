import type { NextConfig } from "next";

/**
 * One environment variable, two consumers.
 *
 * The browser needs the backend origin at runtime to open the WebSocket, so it
 * has to be NEXT_PUBLIC_. Reusing that same value for the rewrite keeps a single
 * source of truth for "where is the server" — two variables that must agree is
 * two variables that will one day disagree, at an event, at 8am.
 */
const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_VMS_BACKEND_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.101.196.41', '192.168.0.63'],
  async rewrites() {
    // HTTP only. Next does not proxy WebSocket upgrades, so `ws://` goes direct
    // to the backend — see lib/api.ts.
    return [{ source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
