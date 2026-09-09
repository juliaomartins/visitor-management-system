/**
 * Paired hardware: guard phones and the lobby screen.
 *
 * The device list is the only view into whether the doors are actually working
 * during the event, so it refetches on its own — a stale `last_seen_at` is worse
 * than no `last_seen_at`, because it reads as "the phone is fine" when the phone
 * may be flat in someone's pocket.
 */
import type { MessageKey } from "@/lib/locales";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { components } from "@vms/contracts";
import { ensureAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/visitors";

export type Device = components["schemas"]["Device"];
export type PairingCode = components["schemas"]["PairingCode"];
export type DeviceKind = components["schemas"]["KindEnum"];

/**
 * A device is expected to check in far more often than this while it is being
 * used, so silence for ten minutes means something is wrong — asleep, out of
 * range, or dead.
 */
export const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Frequent enough that "2 min ago" is true when read, cheap enough on a LAN to
 * leave running all day on a laptop at the registration desk.
 */
const DEVICE_POLL_MS = 15_000;

/*
  A KEY, NOT A WORD.

  This is a module constant in a data module -- there is no translator here and
  there should not be. Callers resolve it, which is also what lets the same kind
  read "Scanner" as a column value and "scanner" inside a sentence: those are
  different messages in every language, and one lowercased string cannot be
  both. `kindInlineKey` is the mid-sentence form.
*/
const DEVICE_KIND_KEY: Record<DeviceKind, MessageKey> = {
  scanner: "device.kind.scanner",
  screen: "device.kind.screen",
};

const DEVICE_KIND_INLINE_KEY: Record<DeviceKind, MessageKey> = {
  scanner: "device.kindInline.scanner",
  screen: "device.kindInline.screen",
};

export function kindLabelKey(kind: DeviceKind): MessageKey {
  return DEVICE_KIND_KEY[kind] ?? "device.kind.scanner";
}

export function kindInlineKey(kind: DeviceKind): MessageKey {
  return DEVICE_KIND_INLINE_KEY[kind] ?? "device.kindInline.scanner";
}

/**
 * A ticking clock, shared by everything that renders elapsed time.
 *
 * Reading `Date.now()` during render is impure and, worse, frozen: the label
 * would say "2 min ago" until something unrelated re-rendered the tree. One
 * source of "now" also keeps the page heading and the amber rows from
 * disagreeing about which devices are silent.
 */
export function useNow(intervalMs = 10_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

/** True when a device that ought to be reporting has gone quiet. */
export function isSilent(device: Device, now: number): boolean {
  if (device.is_active === false) return false;   // silence is expected
  if (!device.last_seen_at) return true;          // never checked in
  return now - new Date(device.last_seen_at).getTime() > STALE_AFTER_MS;
}

function fail(error: unknown, fallback: string): never {
  if (error && typeof error === "object") {
    const body = error as Record<string, unknown>;
    if (typeof body.detail === "string") throw new ApiError(body.detail);
  }
  throw new ApiError(fallback);
}

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: async ({ signal }) => {
      const { data, error } = await api.GET("/api/v1/devices", { signal });
      if (error) fail(error, "error.deviceLoad");
      return data;
    },
    refetchInterval: DEVICE_POLL_MS,
    // Keep polling with the laptop lid open but the window behind the browser —
    // the registration desk rarely has this tab in front.
    refetchIntervalInBackground: true,
  });
}

export function useCreatePairingCode() {
  return useMutation({
    mutationFn: async (kind: DeviceKind): Promise<PairingCode> => {
      await ensureAccessToken();

      const { data, error } = await api.POST("/api/v1/devices/pairing-code", {
        body: { kind },
      });
      if (error) fail(error, "error.pairingCode");
      return data;
    },
  });
}

export function useRevokeDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<Device> => {
      await ensureAccessToken();

      const { data, error } = await api.POST("/api/v1/devices/{id}/revoke", {
        params: { path: { id } },
      });
      if (error) fail(error, "error.deviceRevoke");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}
