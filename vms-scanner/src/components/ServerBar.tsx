/**
 * Is the server reachable, and a way to change it — before anything depends on it.
 *
 * A guard finds out the server is unreachable at the worst possible moment: with
 * a visitor in front of them and a badge already under the camera. This puts the
 * answer on screen beforehand, and the fix one tap away.
 *
 * RE-CHECKED ON FOCUS, not on an interval. A poll would keep a radio awake all
 * day for information nobody is looking at; coming back to this screen is the
 * moment somebody actually wants to know.
 */
import { useT } from "@/i18n";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getApiOrigin, probeServer } from "@/api/client";
import { candidateOrigins } from "@/storage/server";
import { colors, HIT_SIZE, radius, spacing } from "@/theme";

type Status = "checking" | "online" | "offline";

/**
 * A real hook, and named like one on purpose.
 *
 * The linter rejects a plain async function called `useSomething` as a misplaced
 * hook, and it is right to -- but this one holds state and subscribes to focus,
 * so the name is honest.
 */
function useServerStatus(): Status {
  const [status, setStatus] = useState<Status>("checking");
  const alive = useRef(true);

  useFocusEffect(
    useCallback(() => {
      alive.current = true;

      void (async () => {
        setStatus("checking");

        /*
          THE DOT DESCRIBES THE ADDRESS THE APP IS ACTUALLY USING.

          It used to probe the first stored candidate instead, which is not the
          same thing: after a change in Settings the stored address was the new
          one while the client was still sending to the old one, so the bar went
          green at the exact moment scans were going nowhere. A status light
          that reports on something other than the live connection is worse than
          no status light -- it is the one thing on screen a guard would trust.

          Storage is still the fallback, for the moment before the first probe
          has resolved anything.
        */
        const target = getApiOrigin() || (await candidateOrigins())[0];
        if (!alive.current) return;

        if (!target) {
          setStatus("offline");
          return;
        }

        const health = await probeServer(target);
        if (!alive.current) return;
        setStatus(health ? "online" : "offline");
      })();

      return () => {
        alive.current = false;
      };
    }, []),
  );

  return status;
}

export function ServerBar() {
  const t = useT();
  const status = useServerStatus();

  const label =
    status === "checking"
      ? t("server.checking")
      : status === "online"
        ? t("server.online")
        : t("server.offline");

  const tint =
    status === "checking"
      ? colors.textFaint
      : status === "online"
        ? colors.valid
        : colors.invalid;

  return (
    <View style={styles.row}>
      <View style={styles.status} accessibilityRole="text">
        <View style={[styles.dot, { backgroundColor: tint }]} />
        <Text style={[styles.statusLabel, { color: tint }]}>{label}</Text>
      </View>

      <Pressable
        onPress={() => router.push("/settings")}
        accessibilityRole="button"
        accessibilityLabel={t("server.settingsA11y")}
        hitSlop={12}
        style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
      >
        {/* A drawn gear rather than an icon package. The app has no icon
            dependency and this does not justify adding one. */}
        <Text style={styles.gearGlyph}>⚙</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  gear: {
    width: HIT_SIZE - 12,
    height: HIT_SIZE - 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  gearGlyph: { color: colors.textMuted, fontSize: 22 },
  pressed: { opacity: 0.6 },
});
