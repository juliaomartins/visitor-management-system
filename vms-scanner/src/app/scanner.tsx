/**
 * The only screen a guard ever sees.
 *
 * Camera fills the screen, verdict covers it, camera returns. There is no header,
 * no tab bar and no way to navigate away by accident — a guard who taps into a
 * menu mid-queue is a guard not scanning.
 *
 * Every scan is written to SQLite before the network is touched, so a router
 * hiccup costs nothing but a delay. `useSyncQueue` drains the backlog on a timer,
 * on foreground and on network return; the pill in the overlay says how far
 * behind the phone is.
 */
import { useT } from "@/i18n";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CameraOverlay } from "@/components/CameraOverlay";
import { useScanFeedback } from "@/components/ScanFeedback";
import {
  ScanErrorCard,
  ScanQueuedCard,
  ScanResultCard,
} from "@/components/ScanResultCard";
import { ServerSetup } from "@/components/ServerSetup";
import { useScanner } from "@/hooks/useScanner";
import { useServer } from "@/hooks/useServer";
import { useServerStatus } from "@/hooks/useServerStatus";
import { useSyncQueue } from "@/hooks/useSyncQueue";
import { useSession } from "@/session";
import { clearAll, initQueue } from "@/storage/queue";
import { colors, HIT_SIZE, radius, spacing } from "@/theme";

/**
 * How often the connection light re-asks, while this screen is in front and the
 * app is awake.
 *
 * `/api/v1/health` is unauthenticated, answers in a few bytes and is not
 * throttled, so four calls a minute cost the LAN nothing next to the scanner's
 * own 30/min budget. The number that matters is the other one: a guard should
 * learn the server has gone within seconds of it going, not at the next badge.
 */
const SERVER_POLL_MS = 15_000;

