/**
 * How far behind the phone is.
 *
 * Absent entirely when the queue is empty — a permanent "0 pending" badge is
 * noise, and noise is what makes a guard stop reading the thing that matters.
 * It appears the moment a scan cannot be sent and goes when the last one lands,
 * so its presence alone is the signal.
 *
 * It sits in the top strip beside the device name, clear of the framing box, so
 * it never competes with the badge the guard is trying to line up.
 */
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/theme";

export function QueueIndicator({
  pending,
  syncing,
}: {
  pending: number;
  syncing: boolean;
}) {
  if (pending === 0) return null;

  return (
    <View
      style={styles.pill}
      accessibilityRole="text"
      accessibilityLabel={
        syncing
          ? `Syncing. ${pending} ${pending === 1 ? "scan" : "scans"} still pending.`
          : `${pending} ${pending === 1 ? "scan" : "scans"} pending sync.`
      }
    >
      <View style={[styles.dot, syncing && styles.dotSyncing]} />
      <Text style={styles.label}>
        {pending} {pending === 1 ? "scan" : "scans"}{" "}
        {syncing ? "syncing…" : "pending sync"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    // Amber, not red: nothing is lost, the phone is simply behind. Red here would
    // teach a guard to ignore red, which is the colour a revoked badge uses.
    backgroundColor: colors.revoked,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1A1000",
    opacity: 0.55,
  },
  dotSyncing: { opacity: 1 },
  label: {
    color: "#1A1000",
    fontSize: 13,
    fontWeight: "700",
  },
});
