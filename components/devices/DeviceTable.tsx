"use client";

import { isSilent, kindLabel, useNow, type Device } from "@/lib/devices";

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

function relativeTime(iso: string, now: number): string {
  const elapsed = now - new Date(iso).getTime();

  if (elapsed < 0) return "just now";
  if (elapsed < 45_000) return "just now";

  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function DeviceTable({
  devices,
  onRevoke,
}: {
  devices: Device[];
  onRevoke: (device: Device) => void;
}) {
  const now = useNow();

  if (devices.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="display text-lg text-ink">No devices paired yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">
          Generate a code above, then enter it on the guard&rsquo;s phone or the
          lobby screen.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <Th>Device</Th>
            <Th>Kind</Th>
            <Th>Last seen</Th>
            <Th>State</Th>
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

      <td className="px-4 py-3 text-ink-2">{kindLabel(device.kind)}</td>

      <td className="px-4 py-3 whitespace-nowrap">
        {lastSeen ? (
          <span
            title={new Date(lastSeen).toLocaleString()}
            className={stale ? "font-medium text-vip" : "text-ink"}
          >
            {relativeTime(lastSeen, now)}
          </span>
        ) : (
          <span className={revoked ? "text-ink-3" : "font-medium text-vip"}>
            Never checked in
          </span>
        )}
        {stale ? (
          <span className="mt-0.5 block text-[11px] text-vip">
            {lastSeen ? "Silent — check the door" : "Not seen since pairing"}
          </span>
        ) : null}
      </td>

      <td className="px-4 py-3">
        {revoked ? (
          <span className="pill-status bg-revoked-soft text-revoked">
            REVOKED
          </span>
        ) : (
          <span className="pill-status bg-valid-soft text-valid">
            ACTIVE
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
            Revoke
          </button>
        )}
      </td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-xs font-medium text-ink-3">{children}</th>;
}
