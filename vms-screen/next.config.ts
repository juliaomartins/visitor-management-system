import type { NextConfig } from "next";

/**
 * No `/api` rewrite here on purpose.
 *
 * A rewrite destination is fixed when this process boots, so it could not follow
 * the backend when DHCP moved it — the socket reconnected to the new address
 * while every HTTP call kept going to the old one. `/api/*` is served by the
 * route handler in app/api/[...path]/route.ts, which resolves the backend per
 * request. See lib/backend-target.ts.
 *
 * NEXT_PUBLIC_VMS_BACKEND_ORIGIN survives as the last-resort default for both
 * the client probe and that handler.
 */
const nextConfig: NextConfig = {
  /*
    Dev-only cross-origin asset allowance. Listing literal IPs here is the same
    trap as hardcoding the backend: it is wrong the next time the network
    changes. Private ranges are matched instead, which covers any LAN this is
    ever run on and nothing beyond it.
  */
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.2*.*.*",
    "172.30.*.*",
    "172.31.*.*",
    "*.local",
  ],
};

export default nextConfig;
