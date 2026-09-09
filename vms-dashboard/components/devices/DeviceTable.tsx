"use client";

import { isSilent, kindLabelKey, useNow, type Device } from "@/lib/devices";
import { useFormat, useT } from "@/lib/i18n";

/**
 * The device list, which during the event is really a health check.
 *
 * `last_seen_at` is the operational signal: it is the difference between "the
 * north door is quiet because nobody has arrived" and "the north door phone is
 * face-down on a table with a flat battery". So it is shown as elapsed time
 * rather than a clock reading — nobody at a registration desk wants to subtract
 * timestamps — and anything past ten minutes is called out in amber.
 *
 * A device that has never checked in is its own case, and says so. A newly paired
 * phone that has not scanned yet is normal; the same phone still saying "never"
 * an hour later is not.
 */

/*
  THE HAND-ROLLED ELAPSED-TIME LADDER IS GONE.

  It built "5 min ago" and "2 hours ago" with its own singular/plural test --
  three languages' worth of grammar to maintain by hand for something Intl
  already knows, and certain to be wrong in Tetun on the first morning. It now
  comes from `useFormat().relative`, which is also where the pt-PT fallback for
  Tetun lives.
*/

export function DeviceTable({
  devices,
  onRevoke,
}: {
  devices: Device[];
  onRevoke: (device: Device) => void;
}) {
  const t = useT();
  const now = useNow();

  if (devices.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="display text-lg text-ink">{t("devices.none")}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">
          {t("devices.noneBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <Th>{t("devices.col.device")}</Th>
            <Th>{t("devices.col.kind")}</Th>
            <Th>{t("devices.col.lastSeen")}</Th>
            <Th>{t("devices.col.state")}</Th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              now={now}
              onRevoke={() => onRevoke(device)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceRow({
  device,
  now,
  onRevoke,
}: {
  device: Device;
  now: number;
  onRevoke: () => void;
}) {
  const t = useT();
  const format = useFormat();
  const revoked = device.is_active === false;
  const lastSeen = device.last_seen_at;
  const stale = isSilent(device, now);

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3">
        <p className={`font-medium ${revoked ? "text-ink-3" : "text-ink"}`}>
          {device.name}
        </p>
      </td>

      <td className="px-4 py-3 text-ink-2">
        {t(kindLabelKey(device.kind))}
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        {lastSeen ? (
          <span
            title={format.dateTime(lastSeen)}
            className={stale ? "font-medium text-vip" : "text-ink"}
          >
            {format.relative(lastSeen, now)}
          </span>
        ) : (
          <span className={revoked ? "text-ink-3" : "font-medium text-vip"}>
            {t("devices.neverCheckedIn")}
          </span>
        )}
        {stale ? (
          <span className="mt-0.5 block text-[11px] text-vip">
            {t(
              lastSeen
                ? "devices.silentCheck"
                : "devices.notSeenSincePairing",
            )}
          </span>
        ) : null}
      </td>

      <td className="px-4 py-3">
        {revoked ? (
          <span className="pill-status bg-revoked-soft text-revoked">
            {t("devices.stateRevoked")}
          </span>
        ) : (
          <span className="pill-status bg-valid-soft text-valid">
            {t("devices.stateActive")}
          </span>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        {revoked ? null : (
          <button
            type="button"
            onClick={onRevoke}
            className="btn btn-ghost px-3 py-1.5 text-revoked hover:text-revoked"
          >
            {t("devices.revoke")}
          </button>
        )}
      </td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-xs font-medium text-ink-3">{children}</th>;
}
