/**
 * Sound and haptics, one per verdict.
 *
 * This is the most important output in the app. A guard watches the visitor's
 * face, not the phone — they should know the answer before they look down, and
 * often without looking down at all. The colours on screen confirm what the hand
 * and the ear already reported.
 *
 * Each verdict gets a shape, not just a pitch: rising for accepted, low and buzzy
 * for refused, a repeated two-tone warning for revoked, one soft blip for a repeat
 * scan. They stay distinguishable through a noisy lobby and a jacket pocket.
 */
import { useAudioPlayer, type AudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo } from "react";
import { Platform } from "react-native";

import type { ScanResult } from "@/api/scans";

const SOUNDS = {
  valid: require("../../assets/sounds/valid.wav"),
  invalid: require("../../assets/sounds/invalid.wav"),
  revoked: require("../../assets/sounds/revoked.wav"),
  duplicate: require("../../assets/sounds/duplicate.wav"),
  queued: require("../../assets/sounds/queued.wav"),
} as const;

/**
 * Neither `error` nor `queued` is a verdict, and neither may sound like one.
 * `queued` in particular has to be impossible to mistake for `valid` — the badge
 * has not been checked by anything.
 */
export type FeedbackKind = ScanResult | "error" | "queued";

async function vibrate(kind: FeedbackKind): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    switch (kind) {
      case "valid":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "duplicate":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "queued":
        // A single medium tap: something happened, no decision was made.
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "revoked":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case "invalid":
      case "error":
        // Two heavy knocks. A single buzz reads as "done"; this reads as "stop".
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        }, 130);
        break;
    }
  } catch {
    // A phone with haptics disabled or unavailable must not break scanning.
  }
}

/**
 * Preloads all four sounds and returns a `play` function.
 *
 * The players are created once and reused: loading a file at the moment of the
 * scan adds a delay exactly where it is least affordable, and the guard would
 * hear the verdict after they had already read it.
 */
export function useScanFeedback() {
  const valid = useAudioPlayer(SOUNDS.valid);
  const invalid = useAudioPlayer(SOUNDS.invalid);
  const revoked = useAudioPlayer(SOUNDS.revoked);
  const duplicate = useAudioPlayer(SOUNDS.duplicate);
  const queued = useAudioPlayer(SOUNDS.queued);

  const players = useMemo<Record<FeedbackKind, AudioPlayer>>(
    () => ({
      valid,
      invalid,
      revoked,
      duplicate,
      queued,
      // A failure to reach the server is not the visitor's fault, but the guard
      // must not read it as "let them through". It borrows the refusal sound.
      error: invalid,
    }),
    [valid, invalid, revoked, duplicate, queued],
  );

  useEffect(() => {
    // Play through the earpiece/speaker even with the ringer switch silenced —
    // a guard on a silent phone still needs to hear the verdict.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    }).catch(() => {});
  }, []);

  return useCallback(
    (kind: FeedbackKind) => {
      vibrate(kind);

      const player = players[kind];
      if (!player) return;
      try {
        player.seekTo(0);
        player.play();
      } catch {
        // Audio focus can be held by another app; the haptic already fired.
      }
    },
    [players],
  );
}
