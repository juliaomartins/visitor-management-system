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
import { useSyncQueue } from "@/hooks/useSyncQueue";
import { useSession } from "@/session";
import { clearAll, initQueue } from "@/storage/queue";
import { colors, HIT_SIZE, radius, spacing } from "@/theme";

export default function ScannerScreen() {
  const { device, forget } = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);

  const server = useServer();
  const { status, sync, refresh } = useSyncQueue();
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

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      onBarcodeScanned(data);
    },
    [onBarcodeScanned],
  );

  function confirmUnpair() {
    Alert.alert(
      "Unpair this phone?",
      "It stops being able to record scans until it is paired again with a new " +
        "code. Revoke it from the dashboard as well if the phone is lost.",
      [
        { text: "Keep paired", style: "cancel" },
        {
          text: "Unpair",
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
          <Text style={styles.permissionTitle}>The camera is off</Text>
          <Text style={styles.permissionText}>
            This app reads badge QR codes and does nothing else with the camera. No
            photos are taken and nothing is stored on the phone.
          </Text>
        </View>
        <Pressable
          onPress={requestPermission}
          accessibilityRole="button"
          style={({ pressed }) => [styles.allow, pressed && styles.pressed]}
        >
          <Text style={styles.allowLabel}>
            {permission.canAskAgain ? "Allow the camera" : "Open settings to allow it"}
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

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <CameraOverlay
          torchOn={torchOn}
          onToggleTorch={() => setTorchOn((on) => !on)}
          deviceName={device?.name ?? "Scanner"}
          pending={status.pending}
          syncing={status.syncing}
          hint={
            state.phase === "sending"
              ? "Checking…"
              : "Hold the badge QR inside the frame"
          }
        />
      </SafeAreaView>

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

      {/* The only chrome on the camera screen, and only while it is idle. A
          guard mid-shift whose server has moved needs a way to the address
          without unpairing the phone and starting over. */}
      {scanning ? (
        <SafeAreaView style={styles.footer} pointerEvents="box-none">
          <Pressable
            onPress={() => router.push("/settings")}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={styles.unpair}>Server</Text>
          </Pressable>
          <Pressable onPress={confirmUnpair} hitSlop={10} accessibilityRole="button">
            <Text style={styles.unpair}>Unpair</Text>
          </Pressable>
        </SafeAreaView>
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
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: HIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.8 },
  allowLabel: { color: colors.onAccent, fontSize: 17, fontWeight: "700" },

  footer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    // A row now that it carries two links. Wide gap so a gloved thumb reaching
    // for one cannot catch the other -- unpairing by accident mid-shift is a
    // far more expensive slip than opening the wrong screen.
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
    padding: spacing.md,
  },
  unpair: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: "600",
    padding: spacing.sm,
  },
});
