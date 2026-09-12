"use client";

import { AppearancePanel } from "@/components/settings/AppearancePanel";
import { ServerPanel } from "@/components/settings/ServerPanel";
import { useSetPageMeta } from "@/components/page-meta";
import { useHealth } from "@/lib/health";
import { useT } from "@/lib/i18n";

/**
 * Settings: this server, and how this dashboard looks.
 *
 * Two panels and no more. Everything else that gets called "settings" in an
 * app like this either lives somewhere better already -- devices pair on
 * `/devices`, a badge stops scanning from the visitor's own page -- or would
 * need somewhere to persist, and this backend has no preferences model. Adding
 * one to hold a theme that already lives in `localStorage` would be a migration
 * bought with nothing.
 *
 * SINGLE COLUMN, and narrow. The dashboard puts panels side by side because it
 * is scanned; this page is read, so it keeps line lengths short enough to read
 * and stacks in the order the two panels matter: the server first, because that
 * is the one somebody opens this page for on the morning of the event.
 *
 * THE PAGE OWNS THE QUERY and the panels take props. That is how the charts on
 * `/dashboard` are wired, and it is what lets both panels be rendered with
 * fixed data in a throwaway route and photographed -- including the two states
 * that never appear when you want them to: backend unreachable, and clocks
 * badly apart.
 */
export default function SettingsPage() {
  const t = useT();
  const health = useHealth();

  useSetPageMeta({
    title: t("settings.title"),
    subtitle: t("settings.subtitle"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ServerPanel
        health={health.data}
        checking={health.isFetching}
        onCheckAgain={() => health.refetch()}
      />
      <AppearancePanel />
    </div>
  );
}
