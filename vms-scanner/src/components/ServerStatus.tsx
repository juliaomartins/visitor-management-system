/**
 * One look for the connection, wherever it is shown.
 *
 * The pairing screen shows it as a small tag; the camera screen shows it as half
 * the control dock. Both read this table, so green can never mean one thing in
 * one place and another somewhere else — and a guard who learns the light on one
 * screen has learned it on both.
 *
 * NEVER COLOUR ALONE. Every state carries three cues: the tint, a word, and a
 * different glyph for offline — a broken link is exactly the thing a red-green
 * colourblind guard must not have to take on faith, and the same rule already
 * governs the three scan verdicts.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { ServerStatus } from "@/hooks/useServerStatus";
import { useT } from "@/i18n";
import type { MessageKey } from "@/locales";
import { colors, radius, spacing } from "@/theme";

type Look = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  labelKey: MessageKey;
};

export function serverStatusLook(status: ServerStatus): Look {
  if (status === "online") {
    return { icon: "server-network", tint: colors.valid, labelKey: "server.online" };
  }
  if (status === "offline") {
    return {
      icon: "server-network-off",
      tint: colors.invalid,
      labelKey: "server.offline",
    };
  }
  return { icon: "server-network", tint: colors.textMuted, labelKey: "server.checking" };
}

/** The compact form, for screens where the connection is background information. */
export function ServerStatusTag({ status }: { status: ServerStatus }) {
  const t = useT();
  const look = serverStatusLook(status);

  return (
    <View style={styles.tag} accessibilityRole="text">
      <MaterialCommunityIcons name={look.icon} size={15} color={look.tint} />
      <Text style={[styles.label, { color: look.tint }]}>{t(look.labelKey)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  label: { fontSize: 12, fontWeight: "700" },
});
