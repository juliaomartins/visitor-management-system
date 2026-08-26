/**
 * Setup, once, then never again.
 *
 * Someone reads a 6-character code off the dashboard and types it here. That is
 * the whole of this screen, and the whole of this app's authentication — there is
 * no login screen and there will not be one (CLAUDE.md constraint #4).
 */
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, NetworkError } from "@/api/client";
import { ServerSetup } from "@/components/ServerSetup";
import { useServer } from "@/hooks/useServer";
import { CODE_LENGTH, normaliseCode, pairDevice, suggestedDeviceName } from "@/api/pairing";
import { useSession } from "@/session";
import { colors, HIT_SIZE, radius, spacing } from "@/theme";

export default function PairScreen() {
  const { adopt, storageAvailable } = useSession();
  const server = useServer();
  const [code, setCode] = useState("");
  const [name, setName] = useState(suggestedDeviceName());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready =
    code.length === CODE_LENGTH && !busy && storageAvailable && !!server.origin;

  async function submit() {
    if (!ready) return;

    setBusy(true);
    setError(null);

    try {
      const device = await pairDevice(code, name.trim());
      await adopt({ token: device.token, name: device.name, kind: device.kind });
      router.replace("/scanner");
    } catch (cause) {
      if (cause instanceof ApiError || cause instanceof NetworkError) {
        setError(cause.message);
      } else {
        setError("Pairing failed. Try again.");
      }
      setBusy(false);
    }
  }

  // No server, nothing to redeem a code against. Ask for the address first — a
  // guard should be able to fix this without waiting for a rebuild.
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.eyebrow}>VMS SCANNER</Text>
            <Text style={styles.title}>Pair this phone</Text>
            <Text style={styles.body}>
              Open the dashboard, generate a scanner pairing code, and type it below.
              You only do this once — after pairing, this app opens straight to the
              camera.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Pairing code</Text>
            <TextInput
              value={code}
              onChangeText={(next) => {
                setCode(normaliseCode(next));
                setError(null);
              }}
              placeholder="ABC123"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              autoFocus
              maxLength={CODE_LENGTH}
              returnKeyType="go"
              onSubmitEditing={submit}
              // A code is six characters of an unambiguous alphabet, so the
              // default keyboard is right — a numeric pad would hide the letters.
              style={styles.codeInput}
              accessibilityLabel="Six character pairing code"
            />
            <Text style={styles.counter}>
              {code.length} of {CODE_LENGTH}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Name this device</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="North door"
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              maxLength={100}
              style={styles.nameInput}
              accessibilityLabel="Device name"
            />
            <Text style={styles.hint}>
              Shown in the dashboard and against every scan this phone records.
            </Text>
          </View>

          {!storageAvailable ? (
            <Text style={styles.error}>
              This device has no secure storage, so a token cannot be kept. Run the
              scanner on a phone, not in a browser.
            </Text>
          ) : null}

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={!ready}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              !ready && styles.buttonDisabled,
              pressed && ready && styles.buttonPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.buttonLabel}>Pair device</Text>
            )}
          </Pressable>

          {/* At an event this is the fastest way to answer "is it pointed at the
              right box?" — and tapping it searches again. */}
          <Pressable onPress={server.rescan} accessibilityRole="button">
            <Text style={styles.server}>
              {server.searching
                ? "Finding the server…"
                : (server.origin ?? "No server found")}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.xl,
    justifyContent: "center",
  },
  eyebrow: {
    color: colors.textFaint,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "600",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  field: { gap: spacing.sm },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  codeInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 10,
    textAlign: "center",
    paddingVertical: spacing.md,
    fontVariant: ["tabular-nums"],
  },
  counter: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: "center",
  },
  nameInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  hint: { color: colors.textFaint, fontSize: 13 },
  error: {
    color: colors.invalid,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: "#2A1116",
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: HIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { backgroundColor: colors.surfaceRaised },
  buttonPressed: { backgroundColor: colors.accentPressed },
  buttonLabel: {
    color: colors.onAccent,
    fontSize: 17,
    fontWeight: "700",
  },
  server: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: "center",
  },
});
