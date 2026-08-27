"use client";

import { useState } from "react";

import { useSetPageMeta } from "@/components/page-meta";
import { DeviceTable } from "@/components/devices/DeviceTable";
import { PairingCodeCard } from "@/components/devices/PairingCodeCard";
import { RevokeDeviceDialog } from "@/components/devices/RevokeDeviceDialog";
import { isSilent, useDevices, useNow, useRevokeDevice, type Device } from "@/lib/devices";
import { ApiError } from "@/lib/visitors";

export default function DevicesPage() {
  const { data, isPending, isError, error } = useDevices();
  const revoke = useRevokeDevice();
  const [confirming, setConfirming] = useState<Device | null>(null);

  const devices = data ?? [];

  // Same clock and same predicate as the table, so the heading and the amber rows
  // can never disagree about which devices are silent.
  const now = useNow();
  const silent = devices.filter((device) => isSilent(device, now)).length;

  useSetPageMeta({
    title: "Devices",
    subtitle:
      silent > 0
        ? `${silent} ${silent === 1 ? "device has" : "devices have"} not checked in recently`
        : "Guard phones and the lobby screen",
    count: data ? devices.length : undefined,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/*
        During the event this is the first thing worth knowing, so it is stated
        at the top rather than left to be spotted as an amber cell four rows
        down. It only appears when something is actually wrong.
      */}
      {silent > 0 ? (
        <p
          role="status"
          className="flex items-center gap-3 rounded-lg border border-vip/40 bg-vip-soft px-5 py-3.5 text-sm text-ink"
        >
          <span
            aria-hidden
            className="animate-pulse-dot h-2.5 w-2.5 shrink-0 rounded-full bg-vip"
          />
          <span>
            <span className="font-semibold">
              {silent} {silent === 1 ? "device is" : "devices are"} silent.
            </span>{" "}
            A door with no scans in ten minutes is either quiet or offline — walk
            over and check.
          </span>
        </p>
      ) : null}

      <PairingCodeCard />

      <section className="rounded-lg border border-line bg-card">
        <div className="border-b border-line px-6 py-5">
          <h2 className="display text-base font-semibold text-ink">
            Paired devices
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            Refreshes on its own. &ldquo;Last seen&rdquo; is the last request a
            device made, so it is how you tell a quiet door from a dead phone.
          </p>
        </div>

        {isPending ? (
          <p className="mono px-6 py-12 text-center text-xs text-ink-3">
            Loading…
          </p>
        ) : isError ? (
          <div className="px-6 py-12 text-center">
            <p className="display text-lg font-semibold text-revoked">Could not load devices</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">
              {error instanceof ApiError
                ? error.message
                : "The request failed before it reached the server."}
            </p>
          </div>
        ) : (
          <DeviceTable devices={devices} onRevoke={setConfirming} />
        )}
      </section>

      <RevokeDeviceDialog
        device={confirming}
        pending={revoke.isPending}
        error={revoke.error instanceof ApiError ? revoke.error.message : undefined}
        onConfirm={() => {
          if (!confirming) return;
          revoke.mutate(confirming.id, { onSuccess: () => setConfirming(null) });
        }}
        onCancel={() => {
          if (!revoke.isPending) {
            setConfirming(null);
            revoke.reset();
          }
        }}
      />
    </div>
  );
}
