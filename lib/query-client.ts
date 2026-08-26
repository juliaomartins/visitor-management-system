/**
 * TanStack Query configuration.
 *
 * Server state lives here and only here — no global store mirrors it.
 *
 * The defaults assume the event: a laptop on a closed LAN, one or two admins, and
 * a registrar who alt-tabs between the badge printer and this table. Refetching on
 * window focus is exactly right in that setting, and the network is a switch away,
 * so a short stale time costs nothing and keeps a revoked badge from lingering on
 * screen as active.
 */
import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: true,
        // A 401 is handled by the client's refresh-and-replay, and anything still
        // failing after that is not going to fix itself on the third attempt.
        retry: 1,
      },
    },
  });
}

export const queryKeys = {
  visitors: (query: Record<string, unknown>) => ["visitors", query] as const,
  visitor: (id: string) => ["visitor", id] as const,
};
