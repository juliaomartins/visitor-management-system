# Dashboard and report statistics — redesign

**Date:** 2026-09-11
**Scope:** `vms-dashboard` (`/dashboard`, `/reports`) plus one backend
aggregation fix in `vms-backend/apps/reports/services.py`.

## Why

Two things at once. The panels look like a widget grid rather than a designed
surface, and the numbers in them are wrong.

## Part 1 — the numbers are wrong (prerequisite, not cosmetic)

Five defects, four of them visible in the screenshots that prompted this work.

### 1. `counts_by_result` returns 1 for every outcome

`entry_log()` applies an explicit `.order_by("-scanned_at", "-id")`.
`counts_by_result` then calls `.values("result").annotate(total=Count("id"))`
without clearing it, and Django folds an **explicit** `order_by` into the
`GROUP BY`:

```sql
GROUP BY 1, "scans_scanevent"."scanned_at", "scans_scanevent"."id"
```

`id` is the primary key, so every scan is its own group, every count is `1`, and
the dict comprehension keeps the last row per result.

Measured against a throwaway SQLite database, 7 valid / 3 duplicate / 2 revoked
/ 1 invalid:

| called with | result | |
|---|---|---|
| `ScanEvent.objects.all()` | `7/3/2/1`, sums to 13 | correct |
| `entry_log()` — production | `1/1/1/1`, sums to 4 | **wrong** |
| `entry_log().order_by()` | `7/3/2/1`, sums to 13 | correct |

**CLAUDE.md's "Things this document got wrong before" entry is itself wrong on
this point.** It says the missing-`order_by` suspicion was a false alarm because
`Meta.ordering` has not been folded into `GROUP BY` since Django 3.1. That is
true and it is not the question — this queryset carries an explicit
`.order_by()`, which is still folded in by design. Earlier sessions tested the
bare queryset, got the right answer, and concluded the function was sound. It is
sound in isolation and broken on the only path that ever calls it.

The three sibling aggregations (`counts_by_hour`, `counts_by_country`,
`counts_by_category`) each end with their own `.order_by(...)`, which replaces
the inherited one. `counts_by_result` is the only one that does not.

Blast radius: the dashboard Outcome split, the "Refused at the door" tile
(`invalid + revoked`), the duplicate note, the report narrative in
`apps/reports/analysis.py`, and the XLSX and PDF report exports.

**Fix:** `.order_by()` before `.values()`, with a comment naming the
explicit-versus-`Meta` distinction so this is not "corrected" back a fourth time.

### 2. `--color-sun` is not defined

`EntryChart.tsx` fills the duplicate series with `var(--color-sun)`, which
exists nowhere in `globals.css`. The `fill` attribute is therefore invalid and
SVG falls back to its initial value, black — the same as the refused series
(`--color-graphite-950`). Two of three series are indistinguishable, defeating
the component's own documented intent.

### 3. Bar corner radii render as ellipses

`<svg viewBox="0 0 100 180" preserveAspectRatio="none">` scales x by roughly
14.7 and y by 1. `rx={7}` becomes about 103 by 7 px — the flattened "3D cap" in
the screenshot.

This is the reason for a shared chart system rather than a restyle: the bug
exists **because** geometry is authored in viewBox units that are then scaled
non-uniformly. Measuring the container and drawing in CSS pixels removes the
class of bug, not one instance of it.

### 4. Invisible tooltip heading

The reports tooltip sets the hour with `text-ink` on `bg-graphite-950`:
near-black on near-black in light mode.

### 5. Tooltips on empty hours

The hit rect spans every column including gap-filled empty hours, so 11:00 with
no scans reports "Valid 0 / Duplicate 0 / Refused 0".

## Part 2 — the redesign

**Direction: ceremonial.** The dashboard is a surface people are shown, so it
gets one clear hierarchy instead of four equal tiles.

**Palette is not invented.** CLAUDE.md is explicit that it is sampled from the
RDTL and SECoop logos. The event's own material — `#cc0000`, `#fcb400`,
`#006c30`, `#00309c`, and the *tais* motif the lobby screen already uses — is
the distinctive vocabulary, and no generic dashboard kit has it.

### Dashboard layout

1. **Hero arrival band** — `arrived / registered` as one fluid figure
   (`clamp(4rem, 12vw, 9rem)`, Plus Jakarta Sans) over a proportional meter.
   This is the figure anyone shown the page wants.
2. **A supporting strip** — refused, duplicates, doors, peak hour — as one
   banded row, not four cards. Four identical cards each with a sparkline gives
   "Registered" the same weight as "Arrived" and is the commonest
   generated-dashboard tell.
3. **The day's shape** — the arrivals area chart, taller and full width, with a
   still *tais* band at the baseline tying it to the lobby screen.
4. **Outcome split** and **Recent arrivals** below, quieter.

### Reports layout

