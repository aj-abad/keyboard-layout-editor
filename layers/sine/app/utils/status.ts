/**
 * The five status tones, and the only file that knows what one looks like.
 *
 * Every domain's status map is a `Record<Status, StatusTone>` — reservations,
 * payment sessions, OCPI partners, OCPP commands, station health, attention
 * severities. Before this there were six such maps written independently, and
 * they disagreed: "good" was `emerald-800` on `emerald-50` in one,
 * `text-green-500` in another, and `text-primary` on `bg-accent` in three more,
 * so the same real-world state looked different on the Overview, the station
 * list and the session list.
 *
 * The rule the hues encode: **the brand green is never a status.** It is
 * artwork, `brand`, and `good` is the green a state takes: a shade darker, so
 * its text clears 4.5:1 on the canvas and in its own well, where the brand
 * green does not.
 *
 * Class strings are written out rather than composed, because Tailwind scans
 * source text: an interpolated `bg-${tone}-fill` produces no CSS at all.
 */

import { colorVar, ink, statusTone } from "../../tailwind.config";

export type StatusTone = "good" | "live" | "warn" | "bad" | "idle";

/**
 * Status ink as an sRGB colour string, for the map: a pin is drawn as SVG over
 * the map and as a canvas sprite inside it, both in sRGB, and the two have to
 * match. Selected pins sit on the inverse shell. It is a value rather than a
 * variable because a canvas cannot read one, so on a wide-gamut screen it
 * stays sRGB where `statusInkClass` takes the P3 twin (`p3` in the config).
 */
export const statusInkColor = (tone: StatusTone, inverse = false): string => {
  if (tone === "idle") return inverse ? ink.inverse : ink[3];
  return inverse ? statusTone[tone].dot : statusTone[tone].DEFAULT;
};

/**
 * A tone as a **filled area** in a chart — a square in the status grid, a band,
 * a donut arc. Not the same job as `statusInkColor`, which is ink: a mark is
 * read as a shape against the card, and a whole wall of them is read as weight.
 *
 * **The steps alternate along the severity order**, and that is the whole rule:
 * `good` light, `live` dark, `warn` light, `bad` dark, `idle` mid-grey. Marks
 * of neighbouring tones sit against each other constantly — stacked bands in a
 * column, adjacent arcs in a ring — and two neighbours at the same lightness
 * are told apart by hue alone, which is exactly what fails first. Alternating
 * gives every adjacent pair a lightness step to carry as well.
 *
 * It is measurable, not a hunch. Taking every tone's `DEFAULT` puts
 * `good` ↔ `live` at ΔE 14.0 in *normal* vision — under the 15 floor, a hard
 * fail that no amount of labelling excuses. Alternating takes the worst
 * adjacent pair to 19.7.
 *
 * `idle` takes `ink-4` rather than the `fill-4` its dot uses: as a mark it has
 * to sit in the L 0.43–0.77 band, and a 20% black lands at 0.845 — far too pale
 * to read as a shape at all.
 *
 * Validated with the `dataviz` skill's `validate_palette.js` against `#ffffff`
 * (lightness band, CVD separation, normal-vision floor: all pass). Two findings
 * stand, both by design:
 *
 * - `idle` fails the chroma floor, which asks every slot to carry identity by
 *   hue. "No state to report" is the one slot that should not.
 * - `warn` and `good` sit under the 3:1 non-text minimum (2.15 and 2.54). This
 *   is the skill's own documented case: status steps fall below 3:1 on a light
 *   surface by design, and the label pairing is the mitigation.
 *
 * **So a caller drawing these owes the reader that pairing** — a legend naming
 * every state, never colour alone.
 *
 * It returns the token's variable (`colorVar`), not its hex, so a chart
 * follows the display into P3 as the pills and dots beside it do. SVG
 * attributes, `style` bindings and Plot all take a `var()`; a canvas does not,
 * and would take the sRGB value from `statusTone`. The twins keep the marks'
 * lightness within 0.004 and widen every neighbouring gap, the worst to 22.4.
 */
export const statusMarkColor = (tone: StatusTone): string => {
  if (tone === "idle") return ink[4];
  if (tone === "good" || tone === "warn") return colorVar[`${tone}-dot`];
  return colorVar[tone];
};

/**
 * The class form of `statusMarkColor`, for a mark drawn as an element rather
 * than into SVG — a segment of the fleet composition bar, a meter fill.
 *
 * **The two must agree**, and nothing checks that they do: Tailwind scans
 * source text, so these cannot be composed from the same values the function
 * returns. Change one, change the other. (`statusInkColor` and
 * `statusInkClass` are the same pairing for the same reason.)
 *
 * It goes on a `Squircle`'s `surfaceClass`, never its `class` — a `bg-*` on the
 * root paints a rectangle inside the smoothed corner.
 */
export const statusMarkClass: Record<StatusTone, string> = {
  good: "bg-good-dot",
  live: "bg-live",
  warn: "bg-warn-dot",
  bad: "bg-bad",
  idle: "bg-ink-4",
};

/** The whole set, in severity order — for a legend, a filter, or a story. */
export const STATUS_TONES = ["good", "live", "warn", "bad", "idle"] as const;

