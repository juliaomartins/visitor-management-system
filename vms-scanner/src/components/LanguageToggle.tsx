import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLocale, useT } from "@/i18n";
import { LOCALES } from "@/locales";
import { colors, HIT_SIZE, radius, spacing } from "@/theme";

/**
 * Three languages, as a segmented control.
 *
 * A SEGMENTED CONTROL RATHER THAN A DROPDOWN, which is what the two web apps
 * use. There are only three options and they are short, so all three fit on a
 * phone at once — and a control that shows every option needs no second tap, no
 * overlay, and nothing to dismiss. On a phone held in one hand at a door, that
 * matters more than the few pixels a dropdown would save.
 *
 * THE LABELS ARE NEVER TRANSLATED. A guard handed a phone left in a language
 * they cannot read is hunting for "Português", not for its translation.
 *
 * Targets use the app's own HIT_SIZE. This is pressed with a thumb, sometimes
 * wearing a glove, in a doorway.
 *
 * THE ROW IS SIZED BY ITS LONGEST LABEL, WHICH IS "PORTUGUES", NOT BY ENGLISH.
 * Three equal thirds of a phone's width leave about 85pt of text room a side,
 * and at 15pt that word is wider than that -- so it wrapped to "Portugue / s"
 * on the pairing screen, which is the first thing a guard sees. The type is
 * sized and the padding tightened to fit it with room to spare, and
 * `numberOfLines` makes the failure bounded if a longer language is ever added:
 * it would clip, not reflow the control.
 */
export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  const t = useT();

  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      // Named, and named in the current language: a screen-reader user set to
      // Portuguese should hear "Idioma", not "Language".
      accessibilityLabel={t("language.label")}
    >
      {LOCALES.map((entry) => {
        const active = entry.code === locale;

        return (
          <Pressable
            key={entry.code}
            onPress={() => setLocale(entry.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={entry.label}
            style={({ pressed }) => [
              styles.item,
              active && styles.itemActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {entry.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  item: {
    flex: 1,
    // The app's own thumb target, not a generic 44: theme.ts sets it at 56
    // because "guards wear gloves in the morning".
    minHeight: HIT_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceRaised,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.text,
    fontWeight: "700",
  },
});
