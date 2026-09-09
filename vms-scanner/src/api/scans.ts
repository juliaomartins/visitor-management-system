/**
 * Recording a scan.
 *
 * `POST /scans` answers 200 for every badge it understands, with the verdict in
 * `result` — a revoked card is a business outcome, not an HTTP error. That keeps
 * the guard's phone showing a red screen instead of an error handler, and it means
 * a non-200 here is always a real problem: the network, the device token, or the
 * server itself.
 *
 * Rate limited to 30/min per device server-side. A real guard does about 10, and
 * the debounce in `useScanner` keeps a QR sitting in frame from spending that
 * budget.
 */
import type { components } from "@vms/contracts";

import { request } from "./client";

export type ScanResult = components["schemas"]["ResultEnum"];
export type ScanVisitor = components["schemas"]["ScanVisitor"];

export type ScanResponse = components["schemas"]["ScanResponse"];

export async function recordScan(
  badgeToken: string,
  options: { scannedAt?: Date; clientUuid?: string; signal?: AbortSignal } = {},
): Promise<ScanResponse> {
  return request<ScanResponse>("/api/v1/scans", {
    method: "POST",
    signal: options.signal,
    body: {
      token: badgeToken,
      // Sent by the device, not inferred by the server: the offline queue syncs
      // minutes later, and the time the badge was presented is the only one
      // worth recording.
      scanned_at: (options.scannedAt ?? new Date()).toISOString(),
      // The queue row's id. Sending it makes the call idempotent — a request
      // that landed but whose response was lost gets replayed on the next sync,
      // and the server returns the original scan instead of counting the guest
      // through twice.
      client_uuid: options.clientUuid,
    },
  });
}
