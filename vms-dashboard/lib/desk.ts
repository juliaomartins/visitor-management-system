/**
 * The walk-in desk: pair once, then register visitors and draw their QR.
 *
 * THE DESK TOKEN LIVES IN `localStorage`, AND THAT IS A DELIBERATE EXCEPTION to
 * the rule at the top of CLAUDE.md. The rule protects the admin session and the
 * visitors' photographs. This token reaches two routes -- create a visitor, draw
 * the QR for a badge token the holder already has -- and reaches nothing that
 * can read, list, edit or export anybody. It is the same trade the scanner makes
 * on web, and for the same reason: the desk must open tomorrow morning without
 * an admin walking over with a fresh code, so the token has to outlive the tab.
 *
 * It is revoked from `/devices` like a lost phone, and the page then says so and
 * asks to be paired again.
 */
import { createVmsClient } from "@vms/contracts";
import type { components } from "@vms/contracts";

import { api } from "@/lib/api";

export type DeskRegistration = components["schemas"]["DeskRegistrationResult"];
export type VisitorCategory = components["schemas"]["CategoryEnum"];

const TOKEN_KEY = "vms.desk.token";

/** Why a desk request failed, in terms the page can say something useful about. */
export type DeskFailure =
  | "unpaired"
  | "wrong_device"
  | "invalid"
  | "too_large"
  | "throttled"
  | "network"
  | "server";

export class DeskError extends Error {
  constructor(
    readonly kind: DeskFailure,
    /** DRF field messages on a 400, shown as the server wrote them. */
    readonly fields: Record<string, string[]> = {},
  ) {
    super(kind);
  }
}

/* ----------------------------------------------------------------- token -- */

const listeners = new Set<() => void>();
let memoryToken: string | null = null;

export function subscribeDeskToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readDeskToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    // A browser refusing storage still gets a working desk for this tab.
    return memoryToken;
  }
}

export function saveDeskToken(token: string): void {
  memoryToken = token;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Kept in memory above.
  }
  listeners.forEach((listener) => listener());
}

export function clearDeskToken(): void {
  memoryToken = null;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to remove.
  }
  listeners.forEach((listener) => listener());
}

/* ------------------------------------------------------------------ calls -- */

/** Set only when talking to the backend directly, bypassing the proxy. */
const BASE_URL = process.env.NEXT_PUBLIC_VMS_API_ORIGIN ?? "";

let cached: { token: string; client: ReturnType<typeof createVmsClient> } | null = null;

function deskClient(token: string) {
  if (cached?.token !== token) {
    cached = { token, client: createVmsClient({ baseUrl: BASE_URL, deviceToken: token }) };
  }
  return cached.client;
}

function failureFor(status: number): DeskFailure {
  switch (status) {
    case 401:
      return "unpaired"; // no token, unknown token, or revoked
    case 403:
      return "wrong_device"; // a real device of the wrong kind
    case 413:
      return "too_large";
    case 429:
      return "throttled";
    default:
      return "server";
  }
}

/**
 * Redeem a pairing code. Returns the permanent desk token.
 *
 * Goes through the shared client because `/devices/pair` takes no credential at
 * all -- it is the one route in the API that never has.
 */
export async function pairDesk(code: string, name: string): Promise<string> {
  let outcome;
  try {
    outcome = await api.POST("/api/v1/devices/pair", {
      body: { code: code.trim().toUpperCase(), name: name.trim() },
    });
  } catch {
    throw new DeskError("network");
  }

  const { data, error, response } = outcome;
  if (data?.token) return data.token;

  if (response.status === 400) {
    const fields: Record<string, string[]> = {};
    for (const [key, value] of Object.entries((error ?? {}) as Record<string, unknown>)) {
      if (Array.isArray(value)) fields[key] = value.map(String);
      else if (typeof value === "string") fields[key] = [value];
    }
    throw new DeskError("invalid", fields);
  }
  throw new DeskError(failureFor(response.status));
}

export async function registerWalkIn(values: {
  full_name: string;
  country: string;
  organization: string;
  category: VisitorCategory;
  photo: File;
}): Promise<DeskRegistration> {
  const token = readDeskToken();
  if (!token) throw new DeskError("unpaired");

  const form = new FormData();
  form.append("full_name", values.full_name);
  form.append("country", values.country);
  form.append("organization", values.organization);
  form.append("category", values.category);
  form.append("photo", values.photo, "photo.jpg");

  let outcome;
  try {
    outcome = await deskClient(token).POST("/api/v1/desk/registrations", {
      // The body is already FormData; the browser sets the multipart boundary.
      body: form as unknown as components["schemas"]["DeskRegistrationRequest"],
      bodySerializer: (body) => body as unknown as FormData,
      headers: { "Content-Type": null },
    });
  } catch {
    throw new DeskError("network");
  }

  const { data, error, response } = outcome;
  if (data) return data;

  if (response.status === 400) {
    const fields: Record<string, string[]> = {};
    for (const [key, value] of Object.entries((error ?? {}) as Record<string, unknown>)) {
      if (Array.isArray(value)) fields[key] = value.map(String);
      else if (typeof value === "string") fields[key] = [value];
    }
    throw new DeskError("invalid", fields);
  }
  if (response.status === 401) clearDeskToken();
  throw new DeskError(failureFor(response.status));
}

/**
 * The QR as an image, fetched with the desk token.
 *
 * Not an `<img src>`: the route needs two headers a plain image request cannot
 * send, so the page fetches it and renders the blob. That also keeps the badge
 * token out of anything that logs URLs.
 */
export async function fetchDeskQr(badgeToken: string): Promise<Blob> {
  const token = readDeskToken();
  if (!token) throw new DeskError("unpaired");

  let outcome;
  try {
    outcome = await deskClient(token).GET("/api/v1/desk/qr", {
      params: { header: { "X-Badge-Token": badgeToken } },
      parseAs: "blob",
    });
  } catch {
    throw new DeskError("network");
  }

  const { data, response } = outcome;
  if (data instanceof Blob) return data;
  if (response.status === 401) clearDeskToken();
  throw new DeskError(failureFor(response.status));
}
