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
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";

import { LaunchScreen } from "@/components/LaunchScreen";
import { SessionProvider, useSession } from "@/session";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { loading } = useSession();
  const [introDone, setIntroDone] = useState(false);

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
    SplashScreen.setOptions({ duration: 220, fade: true });
    SplashScreen.hideAsync();
  }, []);

  // Both, whichever is later. `introDone` latches, so a slow keystore holds the
  // finished frame rather than replaying anything.
  if (loading || !introDone) {
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
    <SessionProvider>
      <StatusBar style="light" />
      <Routes />
    </SessionProvider>
  );
}