/** The solid marker beside a label — a dot, a bar, a connector segment. */
export const statusDotClass: Record<StatusTone, string> = {
  good: "bg-good-dot",
  live: "bg-live-dot",
  warn: "bg-warn-dot",
  bad: "bg-bad-dot",
  idle: "bg-fill-4",
};

/** Status ink alone, for a bare label or a solid icon. */
export const statusInkClass: Record<StatusTone, string> = {
  good: "text-good",
  live: "text-live",
  warn: "text-warn",
  bad: "text-bad",
  idle: "text-ink-3",
};

/**
 * Status ink chosen for a **dark** surface — the class form of
 * `statusInkColor(tone, true)`.
 *
 * The `DEFAULT` hues are tuned to carry text on white and are far too dark to
 * read on `surface-inverse` (`good`'s #047857 is 1.4:1 there). The `dot` hues
 * are the bright end of each tone and clear 4.5:1 on it, which is why the map
 * pins already reach for them: a selected pin takes the inverse shell and its
 * glyph takes this. `idle` has no hue to brighten, so it takes plain white.
 *
 * Pair it with a **neutral** well — `fill-inverse-2`, not a status fill. The
 * pale `*-fill` tints are near-white and read as a lit chip on a dark sheet,
 * which is the opposite of the "neutral shells, status in the glyph" rule.
 */
export const statusInkInverseClass: Record<StatusTone, string> = {
  good: "text-good-dot",
  live: "text-live-dot",
  warn: "text-warn-dot",
  bad: "text-bad-dot",
  idle: "text-ink-inverse",
};

/** The soft fill alone — an icon well, a callout ground, a table row tint. */
export const statusFillClass: Record<StatusTone, string> = {
  good: "bg-good-fill",
  live: "bg-live-fill",
  warn: "bg-warn-fill",
  bad: "bg-bad-fill",
  idle: "bg-fill-2",
};

/**
 * A tone as a **sheet**: the same soft fill on its own `surface` underlay, for
 * a status object that floats over the canvas rather than sitting on a card.
 *
 * The fill is the dot at a low alpha and stays that way — an opaque tint is
 * exactly what the alpha replaced (see `statusFillClass`). But an alpha
 * composites to whatever lies beneath it, and a sheet drawn both on the rail
 * and in a glass popover has no single card to settle the answer, so it
 * carries the card with it: white first, then the fill on a pseudo-element
 * over it, inside the one clipped layer. It lands at the same `#fce1e1` a
 * `bad` well reaches on every card. Goes on a `Squircle`'s `surfaceClass`, never its
 * `class`, like every fill.
 *
 * The portal's `Shared/ConnectionStatusCapsule.vue` is the one caller (2026-09-30), and the one
 * toned sheet in the system — `docs/design-system.md` § Connection says why
 * the toast rule against a toned sheet does not reach it.
 */
export const statusSheetClass: Record<StatusTone, string> = {
  good: "bg-surface after:absolute after:inset-0 after:bg-good-fill",
  live: "bg-surface after:absolute after:inset-0 after:bg-live-fill",
  warn: "bg-surface after:absolute after:inset-0 after:bg-warn-fill",
  bad: "bg-surface after:absolute after:inset-0 after:bg-bad-fill",
  idle: "bg-surface after:absolute after:inset-0 after:bg-fill-2",
};

/**
 * OCPP 1.6 connector status, as tones.
 *
 * This vocabulary was written out four times — `ChargingStations/Connectors`,
 * `Locations/ListItem`, `Locations/ConnectorTable` and `Locations/RollupStats`
 * — and the four disagreed: "Charging" was `blue-500` in one and `indigo-500`
 * in another, "Reserved" was `violet-500` here and `amber-400` there. A
 * connector is one thing; it now reads the same wherever it is drawn.
 *
 * Seven states collapse onto five tones on purpose. The system spends colour on
 * what an operator has to *do* — nothing (`good`), watch (`live`), look at
 * (`warn`), fix (`bad`), ignore (`idle`) — not on the enum's cardinality. The
 * status text beside the dot still says which of the seven it is.
 *
 * `Occupied` is 2.0.1's and 2.1's, not 1.6's: those versions collapse
 * preparing, charging, both suspends and finishing into one in-use state, and
 * say which in the session's charging state instead. Without it here a 2.x
 * charger's busy connector fell through to `idle` and read as "ignore".
 * `utils/ocpp.ts` carries the label, icon and meaning of each of these, and
 * `OCPP_CHARGING_STATES` takes its shared states' tones from this map too.
 */
export const CONNECTOR_STATUS_TONES: Record<string, StatusTone> = {
  Available: "good",
  Charging: "live",
  Preparing: "live",
  Finishing: "live",
  Occupied: "live",
  Reserved: "live",
  SuspendedEVSE: "warn",
  SuspendedEV: "warn",
  Faulted: "bad",
  Unavailable: "idle",
};

/** A connector's tone, defaulting to `idle` for an unknown or absent status. */
export const connectorTone = (status: string | null | undefined): StatusTone =>
  (status && CONNECTOR_STATUS_TONES[status]) || "idle";
