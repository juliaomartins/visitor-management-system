/**
 * The typed API client.
 *
 * Every path, parameter and response shape comes from `@vms/contracts`, which is
 * generated from the backend's OpenAPI schema. Nothing in the dashboard hand-writes
 * a type that mirrors a serializer — if a field is missing here, regenerate the
 * contracts rather than declaring it locally.
 *
 * `baseUrl` is empty on purpose: requests go to the dashboard's own origin and
 * Next.js rewrites them to the backend, so the browser never makes a cross-origin
 * call. See next.config.ts for why that matters.
 */
import { createVmsClient } from "@vms/contracts";
import type { components, paths } from "@vms/contracts";

import { clearSession, getAccessToken, refreshAccessToken } from "./auth";

export type Visitor = components["schemas"]["Visitor"];
export type VisitorCategory = components["schemas"]["CategoryEnum"];

/** Set only when talking to the backend directly, bypassing the proxy. */
const BASE_URL = process.env.NEXT_PUBLIC_VMS_API_ORIGIN ?? "";

/** Marks a request that has already been replayed, so a loop cannot form. */
const RETRY_MARKER = "x-vms-retried";

export const api = createVmsClient({ baseUrl: BASE_URL, getAccessToken });

api.use({
  async onResponse({ request, response }) {
    if (response.status !== 401) return response;

    // The auth endpoints own their own failures; refreshing in response to one
    // of them would be a loop with extra steps.
    const path = new URL(request.url, "http://dashboard.invalid").pathname;
    if (path.startsWith("/api/v1/auth")) return response;

    if (request.headers.get(RETRY_MARKER)) {
      clearSession();
      return response;
    }

    // Only replay what is safe to replay. A sent request with a body cannot be
    // cloned reliably, so mutations call ensureAccessToken() up front instead.
    if (request.method !== "GET" && request.method !== "HEAD") return response;

    if (!(await refreshAccessToken())) return response;

    const replay = new Request(request, { headers: new Headers(request.headers) });
    replay.headers.set(RETRY_MARKER, "1");
    replay.headers.set("Authorization", `Bearer ${getAccessToken() ?? ""}`);

    return fetch(replay);
  },
});

/** Query params the visitors list accepts, straight off the generated schema. */
export type VisitorListQuery = NonNullable<
  paths["/api/v1/visitors"]["get"]["parameters"]["query"]
>;
