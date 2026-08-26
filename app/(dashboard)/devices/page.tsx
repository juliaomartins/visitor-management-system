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
      <PairingCodeCard />

      <section className="rounded-lg border border-rule bg-card">
        <div className="border-b border-rule px-6 py-5">
          <h2 className="text-sm font-semibold tracking-tight text-ink-900">
            Paired devices
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Refreshes on its own. &ldquo;Last seen&rdquo; is the last request a
            device made, so it is how you tell a quiet door from a dead phone.
          </p>
        </div>

        {isPending ? (
          <p className="serial px-6 py-12 text-center text-xs text-ink-500">
            Loading…
          </p>
        ) : isError ? (
          <div className="px-6 py-12 text-center">
            <p className="font-medium text-revoked">Could not load devices</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">
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