export default function ScannerScreen() {
  const t = useT();
  const { device, forget } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);

  const server = useServer();
  const { status, sync, refresh } = useSyncQueue();
  const connection = useServerStatus(SERVER_POLL_MS);
  const { state, onBarcodeScanned, dismiss } = useScanner(refresh);
  const play = useScanFeedback();

  // Open the database before the first badge appears, not during it.
  useEffect(() => {
    initQueue().catch(() => {});
  }, []);

  /*
    The session ended under this screen — the phone was revoked from the
    dashboard, so `request()` saw a 401 and the session provider dropped it.

    Leave for the pairing form. Without this the camera would keep firing at
    badges and every scan would fail the same way, which reads to a guard as a
    broken app rather than as a phone that needs a new code. Anything already
    queued stays on disk and syncs after the next pairing.
  */
  useEffect(() => {
    if (!device) router.replace("/pair");
  }, [device]);

  // Fire feedback once per verdict, keyed on the event id. Reacting to `state`
  // alone would replay the sound on every unrelated re-render.
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (state.phase === "result") {
      const key = `result:${state.response.event_id}`;
      if (announced.current !== key) {
        announced.current = key;
        play(state.response.result);
      }
    } else if (state.phase === "queued") {
      const key = `queued:${state.scannedAt.getTime()}`;
      if (announced.current !== key) {
        announced.current = key;
        play("queued");
      }
    } else if (state.phase === "error") {
      const key = `error:${state.message}`;
      if (announced.current !== key) {
        announced.current = key;
        play("error");
      }
    } else {
      announced.current = null;
    }
  }, [state, play]);

  // Release the camera when the app is backgrounded, and kill the torch with it —
  // a phone pocketed with the light on cooks its battery before the lunch rush.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      const active = next === "active";
      setCameraActive(active);
      if (!active) setTorchOn(false);
    });
    return () => subscription.remove();
  }, []);

  /*
    A scan that could not be sent is the strongest evidence there is that the
    server has gone, and it arrives sooner than the next poll would. So the
    light is re-checked the moment the queue stops draining, rather than leaving
    a green dot over a phone that has just failed to reach anything.
  */
  const backlog = status.pending > 0;
  const { recheck } = connection;

  useEffect(() => {
    if (backlog) recheck();
  }, [backlog, recheck]);

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      onBarcodeScanned(data);
    },
    [onBarcodeScanned],
  );

  function confirmUnpair() {
    Alert.alert(
      t("unpair.title"),
      t("unpair.body"),
      [
        { text: t("unpair.keep"), style: "cancel" },
        {
          text: t("unpair.confirm"),
          style: "destructive",
          onPress: async () => {
            // A phone handed back must not carry the guest list or unsent scans
            // home with it.
            await clearAll().catch(() => {});
            await forget();
            router.replace("/pair");
          },
        },
      ],
    );
  }

  if (!permission) {
    return <View style={styles.blank} />;
  }

  // The server moved and none of the known addresses answer. Scans already queued
  // are safe on this phone and will sync once it is reachable again.
  if (server.lost) {
    return (
      <ServerSetup
        attempted={server.attempted}
        onAdopt={server.adopt}
        onRetry={server.rescan}
        searching={server.searching}
      />
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permission}>
        <View style={styles.permissionBody}>
          <Text style={styles.permissionTitle}>{t("camera.off")}</Text>
          <Text style={styles.permissionText}>
            {t("camera.why")}
          </Text>
        </View>
        <Pressable
          onPress={requestPermission}
          accessibilityRole="button"
          android_ripple={{ color: "rgba(255,255,255,0.18)" }}
          style={({ pressed }) => [styles.allow, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons
            name={permission.canAskAgain ? "camera-outline" : "cog-outline"}
            size={22}
            color={colors.onAccent}
          />
          <Text style={styles.allowLabel}>
            {t(
              permission.canAskAgain
                ? "camera.allow"
                : "camera.openSettings",
            )}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const scanning = state.phase === "idle";

  return (
    <View style={styles.root}>
      {cameraActive ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchOn}
          // Only QR. Letting the reader chase EAN and PDF417 as well costs frames
          // and invites a stray barcode on a conference tote to register as a scan.
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          // Detaching the handler while a verdict is up stops the native reader
          // reporting at all, rather than reporting into a closed gate.
          onBarcodeScanned={scanning ? handleBarcode : undefined}
        />
      ) : (
        <View style={StyleSheet.absoluteFill} />
      )}

      <CameraOverlay
        torchOn={torchOn}
        onToggleTorch={() => setTorchOn((on) => !on)}
        deviceName={device?.name ?? t("camera.fallbackName")}
        pending={status.pending}
        syncing={status.syncing}
        hint={
          state.phase === "sending" ? t("camera.checking") : t("camera.hint")
        }
        serverStatus={connection.status}
        onOpenServer={() => router.push("/settings")}
        onUnpair={confirmUnpair}
      />

      {state.phase === "result" ? (
        <ScanResultCard response={state.response} onDismiss={dismiss} />
      ) : null}

      {state.phase === "queued" ? (
        <ScanQueuedCard
          visitor={state.visitor}
          scannedAt={state.scannedAt}
          onDismiss={dismiss}
        />
      ) : null}

      {state.phase === "error" ? (
        <ScanErrorCard
          message={state.message}
          recoverable={state.recoverable}
          // Retry drains the queue rather than re-scanning: the badge is already
          // saved, and sending it again would record it twice.
          onRetry={() => {
            sync();
            dismiss();
          }}
          onDismiss={dismiss}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  blank: { flex: 1, backgroundColor: colors.background },

  permission: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  permissionBody: { flex: 1, justifyContent: "center", gap: spacing.md },
  permissionTitle: { color: colors.text, fontSize: 28, fontWeight: "800" },
  permissionText: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  allow: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: HIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pressed: { opacity: 0.8 },
  allowLabel: { color: colors.onAccent, fontSize: 17, fontWeight: "700" },
});
