/**
 * Thin openapi-fetch wrapper. The only hand-written file in this package.
 *
 * The LAN runs over http:// (CLAUDE.md constraint #9), so `baseUrl` is an
 * http origin such as `http://192.168.1.50:8000`.
 */
import createClient, { type Client, type ClientOptions } from "openapi-fetch";

import type { paths } from "./schema";

export type VmsClient = Client<paths>;

export interface VmsClientOptions extends ClientOptions {
  baseUrl: string;
  /** Admin JWT access token. Kept in memory only — never localStorage. */
  getAccessToken?: () => string | null | undefined;
  /** Device token for the scanner and the lobby screen. */
  deviceToken?: string;
}

/**
 * Build a typed client for the VMS API.
 *
 * Admin callers pass `getAccessToken`; paired devices pass `deviceToken`.
 * A caller supplying both sends the admin bearer token, which always wins.
 */
export function createVmsClient(options: VmsClientOptions): VmsClient {
  const { getAccessToken, deviceToken, ...clientOptions } = options;

  const client = createClient<paths>(clientOptions);

  client.use({
    onRequest({ request }) {
      const accessToken = getAccessToken?.();

      if (accessToken) {
        request.headers.set("Authorization", `Bearer ${accessToken}`);
      } else if (deviceToken) {
        request.headers.set("Authorization", `Device ${deviceToken}`);
      }

      return request;
    },
  });

  return client;
}
