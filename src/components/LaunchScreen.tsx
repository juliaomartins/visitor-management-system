/**
 * The animated launch screen, shown while the keystore is being read.
 *
 * This replaces a blank hold. The OS splash is a still image and cannot animate,
 * so the moment React can paint we hand over to this and the mark arrives under
 * its own power.
 *
 * A GUARD SEES THIS EVERY RESTART, which is the constraint that set every number
 * below. The whole sequence is 430ms. It is meant to feel like the app opening,
 * not like a title card -- anything with a hold in it becomes an obstacle by the
 * fifth time you see it during a shift.
 *
 * SHARED VALUES RATHER THAN CSS ANIMATIONS, deliberately. Reanimated 4's CSS
 * animations are the better default for a state-driven A-to-B transition and
 * would express the visuals here perfectly well. What they do not give is a
 * precise "the sequence has ended" signal on the JS side, and this screen has to
 * hand routing over at exactly that moment. A timer running alongside a CSS
 * animation would be a second source of truth that drifts the first time
 * somebody edits a duration. The animation callback cannot drift.
 *
 * `scheduleOnRN`, not `runOnJS`: the latter was removed in Reanimated 4.
 */
import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { colors, spacing } from "@/theme";

/*
  The beat map, in milliseconds.

  TEXT_DELAY is what makes it a sequence rather than a flash: the mark lands
  first and the words follow it, which is the order somebody reads them in. The
  two lines then carry a smaller stagger between themselves so the second reads
  as belonging to the first rather than as a separate element.

  Everything eases OUT. A launch animation that arrives at constant speed reads
  as a progress bar -- something you are waiting for -- rather than as the app
  presenting itself.
*/
const LOGO_FADE = 240;
const LOGO_SCALE = 420;
const TEXT_DELAY = 170;
const TEXT_STAGGER = 90;
const TEXT_DURATION = 260;

/** The last thing to finish, and therefore the gate. 170 + 90 + 260. */
const SEQUENCE_END = TEXT_DELAY + TEXT_STAGGER + TEXT_DURATION;

/**
 * The safety net, in milliseconds after mount.
 *
 * The gate is an animation callback, and a callback that never fires would leave
 * this screen up forever with the app unable to route. On a wall display that is
 * an embarrassment; on a guard's phone at a door it means they cannot scan, and
 * there is nobody at an event who can debug it. So a plain timer releases the
 * gate shortly after the sequence should have ended, whatever Reanimated did.
 */
const RELEASE_FALLBACK = SEQUENCE_END + 250;

const EASE = Easing.out(Easing.cubic);

export function LaunchScreen({ onFinish }: { onFinish: () => void }) {
  const reduceMotion = useReducedMotion();

  const logoOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const logoScale = useSharedValue(reduceMotion ? 1 : 0.92);
  const titleOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const titleShift = useSharedValue(reduceMotion ? 0 : 10);
  const subtitleOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const subtitleShift = useSharedValue(reduceMotion ? 0 : 10);

  /*
    `onFinish` is read through a ref so the effect never re-runs when the parent
    re-renders and hands down a new closure. Re-running would restart the
    sequence mid-flight, which on a slow keystore read would loop the animation
    for as long as the read took.
  */
  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (reduceMotion) {
      /*
        REDUCED MOTION SKIPS TO THE FINAL STATE, and releases immediately.
        Holding a motionless screen for 430ms to "respect the timing" would be a
        delay with nothing to show for it -- the setting asks for less motion,
        not for the same wait without the payoff.
      */
      finish.current();
      return;
    }

    logoOpacity.value = withTiming(1, { duration: LOGO_FADE, easing: EASE });
    logoScale.value = withTiming(1, { duration: LOGO_SCALE, easing: EASE });

    titleOpacity.value = withDelay(
      TEXT_DELAY,
      withTiming(1, { duration: TEXT_DURATION, easing: EASE }),
    );
    titleShift.value = withDelay(
      TEXT_DELAY,
      withTiming(0, { duration: TEXT_DURATION, easing: EASE }),
    );

    subtitleOpacity.value = withDelay(
      TEXT_DELAY + TEXT_STAGGER,
      withTiming(1, { duration: TEXT_DURATION, easing: EASE }),
    );

    // The gate hangs off the last movement in the sequence, so the two can never
    // disagree about when it ended.
    subtitleShift.value = withDelay(
      TEXT_DELAY + TEXT_STAGGER,
      withTiming(0, { duration: TEXT_DURATION, easing: EASE }, (completed) => {
        if (completed) scheduleOnRN(release);
      }),
    );

    function release() {
      finish.current();
    }

    const bail = setTimeout(release, RELEASE_FALLBACK);
    return () => clearTimeout(bail);
  }, [
    reduceMotion,
    logoOpacity,
    logoScale,
    titleOpacity,
    titleShift,
    subtitleOpacity,
    subtitleShift,
  ]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleShift.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleShift.value }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={logoStyle}>
        <Image
          source={require("../../assets/images/brand/drcc-event.png")}
          style={styles.mark}
          contentFit="contain"
          /* The mark is already on screen from the OS splash, so there is no
             fade-in to buy and a transition here would fight the animation. */
          transition={0}
        />
      </Animated.View>

      <Animated.Text style={[styles.title, titleStyle]}>
        Díli Regional Cooperative Conference
      </Animated.Text>
      <Animated.Text style={[styles.subtitle, subtitleStyle]}>
        Ministerial Dialogue 2026
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    /*
      TRANSPARENT, NOT A COLOUR OF ITS OWN.

      This screen paints no ground. It sits on the root view, whose colour is
      set once in app.json (`backgroundColor`), so the mark can never end up on
      a plate that disagrees with the app around it -- and there is one value to
      change rather than two that can drift apart.

      The app is also pinned to `userInterfaceStyle: "dark"`, so the OS never
      selects a light variant and the result is identical whichever appearance
      the phone is set to.
    */
    backgroundColor: "transparent",
    paddingHorizontal: spacing.xl,
  },
  mark: {
    // Matches `imageWidth` in the app.json splash config, so the handover from
    // the OS splash to this screen does not resize the artwork.
    width: 200,
    height: 200 * (419 / 628),
  },
  title: {
    marginTop: spacing.lg,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.6,
    textAlign: "center",
    textTransform: "uppercase",
  },
  subtitle: {
    marginTop: spacing.xs,
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.6,
    textAlign: "center",
    textTransform: "uppercase",
  },
});
