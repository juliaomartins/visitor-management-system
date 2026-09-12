/**
 * What sits on top of the camera preview.
 *
 * Three bands, and nothing between them: a rail across the top for what this
 * phone IS, a framing box in the middle for where the badge goes, and a dock at
 * the foot for the two things a guard ever touches. Every pixel of chrome here
 * is a pixel not showing the visitor's badge, so anything that is not one of
 * those three has been left out.
 *
 * THE FRAME CORNERS ARE DRAWN RATHER THAN A FULL BORDER: a closed rectangle
 * reads as a viewfinder the QR must fill exactly, which makes people fuss over
 * alignment. Corner brackets read as "somewhere in here", which is the truth.
 *
 * WHY A DOCK AND NOT THREE FLOATING LINKS.
 *
 * The controls used to be a centred torch pill with two grey text links in the
 * corner beneath it, none of them clearing the Android gesture bar. Three
 * weights, three places, one of them destructive. They are now one object with a
 * known position: a thumb finds the bottom edge of a phone without looking, and
 * a guard watching a visitor's face is not looking. Each half is a ~170pt
 * target, which is what a gloved hand at a door needs.
 *
 * THE DESTRUCTIVE ACTION IS DELIBERATELY NOT IN IT. Unpair ends the shift for
 * this phone and can only be undone with a fresh code from the dashboard, so it
 * sits in the top rail, out of the thumb's resting arc, at tertiary weight. It
 * is a two-handed, look-at-the-screen action and it is now shaped like one. The
 * confirmation in front of it has not moved.
 *
 * INSETS, NOT GUESSES. Both bands are padded by `useSafeAreaInsets`, so the
 * dock clears the gesture bar on an edge-to-edge Android phone and the rail
 * clears the status bar and any notch — the camera preview stays full-bleed
 * underneath, which is where it belongs.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QueueIndicator } from "@/components/QueueIndicator";
import { serverStatusLook } from "@/components/ServerStatus";
import type { ServerStatus } from "@/hooks/useServerStatus";
import { useT } from "@/i18n";
import { colors, HIT_SIZE, radius, spacing } from "@/theme";

const FRAME_SIZE = 240;
const CORNER = 34;
const STROKE = 4;

const ICON = 26;

/** Slow enough to read as breathing rather than blinking. */
const PULSE_MS = 1100;

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function CameraOverlay({
  torchOn,
  onToggleTorch,
  deviceName,
  hint,
  pending,
  syncing,
  serverStatus,
  onOpenServer,
  onUnpair,
}: {
  torchOn: boolean;
  onToggleTorch: () => void;
  deviceName: string;
  hint: string;
  pending: number;
  syncing: boolean;
  serverStatus: ServerStatus;
  onOpenServer: () => void;
  onUnpair: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const server = serverStatusLook(serverStatus);
  const offline = serverStatus === "offline";

  const sideGutter = {
    paddingLeft: Math.max(insets.left, spacing.md),
    paddingRight: Math.max(insets.right, spacing.md),
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View
        style={[styles.rail, sideGutter, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <View style={styles.railRow} pointerEvents="box-none">
          <Text style={styles.device} numberOfLines={1}>
            {deviceName}
          </Text>

          <Pressable
            onPress={onUnpair}
            accessibilityRole="button"
            accessibilityLabel={t("camera.unpairA11y")}
            hitSlop={10}
            style={({ pressed }) => [styles.unpair, pressed && styles.unpairPressed]}
          >
            <MaterialCommunityIcons
              name="link-variant-off"
              size={15}
              color={colors.textMuted}
            />
            <Text style={styles.unpairLabel}>{t("unpair.confirm")}</Text>
          </Pressable>
        </View>

        <QueueIndicator pending={pending} syncing={syncing} />
      </View>

      <View style={styles.middle} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <Text style={styles.hint}>{hint}</Text>
      </View>

      <View
        style={[
          styles.dockRow,
          sideGutter,
          // The gesture bar is the floor, not the screen edge. A dock resting on
          // the edge is a dock the system swallows half the taps of.
          { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.sm },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.dock}>
          <DockButton
            icon={torchOn ? "flashlight" : "flashlight-off"}
            label={t(torchOn ? "camera.torchOn" : "camera.torch")}
            tint={torchOn ? colors.background : colors.text}
            onPress={onToggleTorch}
            accessibilityRole="switch"
            accessibilityState={{ checked: torchOn }}
            accessibilityLabel={t(
              torchOn ? "camera.turnTorchOff" : "camera.turnTorchOn",
            )}
            style={torchOn ? styles.segmentLit : undefined}
          />

          <View style={styles.divider} />

          <DockButton
            icon={server.icon}
            label={t(server.labelKey)}
            tint={server.tint}
            pulse={offline}
            onPress={onOpenServer}
            accessibilityRole="button"
            // The state is read out with the destination, because a screen
            // reader user gets none of the colour and none of the glyph.
            accessibilityLabel={`${t("server.settingsA11y")}. ${t(server.labelKey)}.`}
            style={offline ? styles.segmentAlarm : undefined}
          />
        </View>
      </View>
    </View>
  );
}

function DockButton({
  icon,
  label,
  tint,
  onPress,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  style,
  pulse = false,
}: {
  icon: IconName;
  label: string;
  tint: string;
  onPress: () => void;
  accessibilityRole: "button" | "switch";
  accessibilityLabel: string;
  accessibilityState?: { checked: boolean };
  style?: object;
  pulse?: boolean;
}) {
  /*
    THE ONLY THING ON THIS SCREEN THAT MOVES BY ITSELF.

    A dropped link is the one fault a guard cannot see any other way — the camera
    keeps working, badges keep queueing, and nothing looks wrong until somebody
    checks the dashboard. So it breathes, once a second, and nothing else does.
    Reduced motion leaves it lit and still, where the tint, the word and the
    broken-link glyph are already carrying the message on their own.
  */
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(1);

  useEffect(() => {
    if (pulse && !reduceMotion) {
      breath.value = withRepeat(withTiming(0.42, { duration: PULSE_MS }), -1, true);
    } else {
      cancelAnimation(breath);
      breath.value = 1;
    }
    return () => cancelAnimation(breath);
  }, [pulse, reduceMotion, breath]);

  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      android_ripple={{ color: "rgba(244,248,251,0.14)" }}
      style={({ pressed }) => [
        styles.segment,
        style,
        pressed && styles.segmentPressed,
      ]}
    >
      <Animated.View style={breathStyle}>
        <MaterialCommunityIcons name={icon} size={ICON} color={tint} />
      </Animated.View>
      <Text style={[styles.segmentLabel, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { gap: spacing.sm, alignItems: "flex-start" },
  railRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    gap: spacing.md,
  },
  device: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
    backgroundColor: "rgba(11,16,22,0.62)",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    overflow: "hidden",
  },

  // Tertiary by every measure the eye uses: no fill, a hairline, muted ink, and
  // the far corner from the thumb.
  unpair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(168,182,196,0.34)",
    backgroundColor: "rgba(11,16,22,0.5)",
  },
  unpairPressed: { opacity: 0.6 },
  unpairLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },

  middle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  frame: { width: FRAME_SIZE, height: FRAME_SIZE },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: colors.text,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: STROKE, borderLeftWidth: STROKE },
  topRight: { top: 0, right: 0, borderTopWidth: STROKE, borderRightWidth: STROKE },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: STROKE, borderLeftWidth: STROKE },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: STROKE,
    borderRightWidth: STROKE,
  },
  hint: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(11,16,22,0.62)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    overflow: "hidden",
  },

  dockRow: { alignItems: "stretch" },
  dock: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    borderColor: "rgba(244,248,251,0.16)",
    // Opaque enough to read in direct sun, transparent enough that the preview
    // is still visible behind it -- a badge held low is still in frame.
    backgroundColor: "rgba(11,16,22,0.82)",
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    minHeight: HIT_SIZE + 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  // iOS has no ripple; this is the press state there and a second cue on Android.
  segmentPressed: { backgroundColor: "rgba(244,248,251,0.1)" },
  // A lamp that is on is white, not gold -- gold is the revoked verdict and the
  // pending-queue pill, and a torch is neither of those things.
  segmentLit: { backgroundColor: colors.text },
  segmentAlarm: { backgroundColor: "rgba(242,65,65,0.16)" },
  segmentLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  divider: { width: 1, backgroundColor: "rgba(244,248,251,0.16)" },
});