Same type scale; the recap narrative treated as the hero it already is; the hour
chart rebuilt on the shared primitives. **The entrance-log table is not
touched.**

### One shared chart system

`components/charts/` owns scales, axis, gridlines, tooltip, legend, empty state,
and the outcome colour scale. Geometry in CSS pixels from a measured container.

Carried across from the existing components rather than discarded — each has a
real reason recorded in a comment:

- straight segments between hourly readings, never a spline (a spline invents
  arrivals at 10:30 and overshoots below zero out of a spike)
- empty hours between the first and last active hour are kept, because an empty
  11:00 is information
- two or more series always carry a legend; identity is never colour alone
- the arrivals curve keeps its right-hand axis labels

### Outcome colour, unified

The two pages currently disagree:

| outcome | /dashboard now | /reports now | agreed |
|---|---|---|---|
| valid | green | blue | green `--color-valid` |
| duplicate | grey | black (undefined var) | grey `--color-neutral-mark` |
| revoked | gold | folded into "refused" | gold `--color-vip` |
| invalid | red | folded into "refused" | red `--color-revoked` |

Green / amber / red is the scanner's verdict language and a CLAUDE.md hard rule.
A colour then means the same thing at the door, on the wall and in the report.

### Motion

One orchestrated load: the hero figure counts up once, the area path draws once.
Not per-card fade-ins. Both disabled under `prefers-reduced-motion`.

### Responsive and theme

Fluid hero; the strip wraps 4 to 2 to 1; charts reflow from measurement.
Verified at 400 / 768 / 1366 / 1920 in light and dark by screenshot, not
asserted.

### Explicitly not doing

- No new dependency. These charts are hand-rolled SVG and stay that way; adding
  a charting library to a machine that is offline by event day is not a trade
  worth making for two charts.
- No new palette.
- No change to the entrance-log table.

## Files

| file | change |
|---|---|
| `vms-backend/apps/reports/services.py` | defect 1 |
| `vms-dashboard/components/charts/*` | new shared system |
| `components/dashboard/{StatTile,ArrivalsCurve,OutcomeSplit}.tsx` | rebuilt |
| `components/reports/{EntryChart,Recap}.tsx` | defects 2 to 5, rebuilt |
| `app/(dashboard)/{dashboard,reports}/page.tsx` | layout |
| `app/globals.css` | chart tokens |
| `CLAUDE.md` | the `counts_by_result` correction, chart system, colour rule |

## Verification

- throwaway-SQLite probe: `by_result` sums to `total` through `entry_log()`,
  and the XLSX/PDF exports agree with the dashboard
- `manage.py check`, `tsc --noEmit`, `eslint`, `next build`
- headless screenshots at four widths, light and dark, and under
  `prefers-reduced-motion`

## Open question deferred

`visitor_ids` on `POST /badges/export` is capped at 250 while the event expects
about 250 visitors, so select-all-then-export fails at the 251st registration.
Out of scope here; recorded in CLAUDE.md.

---

## What changed during implementation

Recorded because the design above was approved and three parts of it did not
survive contact with a screenshot.

**The tais band was cut.** The dashboard has no tais asset and the lobby
screen's drape is 300KB. A photograph copied in to sit behind a progress bar is
decoration, not structure, on a machine that is offline by event day. The
ceremonial weight comes from the type scale, and the meter carries CSS warp
stripes at zero bytes instead.

**Both entrance animations were removed.** The design called for the hero figure
to count up and the arrivals line to draw itself in. Screenshots caught the
figure at 0 and at 75 where the truth was 220, and caught the line frozen
partway — invisible, because a draw-on effect hides the stroke with a dash
pattern until it completes. Chrome throttles `requestAnimationFrame` in
background tabs, which this repo already documents for the kiosk. Motion is now
one `.vms-rise` on the hero block: opacity and transform only, incapable of
showing a value that is not true.

**The four-outcome palette needed texture, not just re-stepping.** The design
assumed the hues could be separated by colour. They can in light (worst pair
ΔE 8.4 after re-stepping amber to #d98a00) and cannot in dark, where the band is
L 0.48–0.67 and green/gold/red collapse toward one axis under red-green CVD.
Revoked carries a 45° hatch in the four-outcome band; the three-series hour
chart needs none.

**A misdiagnosis worth recording.** Three screenshots appeared to show
horizontal overflow at 400px. There was none — Chrome on Windows clamps a window
to ~500px, laid the page out at 500, and the capture kept its left 400. The page
reporting its own `scrollWidth` settled it: `viewport 500 scrollWidth 500`, zero
offending elements. The narrow layout was verified properly through a 400px
`<iframe>`, which has a viewport of its own.

The padding fix in `useMeasuredWidth` was kept on its own merits: `clientWidth`
includes padding while `contentRect.width` does not, and the initial read was
40px too wide for a `px-5` container. It was not the overflow it was reached for.
