/**
 * Is the server reachable, and a way to change it — before anything depends on it.
 *
 * A guard finds out the server is unreachable at the worst possible moment: with
 * a visitor in front of them and a badge already under the camera. This puts the
 * answer on screen beforehand, and the fix one tap away.
 *
 * RE-CHECKED ON FOCUS, not on an interval — coming back to this screen is the
 * moment somebody actually wants to know, and a timer here would keep the radio
 * awake for information nobody is reading. The camera screen passes an interval
 * to the same hook because it is looked at all day; see `useServerStatus`.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useT } from "@/i18n";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ServerStatusTag } from "@/components/ServerStatus";
import { useServerStatus } from "@/hooks/useServerStatus";
import { colors, HIT_SIZE, radius, spacing } from "@/theme";

export function ServerBar() {
  const t = useT();
  const { status } = useServerStatus();

  return (
    <View style={styles.row}>
      <ServerStatusTag status={status} />

      <Pressable
        onPress={() => router.push("/settings")}
        accessibilityRole="button"
        accessibilityLabel={t("server.settingsA11y")}
        hitSlop={12}
        style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons
          name="cog-outline"
          size={22}
          color={colors.textMuted}
        />
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
  gear: {
    width: HIT_SIZE - 12,
    height: HIT_SIZE - 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  pressed: { opacity: 0.6 },
});
