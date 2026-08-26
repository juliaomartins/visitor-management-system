/**
 * High contrast, because of where this is used.
 *
 * A guard holds this phone near a doorway: direct sun one minute, a dim lobby the
 * next, screen brightness wherever they left it. Subtle greys disappear in both.
 * Everything here is either near-black or near-white, with the three scan verdicts
 * saturated far enough to read at a glance without looking away from the visitor.
 *
 * Fixed dark. No light mode: a bright screen at a night entrance blinds the person
 * holding it, and a theme that changes under a guard mid-shift is a liability.
 */
export const colors = {
  background: "#0B0F14",
  surface: "#161C24",
  surfaceRaised: "#1F2833",
  border: "#2E3A47",

  text: "#F5F8FA",
  textMuted: "#94A7B8",
  textFaint: "#5D6E7E",

  accent: "#2F81F7",
  accentPressed: "#1F5FBF",
  onAccent: "#FFFFFF",

  // The three verdicts. Phase 3b part 2 pairs each with its own sound.
  valid: "#1FA463",
  invalid: "#D2354A",
  revoked: "#D18A1F",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** Thumb-sized. Guards wear gloves in the morning. */
export const HIT_SIZE = 56;
