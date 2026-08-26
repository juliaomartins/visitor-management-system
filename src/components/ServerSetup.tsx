/**
 * "Where is the server?", asked on a phone, by someone standing at a door.
 *
 * Shown only when every stored and built-in address has failed. Whoever sees this
 * is holding a phone that cannot check badges, so it is short: what it tried, one
 * field, one button, and a check before it claims success.
 *
 * It never saves an address that did not answer. An address that looks accepted
 * and fails at the next badge is worse than an honest error here.
 */
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

import { colors, HIT_SIZE, radius, spacing } from "@/theme";

export function ServerSetup({
  attempted,
  onAdopt,
  onRetry,
  searching,
}: {
  attempted: string[];
  /** Returns false when the address did not answer, so the form can say so. */
  onAdopt: (origin: string) => Promise<boolean>;
  onRetry: () => void;
  searching: boolean;
}) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value.trim() || checking) return;

    setChecking(true);
    setError(null);

    const ok = await onAdopt(value);
    setChecking(false);

    if (!ok) {
      setError(
        "Nothing answered there. Check the address, and that the server is on and " +
          "this phone is on the same Wi-Fi.",
      );
    }
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
            <Text style={styles.eyebrow}>CANNOT REACH THE SERVER</Text>
            <Text style={styles.title}>Where is the server?</Text>
            <Text style={styles.body}>
              Ask whoever set up the laptop for its IP address, or run{" "}
              <Text style={styles.code}>ipconfig</Text> on it. The port is almost
              always 8000.
            </Text>
          </View>

          {attempted.length > 0 ? (
            <View style={styles.tried}>
              <Text style={styles.triedLabel}>Already tried</Text>
              {attempted.map((origin) => (
                <Text key={origin} style={styles.triedItem}>
                  {origin}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Server address</Text>
            <TextInput
              value={value}
              onChangeText={(next) => {
                setValue(next);
                setError(null);
              }}
              placeholder="10.101.196.41:8000"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={submit}
              style={styles.input}
              accessibilityLabel="Server IP address and port"
            />
            <Text style={styles.hint}>
              A bare IP is fine — http:// and the port are filled in for you.
            </Text>
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={checking || !value.trim()}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              (checking || !value.trim()) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            {checking ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.buttonLabel}>Connect</Text>
            )}
          </Pressable>

          <Pressable onPress={onRetry} disabled={searching} accessibilityRole="button">
            <Text style={styles.retry}>
              {searching ? "Searching…" : "Try the saved addresses again"}
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
    gap: spacing.lg,
    justifyContent: "center",
  },
  eyebrow: {
    color: colors.invalid,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
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
  code: { color: colors.text, fontWeight: "700" },
  tried: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  triedLabel: { color: colors.textFaint, fontSize: 12, marginBottom: spacing.xs },
  triedItem: { color: colors.textMuted, fontSize: 14 },
  field: { gap: spacing.sm },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 20,
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
  buttonLabel: { color: colors.onAccent, fontSize: 17, fontWeight: "700" },
  retry: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
});
