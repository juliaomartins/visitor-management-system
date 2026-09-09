/**
 * Pairing: the one call this app makes without a token.
 *
 * An admin generates a 6-character code on the dashboard, someone types it in
 * here, and the device gets a permanent token back. The token is returned once —
 * the server keeps only its digest — so it goes straight into the keystore.
 *
 * Rate limited to 5 per hour per IP on the server side. Every phone at the event
 * shares the router's address, so that budget is shared: do not retry in a loop.
 */
import * as Device from "expo-device";
import type { components } from "@vms/contracts";

import { request } from "./client";

type PairedDevice = components["schemas"]["DevicePaired"];

export const CODE_LENGTH = 6;

/**
 * Codes are drawn from an unambiguous alphabet (no 0/O/1/I) because they are read
 * off a laptop and typed into a phone. Normalising here means a guard who types a
 * lowercase o or a stray space still gets through.
 */
export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

/**
 * A name the dashboard can show in the device list, and the scan history can put
 * in its Device column. The server falls back to "Scanner 2" if this is blank,
 * which is accurate but tells nobody which door the phone is standing at.
 */
export function suggestedDeviceName(): string {
  const model = Device.modelName?.trim();
  return model ? `${model}` : "";
}

export async function pairDevice(
  code: string,
  name = suggestedDeviceName(),
): Promise<PairedDevice> {
  return request<PairedDevice>("/api/v1/devices/pair", {
    method: "POST",
    authenticated: false,
    body: { code: normaliseCode(code), name },
  });
}
