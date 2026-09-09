"use client";

import { useState } from "react";

import { useSetPageMeta } from "@/components/page-meta";
import { useErrorText, useT } from "@/lib/i18n";
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
  const t = useT();
  const errorText = useErrorText();
  const now = useNow();
  const silent = devices.filter((device) => isSilent(device, now)).length;

  useSetPageMeta({
    title: t("nav.devices"),
    subtitle:
      silent > 0
        ? t(silent === 1 ? "devices.silentOne" : "devices.silentMany", {
            count: silent,
          })
        : t("devices.subtitleQuiet"),
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
          className="flex items-center gap-3 rounded-xl bg-vip-soft px-6 py-4 text-sm text-ink"
        >
          <span
            aria-hidden
            className="animate-pulse-dot h-2.5 w-2.5 shrink-0 rounded-full bg-vip"
          />
          <span>
            <span className="font-semibold">
              {t(silent === 1 ? "devices.alertOne" : "devices.alertMany", {
                count: silent,
              })}
            </span>{" "}
            {t("devices.alertBody")}
          </span>
        </p>
      ) : null}

      <PairingCodeCard />

      <section className="card">
        <div className="border-b border-line px-6 py-5">
          <h2 className="display text-base text-ink">
            {t("devices.paired")}
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            {t("devices.pairedBody")}
          </p>
        </div>

        {isPending ? (
          <p className="mono px-6 py-12 text-center text-xs text-ink-3">
            {t("common.loading")}
          </p>
        ) : isError ? (
          <div className="px-6 py-12 text-center">
            <p className="display text-lg text-revoked">
              {t("devices.loadFailed")}
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">
              {errorText(error, "visitors.requestFailed")}
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
