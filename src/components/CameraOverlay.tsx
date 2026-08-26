/**
 * What sits on top of the camera preview.
 *
 * A framing box so the guard knows where to hold the badge, and a torch. Nothing
 * else — every pixel of chrome here is a pixel not showing the visitor's badge,
 * and anything tappable is something to tap by accident while holding a phone in
 * one hand.
 *
 * The frame corners are drawn rather than a full border: a closed rectangle reads
 * as a viewfinder the QR must fill exactly, which makes people fuss over
 * alignment. Corner brackets read as "somewhere in here", which is the truth.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { QueueIndicator } from "@/components/QueueIndicator";
import { colors, HIT_SIZE, radius, spacing } from "@/theme";

const FRAME_SIZE = 240;
const CORNER = 34;
const STROKE = 4;

export function CameraOverlay({
  torchOn,
  onToggleTorch,
  deviceName,
  hint,
  pending,
  syncing,
}: {
  torchOn: boolean;
  onToggleTorch: () => void;
  deviceName: string;
  hint: string;
  pending: number;
  syncing: boolean;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.top} pointerEvents="none">
        <Text style={styles.device} numberOfLines={1}>
          {deviceName}
        </Text>
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

      <View style={styles.bottom} pointerEvents="box-none">
        <Pressable
          onPress={onToggleTorch}
          accessibilityRole="switch"
          accessibilityState={{ checked: torchOn }}
          accessibilityLabel={torchOn ? "Turn the torch off" : "Turn the torch on"}
          hitSlop={12}
          style={({ pressed }) => [
            styles.torch,
            torchOn && styles.torchOn,
            pressed && styles.torchPressed,
          ]}
        >
          <Text style={[styles.torchLabel, torchOn && styles.torchLabelOn]}>
            {torchOn ? "Torch on" : "Torch"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
  },
  device: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    backgroundColor: "rgba(11,15,20,0.55)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
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
    backgroundColor: "rgba(11,15,20,0.55)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  bottom: {
    padding: spacing.lg,
    alignItems: "center",
  },
  torch: {
    minHeight: HIT_SIZE,
    minWidth: 132,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: HIT_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(11,15,20,0.65)",
  },
  torchOn: { backgroundColor: colors.text, borderColor: colors.text },
  torchPressed: { opacity: 0.75 },
  torchLabel: { color: colors.text, fontSize: 16, fontWeight: "700" },
  torchLabelOn: { color: colors.background },
});
