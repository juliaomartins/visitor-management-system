/**
 * High contrast, because of where this is used.
 *
 * A guard holds this phone near a doorway: direct sun one minute, a dim lobby the
 * next, screen brightness wherever they left it. Subtle greys disappear in both.
 * Everything here is either near-black or near-white, with the three scan verdicts
 * saturated far enough to read at a glance without looking away from the visitor.
 *
 * Fixed dark, and it stays that way. The dashboard and the lobby screen both got
 * a light/dark toggle; this one deliberately did not. A bright screen at a night
 * entrance blinds the person holding it, a guard cannot stop to change a setting
 * with a visitor in front of them, and a theme that shifts mid-shift is a
 * liability rather than a preference.
 */
export const colors = {
  /*
    THE EVENT PALETTE, SAMPLED FROM THE ARTWORK.

    Taken from the event PIN supplied with the design brief "for colour reference
    only, to guide the design and colour selection":

        red #CC0000   gold #FCB400   green #006C30   blue #00309C

    Those are print inks on white. This screen is near-black, and against it the
    pin's blue reads 1.7:1 and its green 2.9:1 -- invisible in a dim lobby and
    worse in sun. Each hue keeps its hue and saturation and moves only in
    lightness, by the smallest step that clears 4.5:1 on this ground. Gold needed
    no help: on a dark field the pin's own #FCB400 reads 10.6:1.

    THE THREE VERDICTS WERE RE-CHECKED, not assumed. Run through dichromat
    simulation in Lab, the worst pair is valid/invalid at dE 29.3 protan and 13.6
    deutan, against a floor of 10 -- marginally better than the set they replace.
    They are still never shown as colour alone: each verdict has its own sound,
    its own haptic and its own word.
  */
  background: "#0B1016",
  surface: "#141B24",
  surfaceRaised: "#1F2833",
  border: "#26313F",

  text: "#F4F8FB",
  textMuted: "#A8B6C4",
  textFaint: "#75838F",

  accent: "#3372FF",
  accentPressed: "#1F4FC0",
  onAccent: "#FFFFFF",

  // The three verdicts, each paired with its own sound.
  valid: "#00B050",
  invalid: "#F24141",
  revoked: "#FCB400",

  // The event's inks, unmodified, for anywhere the brand itself is drawn rather
  // than the interface -- never for text on this background.
  brandRed: "#CC0000",
  brandGold: "#FCB400",
  brandGreen: "#006C30",
  brandBlue: "#00309C",
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
