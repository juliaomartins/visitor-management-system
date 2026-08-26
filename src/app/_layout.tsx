/**
 * The root layout: read the keystore, then let the app route.
 *
 * The splash stays up until the keystore has answered. Hiding it first would show
 * a flash of the pairing screen to an already-paired phone every cold start —
 * alarming for a guard who has been scanning all morning.
 *
 * There is no tab bar and no header. The guard sees one screen, forever
 * (CLAUDE.md constraint #4).
 */
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";

import { SessionProvider, useSession } from "@/session";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { loading } = useSession();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) {
    // Held behind the splash; painted in the app's own background so the handover
    // is not a white flash on an OLED screen in a dark lobby.
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
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
