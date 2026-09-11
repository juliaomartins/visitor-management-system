import type { MessageKey } from "@/lib/locales";

/**
 * What an outcome looks like, in one place, for every chart in the dashboard.
 *
 * THE TWO PAGES USED TO DISAGREE, and one of them was broken. `/reports` filled
 * the duplicate series with `var(--color-sun)`, a token that is defined nowhere
 * -- so the `fill` attribute was invalid, SVG fell back to its initial value of
 * black, and "duplicate" rendered identical to "refused" (near-black
 * graphite). The legend said three series and the chart showed two. Meanwhile
 * `/reports` painted valid BLUE while `/dashboard` painted it green.
 *
 * Now both read from here, so a colour means one thing across the app -- and it
 * is the same thing it means at the door. Green valid / amber revoked / red
 * invalid is the scanner's verdict language and a hard constraint, which is why
 * these hues were not ours to pick and why the separation problem below had to
 * be solved without changing them.
 *
 * The steps are measured, not chosen. See the comment beside
 * `--color-chart-*` in `globals.css` for the numbers.
 */

export type Outcome = "valid" | "duplicate" | "revoked" | "invalid";

export type OutcomeSpec = {
  key: Outcome;
  labelKey: MessageKey;
  /** The fill, as a token so a theme switch repaints without touching JS. */
  fill: string;
  /**
   * Ink for a figure set in this outcome's colour.
   *
   * Deliberately NOT the fill. `--color-vip` is the readable ink for amber and
   * `--color-chart-revoked` is the fill; text set in a fill would be 2.77:1.
   */
  ink: string;
  /**
   * Hatch this series where segments touch.
   *
   * Only revoked carries it, and only because colour genuinely cannot do the
   * job here: green, gold and red all collapse toward one axis under red-green
   * CVD, so lightness is the only escape, and the dark band (L 0.48-0.67) is
   * too narrow to hold four hues apart. Texture is the relief for exactly that
   * case. The three-series hour chart validates clean and uses none.
   */
  hatch?: boolean;
};

/**
 * Severity order, and it is the reading order everywhere: good, benign,
 * warning, refused. Never sorted by size -- a colour follows the outcome, never
 * its rank, or a quiet morning would repaint the whole legend.
 */
export const OUTCOMES: readonly OutcomeSpec[] = [
  {
    key: "valid",
    labelKey: "scan.valid",
    fill: "var(--color-chart-valid)",
    ink: "var(--color-valid)",
  },
  {
    key: "duplicate",
    labelKey: "scan.duplicate",
    fill: "var(--color-chart-duplicate)",
    ink: "var(--color-ink-2)",
  },
  {
    key: "revoked",
    labelKey: "scan.revoked",
    fill: "var(--color-chart-revoked)",
    ink: "var(--color-vip)",
    hatch: true,
  },
  {
    key: "invalid",
    labelKey: "scan.invalid",
    fill: "var(--color-chart-invalid)",
    ink: "var(--color-revoked)",
  },
] as const;

/**
 * The hour chart's three series.
 *
 * Revoked and invalid fold into one "refused" bar because the question that
 * chart answers is how busy an hour was and how much of it was turned away;
 * which KIND of refusal is the Outcome split's question and the table's. Three
 * series also need no texture, which is a real simplification rather than a
 * compromise.
 *
 * A duplicate is somebody already inside coming back through a door. It is not
 * a refusal, and folding it into one would inflate every refused figure a
 * security review reads -- so it stays its own segment.
 */
export const HOUR_SERIES = [
  {
    key: "valid" as const,
    labelKey: "scan.valid" as MessageKey,
    fill: "var(--color-chart-valid)",
  },
  {
    key: "duplicate" as const,
    labelKey: "scan.duplicate" as MessageKey,
    fill: "var(--color-chart-duplicate)",
  },
  {
    key: "refused" as const,
    labelKey: "chart.refused" as MessageKey,
    fill: "var(--color-chart-invalid)",
  },
] as const;

export type HourSeriesKey = (typeof HOUR_SERIES)[number]["key"];

/** The one id for the hatch pattern, so the `<defs>` and its users cannot drift. */
export const HATCH_ID = "vms-chart-hatch";
