/**
 * Where the server is, set by hand.
 *
 * REACHABLE BEFORE PAIRING, and that is the whole point. A phone pointed at the
 * wrong address cannot pair, cannot scan, and cannot be fixed from inside any
 * screen that needs the server to work first. So this sits in front of all of
 * it, on its own route, with a gear on the pairing screen and one beside the
 * unpair control on the camera screen.
 *
 * AN UNTESTED ADDRESS IS NEVER SAVED. Save is disabled until a test succeeds,
 * and editing either field throws the previous result away. An address that
 * looks accepted and fails at the next badge is worse than an honest error here
 * -- the guard has already walked away from the desk by then.
 */
import { LanguageToggle } from "@/components/LanguageToggle";
import { useRichT, useT } from "@/i18n";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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

import { type ReachResult, setApiOrigin, testConnection } from "@/api/client";
import {
  BUILD_DEFAULT_ORIGIN,
  clearManualOrigin,
  getManualOrigin,
  normaliseOrigin,
  storeManualOrigin,
} from "@/storage/server";
import { colors, HIT_SIZE, radius, spacing } from "@/theme";

const DEFAULT_PORT = "8000";

/** Split a stored origin back into the two fields it was typed as. */
function splitOrigin(origin: string): { host: string; port: string } {
  const match = /^https?:\/\/([^/:\s]+)(?::(\d+))?$/i.exec(origin);
  if (!match) return { host: "", port: DEFAULT_PORT };
  return { host: match[1], port: match[2] ?? DEFAULT_PORT };
}

export default function SettingsScreen() {
  const t = useT();
  const rich = useRichT();
  const [host, setHost] = useState("");
  const [port, setPort] = useState(DEFAULT_PORT);
  const [saved, setSaved] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ReachResult | null>(null);
  const [busy, setBusy] = useState(false);

  // The address a successful test proved. Save compares against the current
  // fields, so a later edit cannot ride on an old pass.
  const [proven, setProven] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const manual = await getManualOrigin();
      setSaved(manual);
      const source = manual ?? BUILD_DEFAULT_ORIGIN;
      if (source) {
        const parts = splitOrigin(source);
        setHost(parts.host);
        setPort(parts.port);
      }
    })();
  }, []);

  const candidate = normaliseOrigin(`${host.trim()}:${port.trim() || DEFAULT_PORT}`);
  const passed = proven !== null && proven === candidate;

  /* Any edit invalidates the previous test. Both fields, both directions. */
  function editHost(next: string) {
    setHost(next);
    setProven(null);
    setResult(null);
  }

  function editPort(next: string) {
    setPort(next.replace(/[^0-9]/g, ""));
    setProven(null);
    setResult(null);
  }

  async function runTest() {
    if (!candidate || testing) return;
    setTesting(true);
    setResult(null);
    const outcome = await testConnection(candidate);
    setResult(outcome);
    setProven(outcome.ok ? candidate : null);
    setTesting(false);
  }

  async function save() {
    if (!passed || busy) return;
    setBusy(true);
    await storeManualOrigin(candidate);

    /*
      Told to the client directly, not left for the next probe to discover.

      `storeManualOrigin` announces the change and `useServer` re-resolves, but
      that is a round trip over the network before it takes effect. This address
      has just passed a test on this screen -- it is known good, and there is no
      reason to leave requests pointed at the old one for the length of a probe.
    */
    setApiOrigin(candidate);
    setBusy(false);
    router.back();
  }

  async function useDefault() {
    if (busy) return;
    setBusy(true);
    await clearManualOrigin();
    setBusy(false);
    router.back();
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
          <Text style={styles.title}>{t("server.address")}</Text>
          <Text style={styles.body}>
            {rich("settings.hint", {
              cmd: <Text style={styles.mono}>ipconfig</Text>,
            })}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t("server.ipLabel")}</Text>
            <TextInput
              value={host}
              onChangeText={editHost}
              placeholder="192.168.0.63"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
              accessibilityLabel={t("server.ipA11y")}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("server.portLabel")}</Text>
            <TextInput
              value={port}
              onChangeText={editPort}
              placeholder={DEFAULT_PORT}
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={5}
              style={[styles.input, styles.portInput]}
              accessibilityLabel={t("server.portA11y")}
            />
          </View>

          {result ? <Outcome result={result} /> : null}

          <Pressable
            onPress={runTest}
            disabled={!candidate || testing}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondary,
              (!candidate || testing) && styles.disabled,
              pressed && candidate && !testing && styles.pressed,
            ]}
          >
            {testing ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.secondaryLabel}>{t("server.test")}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={save}
            disabled={!passed || busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primary,
              (!passed || busy) && styles.disabled,
              pressed && passed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryLabel}>{t("server.save")}</Text>
          </Pressable>

          {!passed ? (
            <Text style={styles.hint}>{t("settings.testFirst")}</Text>
          ) : null}

          {saved ? (
            <Pressable onPress={useDefault} accessibilityRole="button">
              <Text style={styles.tertiary}>{t("server.useBuiltIn")}</Text>
            </Pressable>
          ) : null}

          <View style={styles.languageBlock}>
            <Text style={styles.label}>{t("language.label")}</Text>
            <LanguageToggle />
          </View>

          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.tertiary}>{t("server.cancel")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The result, in terms of what to do about it. */
function Outcome({ result }: { result: ReachResult }) {
  const t = useT();

  if (result.ok) {
    return (
      <View style={[styles.outcome, styles.good]}>
        <Text style={styles.goodText}>
          {t("settings.connected")}
          {result.health.lan_ip
            ? ` ${t("settings.reports", { ip: result.health.lan_ip })}`
            : ""}
        </Text>
      </View>
    );
  }

  const message =
    result.reason === "bad-address"
      ? t("server.badAddress")
      : result.reason === "timeout"
        ? t("server.timeout")
        : result.reason === "unreachable"
          ? t("server.refused")
          : t("server.notVms", { status: result.status ?? "?" });

  return (
    <View style={[styles.outcome, styles.bad]}>
      <Text style={styles.badText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  languageBlock: { gap: spacing.sm, marginTop: spacing.lg },
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  mono: { color: colors.text, fontWeight: "700" },

  field: { gap: spacing.xs },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  input: {
    minHeight: HIT_SIZE,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 20,
  },
  portInput: { maxWidth: 140 },

  outcome: { borderRadius: radius.md, padding: spacing.md },
  good: { backgroundColor: colors.surfaceRaised },
  bad: { backgroundColor: colors.surfaceRaised },
  goodText: { color: colors.valid, fontSize: 15, lineHeight: 22 },
  badText: { color: colors.invalid, fontSize: 15, lineHeight: 22 },

  secondary: {
    minHeight: HIT_SIZE,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: { color: colors.text, fontSize: 17, fontWeight: "600" },
  primary: {
    minHeight: HIT_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { color: colors.onAccent, fontSize: 17, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },

  hint: { color: colors.textFaint, fontSize: 13, textAlign: "center" },
  tertiary: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
});
