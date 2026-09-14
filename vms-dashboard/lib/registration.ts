/**
 * Public self-registration: the form's two calls, the pass it keeps, and the
 * admin switch.
 *
 * THE PUBLIC CALLS SEND NO CREDENTIAL. They go through the typed client for the
 * paths and shapes, but the backend views have no authenticator, so an admin's
 * token on the desk laptop is ignored and a visitor's phone never has one.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "@vms/contracts";

import { api } from "@/lib/api";
import { ensureAccessToken } from "@/lib/auth";

export type PublicRegistrationResult =
  components["schemas"]["PublicRegistrationResult"];
export type RegistrationSettings = components["schemas"]["RegistrationSettings"];

export const PUBLIC_STATUS_KEY = ["public-registration-status"] as const;
export const REGISTRATION_SETTINGS_KEY = ["registration-settings"] as const;

/** Why a submission failed, in terms the form can say something useful about. */
export type RegistrationFailure =
  | "closed"
  | "throttled"
  | "too_large"
  | "invalid"
  | "network"
  | "server";

export class RegistrationError extends Error {
  constructor(
    readonly kind: RegistrationFailure,
    /** DRF field messages on a 400, shown as the server wrote them. */
    readonly fields: Record<string, string[]> = {},
  ) {
    super(kind);
  }
}

/**
 * Whether the form is open.
 *
 * "NO ANSWER" AND "A BAD ANSWER" ARE DIFFERENT FAILURES, and the page must say
 * different things. A fetch that throws never reached the server -- the phone is
 * on the wrong network, and "check the Wi-Fi" is the right advice. A 404 or 500
 * DID reach it: the phone is fine and the server is the problem (a backend not
 * restarted after a deploy answers this route with 404). Telling a visitor to
 * check their Wi-Fi in that case sends them the wrong way.
 */
export async function fetchPublicRegistrationStatus(
  signal?: AbortSignal,
): Promise<boolean> {
  let outcome;
  try {
    outcome = await api.GET("/api/v1/public/registrations/status", { signal });
  } catch {
    throw new RegistrationError("network");
  }
  const { data, error } = outcome;
  if (error || !data) throw new RegistrationError("server");
  return data.enabled;
}

export async function submitPublicRegistration(values: {
  full_name: string;
  country: string;
  organization: string;
  photo: File;
}): Promise<PublicRegistrationResult> {
  const form = new FormData();
  form.append("full_name", values.full_name);
  form.append("country", values.country);
  form.append("organization", values.organization);
  form.append("photo", values.photo, "photo.jpg");

  let outcome;
  try {
    outcome = await api.POST("/api/v1/public/registrations", {
      // The body is already FormData; the browser sets the multipart boundary.
      body: form as unknown as components["schemas"]["PublicRegistrationRequest"],
      bodySerializer: (body) => body as unknown as FormData,
      headers: { "Content-Type": null },
    });
  } catch {
    throw new RegistrationError("network");
  }

  const { data, error, response } = outcome;
  if (data) return data;

  switch (response.status) {
    case 403:
      throw new RegistrationError("closed");
    case 413:
      throw new RegistrationError("too_large");
    case 429:
      throw new RegistrationError("throttled");
    case 400: {
      const fields: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(
        (error ?? {}) as Record<string, unknown>,
      )) {
        if (Array.isArray(value)) fields[key] = value.map(String);
        else if (typeof value === "string") fields[key] = [value];
      }
      throw new RegistrationError("invalid", fields);
    }
    default:
      throw new RegistrationError("server");
  }
}

/* ------------------------------------------------------------------ pass -- */

/**
 * The success screen's data, kept in `sessionStorage` for this tab only.
 *
 * A reload -- a phone locking, a swipe down -- must not cost the visitor their
 * QR and send them to the kiosk desk. Session storage survives that and is gone
 * when the tab closes. It is the visitor's own credential on their own phone;
 * the "never localStorage" rule is about the admin session and a shared laptop's
 * record of other people, and nothing here outlives the tab.
 *
 * If the browser refuses storage (some private modes), the pass lives in memory
 * for the life of the page -- the success screen still shows.
 */
const PASS_KEY = "vms.registration.pass";

export type StoredPass = PublicRegistrationResult & {
  /** The visitor's own cropped photo, as a data URL. Never fetched back. */
  photo: string | null;
};

const listeners = new Set<() => void>();
let memoryPass: string | null = null;

export function subscribePass(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readPass(): string | null {
  try {
    return window.sessionStorage.getItem(PASS_KEY) ?? memoryPass;
  } catch {
    return memoryPass;
  }
}

export function savePass(pass: StoredPass): void {
  memoryPass = JSON.stringify(pass);
  try {
    window.sessionStorage.setItem(PASS_KEY, memoryPass);
  } catch {
    // Kept in memory above.
  }
  listeners.forEach((listener) => listener());
}

export function parsePass(raw: string | null): StoredPass | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as StoredPass;
    return value.badge_token && value.badge_serial ? value : null;
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------- admin -- */

export function useRegistrationSettings() {
  return useQuery({
    queryKey: REGISTRATION_SETTINGS_KEY,
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/registration-settings", {
        signal,
      });
      if (error || !data) throw new Error("registration settings");
      return data;
    },
  });
}

/**
 * Flip the switch, optimistically.
 *
 * The switch moves the instant it is pressed; if the server refuses, it moves
 * back and the panel says so. Either way the query is refetched, so the panel
 * ends on the server's truth rather than on our guess.
 */
export function useSetPublicRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      await ensureAccessToken();
      const { data, error } = await api.PATCH("/api/v1/registration-settings", {
        body: { public_registration_enabled: enabled },
      });
      if (error || !data) throw new Error("registration settings");
      return data;
    },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: REGISTRATION_SETTINGS_KEY });
      const previous = queryClient.getQueryData<RegistrationSettings>(
        REGISTRATION_SETTINGS_KEY,
      );
      if (previous) {
        queryClient.setQueryData<RegistrationSettings>(REGISTRATION_SETTINGS_KEY, {
          ...previous,
          public_registration_enabled: enabled,
        });
      }
      return { previous };
    },
    onError: (_error, _enabled, context) => {
      if (context?.previous) {
        queryClient.setQueryData(REGISTRATION_SETTINGS_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: REGISTRATION_SETTINGS_KEY });
    },
  });
}
