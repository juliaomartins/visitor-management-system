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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRichT, useT } from "@/i18n";
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
  const t = useT();
  const rich = useRichT();
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
        t("server.nothingAnswered"),
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
            <Text style={styles.eyebrow}>{t("server.cannotReach")}</Text>
            <Text style={styles.title}>{t("server.whereIsIt")}</Text>
            <Text style={styles.body}>
              {rich("setup.hint", {
                cmd: <Text style={styles.code}>ipconfig</Text>,
              })}
            </Text>
          </View>

          {attempted.length > 0 ? (
            <View style={styles.tried}>
              <Text style={styles.triedLabel}>
                {t("server.alreadyTried")}
              </Text>
              {attempted.map((origin) => (
                <Text key={origin} style={styles.triedItem}>
                  {origin}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>{t("server.address")}</Text>
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
              accessibilityLabel={t("server.addressA11y")}
            />
            <Text style={styles.hint}>{t("setup.bareIp")}</Text>
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          {/*
            TWO WAYS OUT OF HERE, AND BOTH ARE BUTTONS.

            Connect takes the address in the field. Retry takes the ones already
            on the phone, which is the whole answer when the server never moved
            and was simply off -- the commonest way anybody arrives at this
            screen, and the one that needs no typing at all.

            It used to be muted text under a filled button: no border, no fill,
            a 34pt target, and nothing to say it could be pressed. On the screen
            where a guard is already stuck, the cheapest fix was the one that
            looked like a caption.
          */}
          <View style={styles.actions}>
            <Pressable
              onPress={submit}
              disabled={checking || !value.trim()}
              accessibilityRole="button"
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => [
                styles.button,
                (checking || !value.trim()) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              {checking ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.buttonLabel} numberOfLines={1}>
                  {t("server.connect")}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={onRetry}
              disabled={searching}
              accessibilityRole="button"
              accessibilityState={{ busy: searching, disabled: searching }}
              android_ripple={{ color: "rgba(244,248,251,0.12)" }}
              style={({ pressed }) => [
                styles.retry,
                searching && styles.retryBusy,
                pressed && styles.retryPressed,
              ]}
            >
              {searching ? (
                <ActivityIndicator color={colors.textMuted} size="small" />
              ) : (
                <MaterialCommunityIcons
                  name="refresh"
                  size={19}
                  color={colors.text}
                />
              )}
              {/* Two lines, because Portuguese says "Tentar de novo os
                  enderecos guardados" -- half again the English, and clipping
                  it would hide which addresses it means. */}
              <Text style={styles.retryLabel} numberOfLines={2}>
                {searching ? t("server.searching") : t("server.retrySaved")}
              </Text>
            </Pressable>
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
  eyebrow: {
    color: colors.invalid,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 28,
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
  // The two ways out sit together as one group; the page's own `gap` is a
  // section gap and would read as two unrelated controls.
  actions: { gap: spacing.sm },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: HIT_SIZE,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    overflow: "hidden",
  },
  retryBusy: { opacity: 0.6 },
  retryPressed: { backgroundColor: colors.surfaceRaised },
  retryLabel: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
