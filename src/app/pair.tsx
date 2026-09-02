/**
 * Setup, once, then never again.
 *
 * Someone reads a 6-character code off the dashboard and types it here. That is
 * the whole of this screen, and the whole of this app's authentication — there is
 * no login screen and there will not be one (CLAUDE.md constraint #4).
 *
 * Laid out like the lobby screen's pairing page and the dashboard's sign-in: a
 * mark, a title, one line of instruction, the field, one button, and the server
 * address kept quiet at the foot. Three surfaces doing the same job should not
 * each invent their own shape.
 *
 * THE CODE COUNTER IS GONE — a rule fills instead, which says the same thing
 * without asking anyone to read "4 of 6" while typing. The device NAME STAYS:
 * there are several phones on several doors, and that name is how the devices
 * page tells a quiet door from a dead phone.
 */
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { ServerBar } from "@/components/ServerBar";
import { ServerSetup } from "@/components/ServerSetup";
import { useServer } from "@/hooks/useServer";
import {
  CODE_LENGTH,
  normaliseCode,
  pairDevice,
  suggestedDeviceName,
} from "@/api/pairing";
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
          {/* Before pairing is exactly when a wrong address has to be fixable:
            there is no code to redeem against a server nobody can reach. */}
        <ServerBar />

        <View style={styles.header}>
            <Image
              source={require("../../assets/images/brand/drcc-event.png")}
              style={styles.mark}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.markLabel}>
              DÍLI REGIONAL COOPERATIVE{"\n"}CONFERENCE 2026
            </Text>
          </View>

          <View style={styles.intro}>
            <Text style={styles.title}>Pair this phone</Text>
            <Text style={styles.body}>
              Enter the scanner pairing code from the dashboard.
            </Text>
          </View>

          <View>
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

            {/* Progress without a number to read: the rule fills as they type. */}
            <View style={styles.track}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${(code.length / CODE_LENGTH) * 100}%` },
                ]}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Name this phone</Text>
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
              <Text style={styles.buttonLabel}>Pair phone</Text>
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

          {/*
            Both organisers, together, at the foot -- never one alone, because
            dropping either misrepresents who is hosting. This is the only screen
            in the app anyone looks at for more than a second: after pairing, the
            guard sees the camera and nothing else, forever.

            They keep their white plate in this dark app on purpose. A government
            seal knocked back to "fit the theme" is a liberty nobody here is
            entitled to take.
          */}
          <View style={styles.organisers}>
            <Image
              source={require("../../assets/images/brand/rdtl.png")}
              style={styles.seal}
              resizeMode="contain"
              accessibilityLabel="República Democrática de Timor-Leste"
            />
            <Image
              source={require("../../assets/images/brand/secoop.png")}
              style={styles.seal}
              resizeMode="contain"
              accessibilityLabel="Secretária de Estado de Cooperativas"
            />
          </View>
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
    gap: spacing.lg,
    justifyContent: "center",
  },

  organisers: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  seal: {
    width: 34,
    height: 34,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  mark: {
    // 38, not 34. The pin carries two rings of type and a plume; below the
    // high thirties it stops reading as a crest and turns into a smudge.
    width: 38,
    height: 38,
  },
  markLabel: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.6,
    fontWeight: "600",
  },

  intro: { alignItems: "center", gap: spacing.sm },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },

  codeInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 10,
    textAlign: "center",
    paddingVertical: spacing.lg,
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    overflow: "hidden",
  },
  trackFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accent,
  },

  field: { gap: spacing.sm },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
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

  error: {
    color: colors.invalid,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: "#2A1116",
    borderRadius: radius.md,
    padding: spacing.md,
  },

  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
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
