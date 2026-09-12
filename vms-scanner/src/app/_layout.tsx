/**
 * The root layout: read the keystore, then let the app route.
 *
 * TWO SPLASHES, IN SEQUENCE. The OS draws a still image from app.json while the
 * bundle loads -- it cannot animate, and it cannot know anything about the
 * keystore. As soon as React can paint, that hands over to `LaunchScreen`, which
 * plays the mark in and holds until the app is genuinely ready.
 *
 * The gate is BOTH conditions, whichever finishes last: the keystore has
 * answered AND the animation has ended. A fast keystore does not cut the
 * animation off part-way, and a slow one does not get hurried -- the launch
 * screen simply sits at its final frame until the read returns.
 *
 * Routing still cannot happen before the keystore answers, for the original
 * reason: an already-paired phone must never flash the pairing screen on a cold
 * start, which is alarming for a guard who has been scanning all morning.
 *
 * There is no tab bar and no header. The guard sees one screen, forever
 * (CLAUDE.md constraint #4).
 */
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";

import { LaunchScreen } from "@/components/LaunchScreen";
import { LocaleProvider, useLocale } from "@/i18n";
import { SessionProvider, useSession } from "@/session";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { loading } = useSession();
  /*
    The language is a THIRD condition on the same gate.

    It comes from the keystore too, so it lands a beat after the first frame.
    Without waiting, a phone set to Tetun would paint one English frame and then
    swap every word -- a visible flicker on every cold start. The launch
    animation is already covering this window for the device token, so waiting
    for one more read costs nothing that anybody sees.
  */
  const { ready: localeReady } = useLocale();
  const [introDone, setIntroDone] = useState(false);

  /*
    A FOURTH CONDITION, for the same reason as the third.

    The icons on the camera screen are glyphs in a font, and a font is loaded
    asynchronously. Without waiting, the one screen a guard ever sees paints its
    dock with two blank squares and fills them in a frame or two later. The
    launch animation is already covering this window, so the wait costs nothing
    anybody sees.

    `failed` counts as ready on purpose: a missing font must leave the guard
    with an unlabelled-but-working dock, never with an app that will not start.
  */
  const [iconsReady, iconsFailed] = useFonts(MaterialCommunityIcons.font);

  /*
    Hand over as soon as React can paint, not when the keystore answers.

    Waiting for `loading` would keep the OS splash sitting on top of the animated
    one and the animation would never be seen at all -- on a phone with a warm
    cache the keystore read finishes before the first frame, so the whole
    sequence would play underneath an opaque image.

    `setOptions` first, because it configures the hide that follows: a 220ms
    cross-fade rather than a cut, so the OS image dissolves into the identical
    background underneath it instead of blinking.
  */
  useEffect(() => {
    /*
      `setOptions` is unavailable in Expo Go, which warns about it on every
      launch. Expo Go owns its own splash screen and cannot hand over control of
      it, so the call is not merely unsupported there -- it has nothing to
      configure. Guarding it keeps the development console clean without
      changing what a real build does, where the fade is exactly what stops the
      OS image cutting to the animated screen.

      `hideAsync` is fine in Expo Go and still runs, so the launch animation
      plays in development too.
    */
    if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
      SplashScreen.setOptions({ duration: 220, fade: true });
    }
    SplashScreen.hideAsync();
  }, []);

  // Both, whichever is later. `introDone` latches, so a slow keystore holds the
  // finished frame rather than replaying anything.
  if (loading || !localeReady || !(iconsReady || iconsFailed) || !introDone) {
    return <LaunchScreen onFinish={() => setIntroDone(true)} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
      }}
    />
  );
}

export default function RootLayout() {
  return (
    /*
      `useSafeAreaInsets` throws without this provider -- "No safe area value
      available" -- and the camera screen reads the insets directly so its dock
      can clear the Android gesture bar. `initialWindowMetrics` hands the
      provider the insets the native side already knows at startup, so the first
      frame is laid out correctly instead of painting at zero and jumping.
    */
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SessionProvider>
        <LocaleProvider>
          <StatusBar style="light" />
          <Routes />
        </LocaleProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
