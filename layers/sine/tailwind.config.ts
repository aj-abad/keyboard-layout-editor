import type { Config, CustomThemeConfig } from "tailwindcss/types/config";
// `.js`, not the extensionless subpath: Storybook evaluates this file through
// Node's ESM loader, which does not resolve `tailwindcss/plugin` — the same
// constraint that makes `.storybook/*.ts` imports carry explicit extensions.
import plugin from "tailwindcss/plugin.js";

/**
 * The design tokens. `docs/design-system.md` is the prose specification; this is
 * the single place their values are stated.
 *
 * Everything here is **exported as well as themed**, because a design system that
 * only exists as class names leaves every non-CSS consumer to restate it — which
 * is how nine copies of `#008168` and two different "control keyline" greys ended
 * up in components. A chart, a `Squircle` prop or the map style imports the
 * same constant the utility resolves to. Inside the layer that is a relative
 * import of this file; an app that extends the layer writes:
 *
 * ```ts
 * import { colors, statusTone } from "#layers/sine/tailwind.config";
 * ```
 *
 * Rules that are not obvious from the values:
 *
 * - **Ink, fill and line are alpha, deliberately.** One token then works on
 *   white, on the canvas and on glass, and a dark theme later is a token swap
 *   rather than a sweep. It also means `text-ink-3` composites differently on a
 *   dark surface — text on `surface-inverse` takes `text-ink-inverse`, not an
 *   ink step — and that an opacity modifier on one (`border-line/50`) replaces
 *   its alpha instead of scaling it, which the design lint refuses.
 * - **`borderColor.DEFAULT` is `line`**, so a bare `border`/`border-t` is already
 *   the house hairline and needs no colour class.
 * - **Status hues live here and are consumed only through `utils/status.ts`.**
 *   Nothing else may reach for a chromatic colour; see § Status in the spec.
 * - **The brand colours and the status tones have P3 twins** (`p3`). Their
 *   classes read a `--color-*` variable, the sRGB value on an sRGB screen and
 *   the twin on a wide-gamut one, and TypeScript that paints into the page
 *   takes the same variable from `colorVar`. The exports themselves stay sRGB.
 */

/** Text. Five steps, and they are the only ones. */
export const ink = {
  /** Headings, primary values, emphasis. */
  DEFAULT: "#000000",
  /** Running text, menu items. */
  2: "rgb(0 0 0 / 0.8)",
  /** Secondary text, card titles, form labels. */
  3: "rgb(0 0 0 / 0.7)",
  /**
   * Tertiary, placeholders, meta, captions. At 40% this was 2.84:1 on white —
   * under the 4.5:1 AA floor for the 12–14px text it is spent on, and `ink-3`
   * moved with it to keep the step between them legible.
   */
  4: "rgb(0 0 0 / 0.55)",
  /** Disabled text, decorative glyphs, separators. */
  5: "rgb(0 0 0 / 0.25)",
  /** Text on `surface-inverse`. Not an ink step — alpha black would go muddy. */
  inverse: "#ffffff",
  /**
   * Secondary and tertiary text on `surface-inverse`, as white alphas — the
   * same idea as `fill-inverse-2`/`-3`, and the same reason: a black alpha on a
   * dark surface is nothing. Two steps rather than four, because a dark surface
   * in this app carries a title, a line under it and no more.
   *
   * Both clear AA on `surface-inverse` (#262626): 70% composites to 8.2:1, 55%
   * to 5.6:1. 45% was the obvious pick for the lower step and lands at 4.3:1,
   * under the floor for the 12px text it would be spent on.
   */
  "inverse-2": "rgb(255 255 255 / 0.7)",
  "inverse-3": "rgb(255 255 255 / 0.55)",
} as const;

/** Interaction and chip fills. */
export const fill = {
  /** Row hover on a white card. */
  1: "rgb(0 0 0 / 0.03)",
  /** Chip, icon well, `kbd`; hover on the canvas. */
  2: "rgb(0 0 0 / 0.05)",
  /** Hover of a `fill-2` control, pressed row. */
  3: "rgb(0 0 0 / 0.1)",
  /** Pressed `fill-3`, scrollbar thumb, the `idle` status dot. */
  4: "rgb(0 0 0 / 0.2)",
  /**
   * The same two steps for a control sitting on `surface-inverse` or on
   * something else dark, where a black alpha lands on black and disappears.
   * That is not hypothetical: the active filter chip's dropdown half carried
   * `hover:bg-fill-2` while its clear half carried a white alpha, so one side
   * of the same chip had no hover at all.
   *
   * Only two steps, because a dark surface only ever needs a hover and a press
   * — the resting fills in the light scale exist to lift a control off a white
   * page, and a dark control is already lifted.
   */
  "inverse-2": "rgb(255 255 255 / 0.1)",
  "inverse-3": "rgb(255 255 255 / 0.18)",
} as const;

/** Soft green persistent-selection surface. */
export const tint = {
  /** Persistent selection on a solid surface. */
  DEFAULT: "#eef3e9",
  /** Five percent darker than rest, for tinted interaction states. */
  hover: "#e2e7dd",
  /** Ten percent darker than rest, for tinted interaction states. */
  pressed: "#d6dbd2",
} as const;

/** Veils. Separate from `fill` because they cover the page rather than an element. */
export const scrim = {
  /** Dialog and side-panel backdrop. */
  DEFAULT: "rgb(0 0 0 / 0.2)",
  /** The session-expired veil, and image overlays that carry text. */
  strong: "rgb(0 0 0 / 0.4)",
} as const;

export const surface = {
  /** Cards, sheets, solid menus. */
  DEFAULT: "#ffffff",
  /** A recessed panel or input fill *on* a card. */
  sunken: "#fafafa",
  /** Primary action, active pill, tooltip, focus ring. One dark tint, everywhere. */
  inverse: "#262626",
  /** `inverse` under a hover — white at 5% composited, so nothing shows through. */
  "inverse-hover": "#313131",
  /** `inverse` under a press — white at 10% composited. */
  "inverse-pressed": "#3b3b3b",
} as const;

/** The page ground the dashboard sits on. */
export const canvas = "#f4f4f5";

/**
 * Hairlines. One colour for every resting edge — card dividers, table rules,
 * control keylines, the settings `<hr>`, and the dividers inside glass.
 *
 * **Alpha, like ink and fill, since 2026-09-28.** `line` was `#e2e2e3`, a grey
 * tuned for a white card: 1.29:1 there, 1.18:1 on the canvas, 1.03:1 under a
 * pressed row's `fill-3`, and *lighter* than glass whose blurred backdrop is
 * darker than mid-grey, where a menu's divider read as a bright stripe, up to
 * 1.73:1 lighter than the glass around it. Black at 29/255 paints the same
 * pixel on white (`#e2e2e2`) and stays within a hair of 1.3:1 of every other
 * light ground, glass included, as a shade of it. `strong` is the same trade at
 * 54/255 (`#c9c9c9` on white).
 *
 * `strong` is only the *hover* or emphasis state of a border (a dropzone, an
 * unchecked checkbox, a selected squircle row). `inverse` is the same hairline
 * on a dark surface.
 *
 * A translucent line darkens wherever it covers itself, so:
 *
 * - a rounded keyline is an inset ring, an inset outline or a `Squircle`
 *   stroke, never a CSS `border`, whose sides overlap at a rounded corner and
 *   come out 5–8 levels darker there;
 * - it takes no opacity modifier: `border-line/50` replaces the alpha rather
 *   than scaling it, and is black at 50%;
 * - a colour that must not move with what is under it — the map's water, a
 *   chart's base series, the crop checkerboard — takes a solid value of its
 *   own rather than `line`.
 *
 * The design lint holds the first two. `line-glass`, white at 20% for a keyline
 * on glass, went with the switch: it vanished on light glass and on every solid
 * surface it had spread to. Glass keeps its own edge, `glassEdge.shade`.
 */
export const line = {
  DEFAULT: "rgb(0 0 0 / 0.114)",
  strong: "rgb(0 0 0 / 0.212)",
  /**
   * A hairline on a dark surface — the divider inside an active filter chip.
   * Black on a dark surface is nothing; this is the same hairline seen from
   * the other side.
   */
  inverse: "rgb(255 255 255 / 0.15)",
} as const;

/**
 * The five status tones.
 *
 * Validated against `surface` for the 4.5:1 text minimum; `dot` is the solid
 * marker beside the ink, and the `fill` is that dot at a low alpha — the tint
 * behind the ink. `idle` has no hue and resolves to ink/fill steps in
 * `utils/status.ts`, so it is absent here.
 *
 * **The fill is alpha, like every other fill in this file, and for the same
 * reason.** It was an opaque hex (Tailwind's `*-100`) until 2026-09-11, tuned
 * for a white card and nothing else: `#fee2e2` is a recess on white and a lit
 * pastel on a `fill-3` hover — lighter than its surround, its edge at 1.03:1 —
 * which is the pink-on-grey smudge the attention list drew on hover. At alpha
 * the well stays darker than whatever it sits on. Each alpha reproduces the old
 * hex on white to within a few RGB steps, so nothing validated there moved.
 *
 * The brand green is deliberately **not** among them: it is artwork (`brand`),
 * and `good` is the green a state takes, a shade darker so its text clears 4.5:1
 * on the canvas and in its own well, where the brand green does not: it reaches
 * 3.52:1 on the canvas, and 3.87:1 even on white.
 */
export const statusTone = {
  /** Online, settled, delivered, healthy. */
  good: { DEFAULT: "#047857", fill: "rgb(16 185 129 / 0.08)", dot: "#10b981" },
  /** Charging, held, in progress. */
  live: { DEFAULT: "#0369a1", fill: "rgb(14 165 233 / 0.13)", dot: "#0ea5e9" },
  /** Awaiting, suspended, needs attention, station issue. */
  warn: { DEFAULT: "#92400e", fill: "rgb(245 158 11 / 0.22)", dot: "#f59e0b" },
  /**
   * Failed, faulted, critical, forfeited. Also the one red: a destructive
   * action and a form error take this ink too. They had a maroon of their own,
   * `danger` (`#801013`, the brand palette's old `error`), until 2026-09-25:
   * this hue a shade darker, which no operator can tell from it by memory.
   */
  bad: { DEFAULT: "#b91c1c", fill: "rgb(239 68 68 / 0.16)", dot: "#ef4444" },
} as const;

/**
 * `borderColor.DEFAULT` is what makes a bare `border` correct. The rest of the
 * border palette comes from `colors` (Tailwind merges it in), so `border-line`,
 * `border-line-strong` and `border-line-inverse` all resolve.
 */
export const borderColor = {
  DEFAULT: line.DEFAULT,
} as const;

export const colors = {
  /**
   * The brand green, the Arcon mark's own colour. It is artwork: the mark and
   * the text selection, and nothing else. Until 2026-09-25 it was `primary`,
   * also the link colour and the chart series. A link now takes ink, chart
   * data takes ink, and a positive state takes `good`.
   */
  brand: "#16936c",
  tint,
  /**
   * Ampere's lime, at three depths within 6° of one hue, and nothing else of
   * the interface's. Until 2026-10-01 the lime was Arcon's `accent`, which the
   * interface never spent.
   *
   * - `ampere` is the lime itself: the arcs of Ampere's mark, which stay this
   *   one colour at every size, and the centre of its working spinner.
   * - `ampere-2` and `ampere-3` step it deeper, for where there is more than
   *   one thing to colour: the spinner's middle ring and its rim, and artwork.
   *
   * All three are too light to stand on white (the lime is 1.10:1 there), so
   * they always sit on ink, a `surface-inverse` hexagon, at 13.7:1, 11.4:1 and
   * 8.0:1, and none is ever a text colour.
   */
  ampere: {
    DEFAULT: "#e6ff8d",
    2: "#c5ef4a",
    3: "#9ccc1f",
  },

  ink,
  fill,
  scrim,
  surface,
  canvas,
  line,

  ...statusTone,
} as const;

/**
 * The identity hues: the colour of a seeded avatar, one hue a seed, at three
 * depths. They tell one workspace from another and say nothing about its state.
 *
 * - **Eight hues 45° apart** in OKLCH, from 10°, each at the same three
 *   lightnesses: ground L 0.948, mid L 0.835, deep L 0.50. Equal lightness is
 *   deliberate: in greyscale the eight mids fall within five steps of one grey,
 *   so the art's shape, not its hue, has to carry identity.
 * - **Muted, so none of them is a state.** Chroma is 0.026, 0.062 and 0.082 at
 *   the three depths, where the status dots run at 0.15 or more, and every one
 *   sits at least ΔE 10 (OKLab ×100) from each status dot, from `brand` and
 *   from `ampere`. The deep reaches 4.9:1 or more on its own ground.
 * - **Exported, not themed.** They are not in `colors`, so no class names one
 *   and nothing can paint a state or a surface with them: `utils/avatarArt.ts`
 *   is their one reader. Being muted, they take no P3 twins either; a wider
 *   gamut would only make them louder.
 *
 * The order is part of the art: a seed picks a hue by its index here, so
 * reordering or inserting one changes every avatar (see `AVATAR_ART_VERSION`).
 */
export const identity = {
  rose: { ground: "#ffe7ea", mid: "#eeb9c0", deep: "#8b4f58" },
  clay: { ground: "#fceade", mid: "#eabfa3", deep: "#875633" },
  ochre: { ground: "#f2efdb", mid: "#d2ca9c", deep: "#6e6427" },
  sage: { ground: "#e4f3e3", mid: "#b1d4b1", deep: "#447045" },
  lagoon: { ground: "#dbf4f2", mid: "#9ad6d2", deep: "#12726e" },
  steel: { ground: "#def1fd", mid: "#a2d0ec", deep: "#2c6a8b" },
  iris: { ground: "#eaecff", mid: "#c0c5f1", deep: "#5a5e91" },
  orchid: { ground: "#f7e8f8", mid: "#debce0", deep: "#7b527d" },
} as const;

export type IdentityHue = keyof typeof identity;

/** The identity hues in seed order, the order `identity` states them in. */
export const IDENTITY_HUES = Object.keys(identity) as IdentityHue[];

/**
 * The brand colours and the status tones on a wide-gamut display.
 *
 * Every value above is sRGB: the gamut every screen shows, and the one every
 * contrast ratio in the docs is measured in. A Display P3 screen (every recent
 * Mac, iPhone and iPad, and more and more others) shows chroma sRGB cannot
 * name, so on one these tokens take their twins below instead. A class reads
 * the token through its variable, `--color-good`, which the base layer points
 * at the sRGB value and, under `@media (color-gamut: p3)`, at the twin. An
 * sRGB screen keeps exactly the values validated on it.
 *
 * **A twin is its colour with 15% more chroma, hue and luminance held**
 * (`p3Twin` in `app/utils/gamut.ts`):
 *
 * - *Luminance held* keeps every contrast ratio: a twin reaches what its sRGB
 *   colour reaches, on every ground, so nothing validated in sRGB is validated
 *   again. OKLab lightness moves by under half a hundredth instead.
 * - *One gain for every tone* keeps them balanced against each other. P3
 *   reaches much further past sRGB in green and cyan than in red and amber, so
 *   moving each colour as far toward P3's edge as it sits toward sRGB's gave
 *   `good` and `live` a third more chroma and `warn` and `bad` a seventh: on a
 *   wide-gamut screen, "nothing to do" outshone "look at it".
 * - *15%* is the most all four tones can take inside P3; `warn`'s dot leaves
 *   it at 16%. `ampere` already sits on sRGB's edge and meets P3's at 10%,
 *   where it stops; its two deeper steps have the room and take the full 15%.
 *   Tailwind's v4 palette, which re-specified the same emerald, sky, amber
 *   and red for P3, gives them 10–14%.
 *
 * A fill is its dot's twin at the fill's alpha, as it is in sRGB. The neutrals
 * have no twins, since a grey is the same grey in both gamuts, and neither do
 * the tints: 15% of next to no chroma moves them by ΔE 0.2 at most, which no
 * one can see.
 *
 * The twins are written out rather than computed, so the config costs nothing
 * to import; `app/utils/gamut.test.ts` derives each one again from its sRGB
 * value, so a hex that moves without its twin fails the unit tests.
 */
export const p3ChromaGain = 1.15;

export const p3 = {
  brand: "color(display-p3 0.2112 0.5753 0.4225)",
  ampere: "color(display-p3 0.9176 1 0.5699)",
  "ampere-2": "color(display-p3 0.7958 0.9384 0.2936)",
  "ampere-3": "color(display-p3 0.6385 0.8007 0.1386)",
  good: "color(display-p3 0.1522 0.4696 0.3403)",
  "good-fill": "color(display-p3 0.2579 0.7242 0.5042 / 0.08)",
  "good-dot": "color(display-p3 0.2579 0.7242 0.5042)",
  live: "color(display-p3 0.119 0.4045 0.6469)",
  "live-fill": "color(display-p3 0.2137 0.6383 0.9327 / 0.13)",
  "live-dot": "color(display-p3 0.2137 0.6383 0.9327)",
  warn: "color(display-p3 0.5582 0.2513 0.0464)",
  "warn-fill": "color(display-p3 0.9434 0.6215 0.0411 / 0.22)",
  "warn-dot": "color(display-p3 0.9434 0.6215 0.0411)",
  bad: "color(display-p3 0.7058 0.1013 0.0961)",
  "bad-fill": "color(display-p3 0.9119 0.2637 0.2548 / 0.16)",
  "bad-dot": "color(display-p3 0.9119 0.2637 0.2548)",
} as const;

/** A token with a P3 twin, named as its class is: `brand`, `good-dot`. */
export type WideGamutToken = keyof typeof p3;

/**
 * Each twinned token as the page draws it: its variable, which is the sRGB
 * value on an sRGB screen and the twin on a P3 one. For TypeScript that paints
 * into the page, an SVG attribute, a `style` binding or an Observable Plot
 * mark, so it matches the classes beside it. A renderer that never reaches the
 * page's CSS cannot read a variable, and takes the sRGB value instead: MapLibre,
 * which draws in sRGB, and a 2D canvas, which does too unless it asks for
 * `display-p3`.
 */
export const colorVar = Object.fromEntries(
  Object.keys(p3).map((name) => [name, `var(--color-${name})`]),
) as Record<WideGamutToken, string>;

/** `colors` flattened into class-stem names, the way Tailwind names its utilities. */
const flattenColors = (tree: object, prefix = ""): Record<string, string> =>
  Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) => {
      const name = key === "DEFAULT" ? prefix : prefix ? `${prefix}-${key}` : key;
      return typeof value === "string"
        ? [[name, value]]
        : Object.entries(flattenColors(value, name));
    }),
  );

/** The sRGB value of each twinned token, what `--color-*` holds on an sRGB screen. */
const srgbOfTwinned = (() => {
  const flat = flattenColors(colors);
  return Object.fromEntries(Object.keys(p3).map((name) => [name, flat[name]!])) as Record<
    WideGamutToken,
    string
  >;
})();

/**
 * A twinned token as Tailwind resolves it. A plain utility takes the variable;
 * Tailwind hands it an `opacityValue` of its own `--tw-*-opacity` variable,
 * which nothing here sets, so that is read as "no modifier". A modifier
 * (`bg-bad/15`, the selection's `bg-brand/20`) cannot reach into a variable to
 * set its alpha, so it mixes the variable with `transparent` instead: the mix
 * is premultiplied, which makes it the colour at that alpha exactly. It mixes
 * in OKLab, which holds a colour from either gamut whole, where a mix in sRGB
 * may clip a twin to sRGB first.
 */
const themedColor =
  (name: WideGamutToken) =>
  ({ opacityValue }: { opacityValue?: string | number }) => {
    const variable = colorVar[name];
    const alpha = String(opacityValue ?? 1).trim();
    if (alpha === "1" || alpha.startsWith("var(")) return variable;
    const share = /^[\d.]+$/.test(alpha)
      ? `${Number((Number(alpha) * 100).toFixed(4))}%`
      : alpha.endsWith("%")
        ? alpha
        : `calc(${alpha} * 100%)`;
    return `color-mix(in oklab, ${variable} ${share}, transparent)`;
  };

/**
 * `colors` as the theme sees it: every twinned token replaced by its variable.
 * The exports stay plain sRGB strings, for the renderers that need a value.
 */
const themeColors = {
  ...colors,
  brand: themedColor("brand"),
  ampere: {
    DEFAULT: themedColor("ampere"),
    2: themedColor("ampere-2"),
    3: themedColor("ampere-3"),
  },
  ...Object.fromEntries(
    (Object.keys(statusTone) as (keyof typeof statusTone)[]).map((tone) => [
      tone,
      {
        DEFAULT: themedColor(tone),
        fill: themedColor(`${tone}-fill`),
        dot: themedColor(`${tone}-dot`),
      },
    ]),
  ),
};

/**
 * Glass, as three levels of one material.
 *
 * A level is not a blur setting — it is a blur, a saturation, a **wash** and a
 * **rim** that move together, because they are the same physical claim: how
 * thick the glass is. Blur throws away the scenery's high-frequency detail, and
 * a thicker slab throws away more, with more saturation to keep the colour it
 * averages; the wash is the surface's own body, laid over what the blur has
 * left, and it deepens a step with each level. And a thicker slab has a wider
 * edge, so the rim widens with it:
 *
 * | Level | Blur | Saturate | Wash (top-left → bottom-right) | Rim | Fade (sides, top and bottom) | For |
 * | --- | --- | --- | --- | --- | --- | --- |
 * | `sm` | 4px | 1.4 | 60% → 32% | 1.5px | 1.33px, 2.25px | a chip you should still read *through* |
 * | `md` | 12px | 1.6 | 70% → 40% | 3px | 2.67px, 4.5px | menus, popovers, map chrome |
 * | `lg` | 24px | 1.8 | 80% → 51% | 4.5px | 4px, 6.75px | a sheet carrying a list of text |
 *
 * **The blur carries a level, and the wash only tints it.** Until 2026-09-28
 * the washes were 60 / 80 / 94% at the lit end, and `lg`'s was near-opaque so
 * that a list of text held 7:1 even over black. Now `lg` takes what was `md`'s
 * wash at its own 24px blur, and `md` sits a step between `sm` and that: every
 * level reads as glass rather than a white sheet, and it is the blur that
 * takes the scenery's detail out from under the text, not a wash thick enough
 * to hide it. Over a flat, near-black ground a blur has nothing to average
 * away and the wash's thin corner is all the text has, so `lg`'s thin end is
 * 51% rather than `md`'s old 48%: the least that keeps a row's `ink-2` at
 * 4.5:1 even over black. `ink-2` on `md` falls under that over a ground darker
 * than 18% grey, and `ink-3` on `lg` under 13%; Increase Contrast
 * (`glassContrastWash`) restores both.
 *
 * All three once shared one wash (80% → 60% → 45%) with only the blur
 * changing; `sm` was too heavy to see through at all.
 *
 * The rim is its width in px: how far in from the outline it lights (see
 * `glassEdge`). It steps by 1.5px a level while the blur roughly triples, so a
 * chip keeps a bevel rather than a hairline and each level's edge is as far
 * from the next. Doubled at each level, as it first was, `lg`'s came to 6px
 * and the last step was twice the first. Scaled strictly with the blur, `sm`'s
 * would be half a pixel, a line.
 *
 * The fade is how far in content runs before it is whole again, where it meets
 * the rim (`glassRimFade`): `x` at the sides, `y` at the top and bottom.
 *
 * The blur and saturation figures match `UI/Squircle`'s own presets exactly,
 * so the `.glass-*` classes and the component's `glass` prop are
 * interchangeable. The washes are this app's, applied to both — see the note
 * over the glass block in `app/assets/sine.css`.
 */
export const glass = {
  sm: { blur: "4px", saturate: 1.4, wash: [0.6, 0.32], rim: 1.5, fade: { x: 1.33, y: 2.25 } },
  md: { blur: "12px", saturate: 1.6, wash: [0.7, 0.4], rim: 3, fade: { x: 2.67, y: 4.5 } },
  lg: { blur: "24px", saturate: 1.8, wash: [0.8, 0.51], rim: 4.5, fade: { x: 4, y: 6.75 } },
} as const satisfies Record<
  string,
  {
    blur: string;
    saturate: number;
    wash: [number, number];
    rim: number;
    fade: { x: number; y: number };
  }
>;

export type GlassLevel = keyof typeof glass;

/**
 * One distant light for the whole interface. It enters from the viewport's
 * top-left, so raised surfaces cast down-right at a fixed 1:2 x:y ratio and
 * reflective fields run from a lit top-left to a shaded bottom-right.
 *
 * CSS has no scene light, so every renderer reads its own equivalent of it: an
 * offset ratio for shadows, a 135deg axis for surface gradients, and an
 * azimuth and elevation for the SVG lighting filter that lights a glass rim.
 * Keeping them together is what stops a glass edge claiming one light while
 * the card below it casts from another.
 */
export const lighting = {
  source: "top-left",
  shadowXPerY: 0.5,
  surfaceAngle: "135deg",
  surfaceVector: { x1: 0, y1: 0, x2: 1, y2: 1 },
  /**
   * `feDistantLight`'s two angles. The azimuth turns clockwise from +x in a
   * space whose y runs down, so 225 points at the top-left, the same corner
   * the 135deg axis starts from. The elevation is the light's height above the
   * surface plane: at 30° it grazes an edge rather than flooding the face.
   */
  azimuth: 225,
  elevation: 30,
} as const;

/**
 * The edge of a glass surface: a flat keyline along the outline, and a rim
 * inside it lit by the scene light.
 *
 * **The rim is computed from the shape, not painted on it.** An SVG filter
 * blurs the shape's own alpha into a height field, whose slope is steepest at
 * the outline and zero inside it, so it stands in for the shape's distance
 * field. `feSpecularLighting` derives a normal at every pixel of that field and
 * lights it with a Phong term under `lighting`'s distant light. A straight top
 * edge has one normal and lights evenly along its length; a corner's normal
 * turns through 90°, so the highlight peaks where it faces the light and
 * falls away on either side; the bottom-right faces away and stays dark. The
 * flat interior, the outline moved the rim's width in, is then cut out, since a
 * light that high would lift it as a sheen, and the shape's alpha clips the
 * result. A squircle draws that face itself, on the concentric corner its
 * strokes take, so the rim runs as deep through a corner as along an edge; the
 * classes find it from the shape's alpha, blurred by the rim's width. Until
 * 2026-09-28 it was an erosion, which SVG does by a square: that cut a corner's
 * diagonal √2 as deep as an edge, and over the wash the rim ran a quarter deeper
 * through every corner. The rim is added to the surface with
 * `mix-blend-mode: plus-lighter`: it is light, so it adds rather than covers.
 *
 * **The rim widens with the level; the keyline does not.** A level's `rim` in
 * `glass` is how far in from the outline the rim lights, in px, and the filter
 * is scaled from it: the height field's blur is half that width, and the
 * bevel's steepness (`surfaceScale`) is the width times `steepness`, so the
 * slope at the outline, and with it the highlight's brightness and where it
 * falls, is the same at every width. A thicker slab is the same bevel, larger.
 * The keyline stays a hairline: it is the boundary, not the body.
 *
 * | Value | Role |
 * | --- | --- |
 * | `glass[level].rim` | How far in the rim lights, in px: its width |
 * | `steepness` | The bevel's `surfaceScale` per px of width |
 * | `exponent` | The Phong exponent: how tightly the highlight gathers where the edge faces the light. The material's, so every level shares it |
 *
 * At `md` that is the study the rim came from: a 1.5px height field, a surface
 * scale of 2.25 and a 3px band.
 *
 * **Both renderers draw it from these values.** A glass `Squircle` builds the
 * filter into its own chrome at its level's width; the `.glass-*` classes point
 * a pseudo-element at the document's `#glass-rim-sm`, `-md` or `-lg`
 * (`UI/GlassFilters.vue`, mounted once in the app shell). Keep the two in step
 * by keeping them here.
 *
 * It replaced a painted edge on 2026-09-27: a 135° gradient stroke from 92%
 * white at the top-left through 16% at 42% to the shade. A gradient along one
 * axis lights the whole top edge from its left end and fades it toward the
 * right, whatever the shape does; the rim lights what faces the light.
 */
export const glassEdge = {
  /** The flat keyline along the outline, under the rim's light (`glassStroke()`). */
  shade: "rgb(0 0 0 / 0.08)",
  rim: { steepness: 0.75, exponent: 12 },
} as const;

/**
 * Glass under Increase Contrast (`prefers-contrast: more`), which macOS, iOS
 * and Windows' contrast themes set: every level carries this wash, near
 * opaque, and the rim gives way to a keyline in `line-strong`. The material
 * still blurs; it stops asking text to hold against what shows through it.
 */
export const glassContrastWash = [0.96, 0.9] as const;

/**
 * The easing curve every gradient in the system is drawn on — a symmetric
 * ease-in-out, flat at both ends.
 *
 * Deliberately *not* `ease.standard`. That curve is for motion, where the eye
 * reads acceleration; this one is for a ramp in space, where what the eye picks
 * up is the seam at either end. Zero slope at 0 and 1 is what removes it.
 */
export const GRADIENT_EASE = [0.42, 0, 0.58, 1] as const;

/** How many stops approximate the curve. Twelve is past where the facets show. */
const GRADIENT_STOPS = 12;

/** `y` at `x` on a cubic Bézier with both anchors at 0 and 1, by bisection. */
const bezier = ([x1, y1, x2, y2]: readonly [number, number, number, number], x: number) => {
  const axis = (a: number, b: number, t: number) => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (axis(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }
  return axis(y1, y2, (lo + hi) / 2);
};

/**
 * A white wash from `from` alpha to `to` alpha, eased rather than linear.
 *
 * A two-stop `linear-gradient` interpolates alpha at a constant rate, so it
 * arrives at each end with slope still on it and the eye reads a seam where the
 * ramp starts and stops — the thing that makes a wash look painted on rather
 * than lit. The fix is Andreas Larsen's: approximate an easing curve with a run
 * of intermediate stops, so the ramp eases out of one end and into the other.
 * <https://larsenwork.com/easing-gradients/>
 *
 * Positions are uniform and the alpha is eased, which is the same curve as the
 * other way round and far easier to read in the built CSS. Interpolation is in
 * alpha alone — the colour is white at every stop — so there is no colour-space
 * or premultiplication question to get wrong.
 */
export const glassWash = (from: number, to: number, angle = lighting.surfaceAngle) => {
  const stops = Array.from({ length: GRADIENT_STOPS }, (_, i) => {
    const position = i / (GRADIENT_STOPS - 1);
    const alpha = from + (to - from) * bezier(GRADIENT_EASE, position);
    return `rgb(255 255 255 / ${Number(alpha.toFixed(4))}) ${Number((position * 100).toFixed(2))}%`;
  });
  return `linear-gradient(${angle}, ${stops.join(", ")})`;
};

/**
 * `bg-glass-sm` / `-md` / `-lg` — the wash alone, without blur or keyline —
 * and `bg-glass-contrast`, the wash every level takes under Increase Contrast.
 */
export const backgroundImage = {
  ...(Object.fromEntries(
    Object.entries(glass).map(([level, { wash }]) => [
      `glass-${level}`,
      glassWash(wash[0], wash[1]),
    ]),
  ) as Record<`glass-${GlassLevel}`, string>),
  "glass-contrast": glassWash(...glassContrastWash),
};

/**
 * How content inside glass meets the glass's edge: it fades out across the rim,
 * so a row scrolling past the edge of a sheet dissolves into the lit bevel
 * rather than being cut off at a line.
 *
 * The band runs from the outline, where the content is gone, to where it is
 * whole: the level's `fade` in `glass`, deeper at the top and bottom than at
 * the sides, as a ladder.
 *
 * - **Top and bottom, `y`**, where rows scroll out of view, it reaches where
 *   the rim's shine begins: one and a half rim widths in. The shine runs past
 *   the rim's flat face because the rim's filter cuts that face with a soft
 *   edge half the rim's width wide; measured over a dark ground on 2026-10-01,
 *   the light was down to a tenth of its peak 4.25px in on `md` and
 *   6.5–6.75px on `lg`.
 * - **The sides, `x`**, stop at a list's 4px inset on `lg`, where a row's fill
 *   runs beside the rim, so the fill keeps its edge there; taken to the shine
 *   it softened. `sm` and `md` keep the same proportion to their `y`.
 *
 * The alpha across the band is eased on `GRADIENT_EASE`, the curve every
 * gradient in the system is drawn on, so the fade has no seam where it starts
 * or ends.
 *
 * `Squircle` draws it as a stack of insets of the outline, one about every half
 * pixel of `y`, each laid in white over the last. A step moves the sides in by
 * its share of `x` and the top and bottom by its share of `y`, and its corner
 * is the outline's less the smaller of the two, so the band turns the corner
 * with the rim, from one depth to the other. Stacked, a step's alpha compounds
 * with those under it, so each is the share of what is still missing that
 * brings the band to the curve's value at the middle of that step. The last
 * step is opaque. Half a pixel is a device pixel at DPR 2, and each step's
 * edge is antialiased over the next, so the steps do not show.
 *
 * It replaced `ScrollArea`'s `edge-blur` on 2026-10-01: a 32px fade at each
 * end of a scroller with a progressive blur over it, four masked
 * `backdrop-filter` layers per edge. The edge a row disappears at is the
 * glass's, so the fade is the glass's too. It first ran the rim's width deep
 * all round, to the face; AJ widened it the same day to where the shine
 * begins, then held the sides to the lists' inset.
 */
export const glassRimFade = ({ x, y }: { readonly x: number; readonly y: number }) => {
  const steps = Math.max(2, Math.round(Math.max(x, y) * 2));
  let shown = 0;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const target = i === steps ? 1 : bezier(GRADIENT_EASE, (i + 0.5) / steps);
    const alpha = shown >= 1 ? 1 : (target - shown) / (1 - shown);
    shown = target;
    return { x: (x * i) / steps, y: (y * i) / steps, alpha: Number(alpha.toFixed(4)) };
  });
};

export interface ElevationShadowLayer {
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
  readonly color: string;
  /**
   * Cast onto the surface rather than by it: the layer is drawn inside the
   * box, as `box-shadow: inset` draws it, and describes the shadow the plane
   * *around* a recessed surface throws onto its floor.
   */
  readonly inset: boolean;
}

/**
 * A cool charcoal belongs to the canvas more naturally than transparent black:
 * it darkens the neutral ground without draining it into a grey stain. Every
 * layer uses it at a different alpha, and both CSS boxes and SVG squircles read
 * the same resulting records.
 */
const SHADOW_RGB = "24 24 34";
const shadowLayer = (
  y: number,
  blur: number,
  spread: number,
  alpha: number,
): ElevationShadowLayer => ({
  x: y * lighting.shadowXPerY,
  y,
  blur,
  spread,
  color: `rgb(${SHADOW_RGB} / ${alpha})`,
  inset: false,
});

/**
 * The same records, cast the other way. A surface one step *below* its
 * surroundings is shaded by the same light from the same side, so the layers
 * that lift a card by one step are what press a well down by one: identical
 * offsets, blurs, spreads and alphas, drawn inside the box rather than outside
 * it. The offset still runs down-right, which is what puts the shade along the
 * top and left inner edges — the rim between the light and the floor.
 */
const recessed = (layers: readonly ElevationShadowLayer[]): readonly ElevationShadowLayer[] =>
  layers.map((layer) => ({ ...layer, inset: true }));

/**
 * The elevation ladder as layered, eased shadows. Near layers are short,
 * defined and darker; successive layers travel farther, blur wider and fade.
 * That progression is the shadow equivalent of an easing curve rather than a
 * single uniformly blurred box. The construction follows
 * https://www.joshwcomeau.com/css/designing-shadows/.
 *
 * Do not animate these values: multiple blurred layers are intentionally a
 * static material. Animate transform/opacity on the owning surface instead.
 */
const raisedShadowLayers = {
  sm: [shadowLayer(1, 1, 0, 0.08), shadowLayer(2, 3, -1, 0.05), shadowLayer(4, 8, -3, 0.035)],
  md: [
    shadowLayer(1, 1, 0, 0.07),
    shadowLayer(2, 3, -1, 0.05),
    shadowLayer(4, 7, -2, 0.04),
    shadowLayer(8, 16, -5, 0.03),
  ],
  lg: [
    shadowLayer(1, 1, 0, 0.065),
    shadowLayer(2, 3, -1, 0.05),
    shadowLayer(4, 7, -2, 0.038),
    shadowLayer(8, 16, -5, 0.028),
    shadowLayer(16, 32, -10, 0.02),
  ],
  xl: [
    shadowLayer(2, 2, 0, 0.055),
    shadowLayer(4, 5, -1, 0.043),
    shadowLayer(8, 10, -3, 0.032),
    shadowLayer(16, 24, -8, 0.024),
    shadowLayer(32, 48, -16, 0.018),
  ],
  /** Glass floats at overlay depth, but stays lighter than an opaque menu. */
  glass: [
    shadowLayer(1, 1, 0, 0.055),
    shadowLayer(3, 4, -1, 0.04),
    shadowLayer(6, 12, -4, 0.03),
    shadowLayer(12, 32, -12, 0.022),
  ],
} as const satisfies Record<string, readonly ElevationShadowLayer[]>;

/**
 * The ladder runs both ways from the surface. `sm`, `md`, `lg` and `xl` lift a
 * surface one to four steps above its surroundings; `inset-sm`, `inset-md` and
 * `inset-lg` sink one to three steps below them, each the mirror of the
 * raised step it is named for. Glass has no recessed form: it floats.
 */
export const shadowLayers = {
  ...raisedShadowLayers,
  "inset-sm": recessed(raisedShadowLayers.sm),
  "inset-md": recessed(raisedShadowLayers.md),
  "inset-lg": recessed(raisedShadowLayers.lg),
} as const satisfies Record<string, readonly ElevationShadowLayer[]>;

const shadowCss = ({ x, y, blur, spread, color, inset }: ElevationShadowLayer) =>
  `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px ${color}`;

/** Tailwind's `shadow-*` utilities, generated from the renderer-neutral layers above. */
export const boxShadow = Object.fromEntries(
  Object.entries(shadowLayers).map(([name, layers]) => [name, layers.map(shadowCss).join(", ")]),
) as Record<keyof typeof shadowLayers, string>;

/** Named app layers. Intra-component stacking keeps the plain `z-10`/`z-20` scale. */
export const zIndex = {
  raised: "10",
  sticky: "20",
  floating: "50",
  backdrop: "199",
  modal: "200",
  "modal-menu": "250",
  palette: "300",
  /**
   * Above every surface an action can be fired from — a dialog, a menu inside
   * one, the palette — because that is where the result has to be readable.
   * Below `session`, which is a block rather than a surface: a toast raised
   * before the session expired must not sit over the re-auth dialog.
   */
  toast: "350",
  session: "400",
  tooltip: "500",
} as const;

/** See `app/utils/motion.ts`, which holds the same numbers for motion-v callers. */
export const transitionDuration = {
  fast: "100ms",
  base: "150ms",
  slow: "200ms",
  reveal: "250ms",
} as const;

export const transitionTimingFunction = {
  /** Entrances, and anything that slides. */
  standard: "cubic-bezier(0.32, 0.72, 0, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

/**
 * Control heights. `sm` is the default across the portal — dense operator
 * surfaces — with `md` reserved for login, onboarding and full-page forms.
 */
export const controlHeight = { xs: 24, sm: 32, md: 40, lg: 48 } as const;

/**
 * The spacing ladder, in px: the steps of Tailwind's scale that a padding, a
 * margin, a gap or an offset between things takes (`gap-2` is 8, `p-6` 24).
 * Fours up to 16, then 24, then 32, 48 and 64 for the few distances a page
 * sets once; each step is at least a third larger than the one below, so no
 * two read as the same distance. It governs space, not size: `w-*`, `h-*` and
 * `size-*` read the same scale and are set by what they hold.
 */
export const spacingLadder = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export type SpacingStep = (typeof spacingLadder)[number];

/**
 * The half steps a component keeps inside itself, which a page doesn't write:
 * 2 for a glyph's optical pull and a description under its title, 6 between a
 * glyph and its label at 24px and under, and 6 and 10 for the padding a row's
 * height leaves around its line. A control's inset comes with its size
 * (`Button`, `Input`) and is on neither list.
 */
export const componentSpacing = [2, 6, 10] as const;
export type ComponentSpacingStep = (typeof componentSpacing)[number];

/**
 * The focus treatment's geometry: a 2px ring, 2px outside the control. It is
 * `.focus-ring`'s outline below and the numbers a ring drawn as a shape takes
 * — `TimePicker` slides one around the focused column as a squircle 4px
 * outside the row's band, at the band's radius plus that reach, so it is
 * concentric with it.
 */
export const focusRing = { width: 2, offset: 2 } as const;

/**
 * The only sizes an icon is drawn at. `IconSize` is the same ladder as a type,
 * for a table that hands a glyph its size at runtime (`Button`'s `ICON`,
 * `Avatar`'s `SIZES`); the design lint holds every `:size` in a template to
 * the array, since Phosphor's own prop is `number | string`. 18 is Nucleo's
 * rung (2026-09-19): the grid its ui glyphs are drawn on and the size the
 * navigation rail draws them at — a Phosphor glyph, on a 256 grid, has no
 * reason to be there.
 */
export const iconSize = [12, 14, 16, 18, 20, 24, 32, 48] as const;
export type IconSize = (typeof iconSize)[number];

/** Floating map explorer geometry and the camera space it reserves. */
export const mapViewport = {
  gutter: 12,
  explorerWidth: 320,
  explorerHeight: 704,
  inspectorHeight: 448,
  compactBreakpoint: 768,
  compactHeightRatio: 0.52,
  cameraInset: 80,
  explorerClearance: 48,
  compactClearance: 40,
} as const;

/** Shared geometry for DOM map pins and the map's raster sprites. */
export const mapPin = {
  size: 36,
  icon: 16,
  width: 52,
  height: 48,
  x: 8,
  y: 4,
  radius: 12,
  tipWidth: 12,
  tipHeight: 5,
  badge: 24,
  badgeIcon: 12,
  badgeInset: 4,
  /**
   * The cluster badge's all-attention dot. It carries no numeral, so it needs
   * no 24px shell to stay legible over map tiles — it is drawn at its own size
   * with the separator alone, the way the saved badge draws its separator
   * around a dark disc.
   */
  badgeDot: 10,
  separator: 2,
  shadowBlur: 2,
  shadowY: 2,
  pixelRatio: 2,
  clusterFont: 14,
  clusterPadding: 12,
} as const;

/** `type-micro` / `text-micro` — the one custom size on the scale. */
const MICRO = { fontSize: "0.6875rem", lineHeight: "0.75rem" } as const;

/**
 * `SplitView`'s two widths: the source list beside its content, then the
 * inspector beside both. They answer the split view's own width, not the
 * viewport's, because the canvas narrows with the rail and with any panel
 * docked beside it. The split view is the whole canvas, so a 1280px window
 * leaves it 992px beside the expanded rail and 1208px beside the collapsed
 * one; a viewport breakpoint cannot tell those apart. 56rem is the narrowest
 * split view that keeps a 384px list between the 14rem source list and the
 * 18rem inspector.
 * Published as the `split-sidebar:` and `split-inspector:` variants, so a
 * pane's content can change shape at the same moment the panes do.
 */
export const splitView = {
  container: "split-view",
  sidebarAt: "40rem",
  inspectorAt: "56rem",
} as const;

/**
 * The component classes, registered as a plugin rather than written in
 * `app/assets/sine.css`.
 *
 * That is not a style preference: Tailwind resolves `@apply` against core
 * utilities, the theme, and classes declared in the *same* stylesheet — so a
 * class defined in `sine.css` cannot be `@apply`-ed from an SFC's `<style>`
 * block, which PostCSS processes as its own entry ("The `focus-ring` class does
 * not exist"). Registering them here puts them in every pass. Anything a
 * component might `@apply` belongs in this file; the classes that are only ever
 * written in a template (`.glass-*`, `.dropdown-*`) can stay in the stylesheet.
 *
 * **Check a new name against Tailwind's own utilities before adding it.** These
 * land in the components layer, which is emitted *before* utilities, and a bare
 * class ties on specificity — so a utility of the same name silently wins. This
 * class was `.list-item` until Tailwind's `display: list-item` overrode the
 * `flex` on every selectable row in the portal. Nothing catches it: the rule is
 * emitted, `@apply` resolves and the build passes. Prefer a name no utility
 * could take (`-row` over `-item`), and let the design lint (`cli/lint.mjs`)
 * diff these names against bare selectors in the built CSS.
 */
export const plugins = [
  plugin(({ addBase, addComponents }) => {
    const focusOutline = {
      outline: `${focusRing.width}px solid ${surface.inverse}`,
      outlineOffset: `${focusRing.offset}px`,
    };

    /*
     * The keyline, published as a custom property so the `.glass-*` ring in
     * `sine.css` draws the same shade a glass `Squircle` takes through
     * `glassStroke()`. Registered here rather than written into the stylesheet
     * because this file is where the token lives; a second copy in CSS is a
     * second thing to keep in step. The rim's numbers reach the classes through
     * `#glass-rim-sm`, `-md` and `-lg` (`UI/GlassFilters.vue`), which read them
     * from here too.
     */
    addBase({
      ":root": {
        "--glass-shade": glassEdge.shade,
      },
    });

    /*
     * The twinned tokens' variables: sRGB, then the twins where the screen is
     * wide-gamut (see `p3`). The `@supports` keeps a browser that knows the
     * media query but not `color()` (Chrome 58–110) on sRGB, where a twin it
     * can't parse would leave every class that reads it with no colour at all.
     */
    const variables = (values: Record<WideGamutToken, string>) =>
      Object.fromEntries(Object.entries(values).map(([name, value]) => [`--color-${name}`, value]));
    addBase({
      ":root": variables(srgbOfTwinned),
      "@supports (color: color(display-p3 1 1 1))": {
        "@media (color-gamut: p3)": { ":root": variables(p3) },
      },
    });

    addComponents({
      /*
       * The one focus treatment: a 2px ring in `surface-inverse`, 2px off the
       * element, drawn as an outline. An outline rather than a `ring-*` because
       * a ring is a box-shadow, and on a glass surface it would replace
       * `shadow-glass` instead of sitting beside it. It lands on the next frame
       * — no fade, per decision 11. Squircle controls draw the same colour and
       * width as a stroke instead (`CONTROL_FOCUS_COLOR`), because an outline
       * cannot follow a smoothed corner.
       */
      ".focus-ring": { outline: "none", "&:focus-visible": focusOutline },
      /*
       * The same ring on a dark surface, where the standard one is invisible —
       * it is drawn in `surface-inverse`, which is what a dark surface *is*.
       * Same width and offset; only the ink flips, so it is still one
       * treatment rather than a second idea.
       *
       * It is declared immediately after `.focus-ring` on purpose: a control
       * carrying both (the `inverse` button variants do, since the base cva
       * string owns `focus-ring`) resolves them at equal specificity, so
       * source order is what decides. Moving `focus-ring` out of those base
       * strings into each variant would settle it properly.
       */
      ".focus-ring-inverse": {
        outline: "none",
        "&:focus-visible": { ...focusOutline, outline: `2px solid ${ink.inverse}` },
      },
      /** Scroll viewports clip an outside ring. Keep the same ink and width inside their edge. */
      ".focus-ring-inset": {
        outline: "none",
        "&:focus-visible": { ...focusOutline, outlineOffset: "-2px" },
      },
      /** The same, on a container whose child takes the focus — a pill around an `<input>`. */
      ".focus-ring-within": { outline: "none", "&:focus-within": focusOutline },

      /*
       * Type roles — size, weight and ink together, because those three are
       * what a role *is*. The heading level comes from the document outline and
       * never from the size, so `<h2 class="type-label">` is correct and
       * common. They are components, so a utility at the call site still wins:
       * `type-label truncate`, or `type-label text-ink` for full-strength ink.
       */
      ".type-display": {
        fontSize: "1.75rem",
        lineHeight: "2.25rem",
        fontWeight: "450",
        letterSpacing: "-0.02em",
        color: ink.DEFAULT,
      },
      ".type-title": {
        fontSize: "1.5rem",
        lineHeight: "2rem",
        fontWeight: "500",
        color: ink.DEFAULT,
      },
      ".type-heading": {
        fontSize: "1.125rem",
        lineHeight: "1.75rem",
        fontWeight: "500",
        color: ink.DEFAULT,
      },
      ".type-subheading": {
        fontSize: "1rem",
        lineHeight: "1.5rem",
        fontWeight: "500",
        color: ink.DEFAULT,
      },
      ".type-label": {
        fontSize: "0.875rem",
        lineHeight: "1.25rem",
        fontWeight: "500",
        color: ink[3],
      },
      ".type-body": { fontSize: "1rem", lineHeight: "1.5rem", color: ink[2], textWrap: "balance" },
      ".type-body-sm": { fontSize: "0.875rem", lineHeight: "1.25rem", color: ink[2] },
      ".type-caption": { fontSize: "0.75rem", lineHeight: "1rem", color: ink[4] },
      ".type-micro": { ...MICRO, fontWeight: "500", color: ink[4] },
      ".type-eyebrow": {
        fontSize: "0.875rem",
        lineHeight: "1.25rem",
        fontWeight: "500",
        // textTransform: "uppercase",
        // letterSpacing: "0.08em",
        color: ink[4],
      },
      /*
       * A link in running text. It isn't a role: it sets no size, weight or
       * line height, so it takes the sentence's, and no display or padding,
       * so it wraps with the sentence instead of standing out of the line as
       * a box. It sets its ink, `ink` whatever the sentence is set in, and an
       * underline in `line-strong` that darkens to `ink` under the pointer.
       * Focus is the shared outline, which follows the radius: a full one
       * gives it a pill's ends, the shape `LinkButton`'s ring has, and it
       * follows a wrapped link along its lines. A link has no fill, so the
       * radius shows nowhere else. A link that stands on its own, as a
       * control, is `LinkButton`.
       */
      ".link": {
        color: ink.DEFAULT,
        textDecorationLine: "underline",
        textDecorationColor: line.strong,
        textUnderlineOffset: "3px",
        borderRadius: "9999px",
        outline: "none",
        "&:hover": { textDecorationColor: ink.DEFAULT },
        "&:focus-visible": focusOutline,
      },
      /*
       * Selectable rows. Two classes, because two widgets use the same ARIA to
       * mean different things and that is exactly why they had drifted apart:
       *
       * - In a **menu or combobox** the cursor moves and Enter commits. The
       *   cursor is `data-highlighted`, Reka's attribute for it, and it alone
       *   takes the fill: the pointer moves the cursor in every Reka menu and
       *   listbox, so hover and the keyboard are one row — "this is what will
       *   happen". A list that draws its own cursor sets the attribute on its
       *   cursor row. Chosen-ness is a check, not a fill.
       * - In a **list** the row stays chosen after the pointer leaves, so
       *   `aria-selected` marks *what is chosen*. It gets the selection tint,
       *   and the hover fill still means "this is what will happen".
       *
       * Neither `:hover` nor `aria-selected` fills a `.menu-item`. `:hover`
       * stays on the row under a resting pointer after the keyboard moves on,
       * which would fill two rows; and Reka's select marks its *chosen* option
       * `aria-selected`, the listbox meaning, which would paint every chosen row
       * of a multi-select as the cursor.
       *
       * Before this the palette and the location dialog painted their keyboard
       * cursor `bg-primary/10 text-primary` while every menu painted it
       * `fill-2`, and "selected" was `tint/50` in three places and `tint/60` in
       * a fourth. Three channels — pointer/keyboard, chosen, focused — and they
       * must not borrow each other's colours.
       */
      ".menu-item": {
        display: "flex",
        width: "100%",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.375rem 0.5rem",
        borderRadius: "0.5rem",
        fontSize: "0.875rem",
        lineHeight: "1.25rem",
        color: ink[2],
        cursor: "pointer",
        outline: "none",
        "&[data-highlighted]": {
          backgroundColor: fill[2],
          color: ink.DEFAULT,
        },
        "&[data-state='checked']": { fontWeight: "500", color: ink.DEFAULT },
        "&[data-disabled], &:disabled": { pointerEvents: "none", opacity: "0.5" },
      },
      ".menu-item--destructive": {
        color: colorVar.bad,
        "&[data-highlighted]": {
          backgroundColor: `color-mix(in oklab, ${colorVar.bad} 10%, transparent)`,
          color: colorVar.bad,
        },
      },
      /**
       * A menu drawn as a sheet on a compact viewport (`ContextMenuContent`):
       * the same rows, sized for a thumb rather than a pointer — 44px tall,
       * body-size type, a corner one step up — so a tap has something to land
       * on. Set on the surface, so a row written for a popper needs nothing.
       */
      ".menu-sheet": {
        "& .menu-item": {
          minHeight: "2.75rem",
          gap: "0.75rem",
          padding: "0.625rem 0.75rem",
          borderRadius: "0.75rem",
          fontSize: "1rem",
          lineHeight: "1.5rem",
        },
      },
      ".list-row": {
        position: "relative",
        display: "flex",
        width: "100%",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.5rem 0.75rem",
        borderRadius: "1rem",
        textAlign: "left",
        color: ink[2],
        cursor: "pointer",
        outline: "none",
        "&:hover, &[data-active]": { backgroundColor: fill[2], color: ink.DEFAULT },
        "&:active": { backgroundColor: fill[3] },
        "&[aria-selected='true'], &[data-selected]": {
          backgroundColor: tint.DEFAULT,
          color: ink.DEFAULT,
        },
        "&:focus-visible": focusOutline,
        "&[aria-disabled='true'], &:disabled": { pointerEvents: "none", opacity: "0.5" },
      },
      /**
       * Glass keeps interaction fills translucent so the material remains one
       * surface; an opaque chromatic tint reads as a card pasted onto glass.
       * Hover is `fill-1`, selection and press `fill-2`, a pressed selection
       * `fill-3` — the attention rows' scale on a card, one step under the
       * `fill-2` / `fill-3` / `fill-4` this drew until 2026-09-23. The inbox's
       * wells are status tints at alpha, and the heavier ladder grayed them
       * under a selected row (the 8% `good` well read gray-green); on this
       * one every tone keeps its hue and its glyph at 4:1 or better. Selection
       * is a step quieter than it was, which the open detail panel beside it
       * makes up for.
       */
      ".list-row--glass": {
        "&:hover, &[data-active]": { backgroundColor: fill[1], color: ink.DEFAULT },
        "&:active": { backgroundColor: fill[2] },
        "&[aria-selected='true'], &[data-selected]": {
          backgroundColor: fill[2],
          color: ink.DEFAULT,
        },
        "&[aria-selected='true']:active, &[data-selected]:active": {
          backgroundColor: fill[3],
        },
      },
      /**
       * The segmented control's track, on glass. `Tabs` sits its white
       * thumb on a `fill-2` track, and the thumb is only visible *because*
       * the track is a step darker than it; a glass strip that has taken the
       * track's place (`track="glass"`, or a strip around `track="none"`) is
       * a 70% white wash, and a white thumb on it was a shape nobody could
       * see (2026-09-17). This is the same `fill-2`, laid over the wash — the
       * neutral alpha scale is what the spec puts on glass, so the material
       * is still white glass and not a second tint of it. A pseudo-element
       * because a `background-color` sits *under* a `background-image`, and
       * the wash is one: `bg-fill-2` on a glass surface darkens it by two
       * levels of gray at the lit end. On a `Squircle` it goes on
       * `surfaceClass` and the surface's clip takes it. A `.glass-*` box has
       * spent `::after` on its lit rim, so there the track is an inset shadow
       * instead (`sine.css`, beside the rim) and this rule stands aside.
       */
      ".glass-track:not(.glass, .glass-sm, .glass-md, .glass-lg)": {
        "&::after": {
          content: '""',
          position: "absolute",
          inset: "0",
          borderRadius: "inherit",
          backgroundColor: fill[2],
          pointerEvents: "none",
        },
      },
      /**
       * A form's fields: a column, 4px apart, in which every field holds its
       * chin's one line open (`--field-chin-line`, which `UI/FieldChin.vue`
       * reads) whether or not there is anything in it. The line carries the
       * description at rest and the error in its place, so a refusal lands in
       * room that was already there. Without it, an error under a field with no
       * description pushes everything below it down, and in a dialog, which is
       * centered, it moves the fields above it too, by half as much.
       *
       * The 20px is the line's own box: 4px over one 16px line of
       * `type-caption`. At rest a control and the next field's name are 24px
       * apart, the line and then the gap. A second line of error still pushes,
       * by 16px, which is one more reason for the short errors the copy rules
       * ask for.
       *
       * A grid row inside keeps its own column gap, and takes `gap-y-1` if it
       * wraps. `UI/Checkbox.vue` holds no line: checkboxes come in lists, and
       * a line under each would open the list up.
       */
      ".fields": {
        display: "flex",
        flexDirection: "column",
        rowGap: "0.25rem",
        "--field-chin-line": "1.25rem",
      },
      /**
       * The hairline between the rows of a list, drawn by the row's *body* —
       * the element holding the label — rather than by the row. It lies on
       * the top edge of whatever carries it, from that element's leading edge to
       * its trailing edge, so on a row laid out as `[leading well][body]` the
       * line starts where the label starts and the well column stays clear
       * of it (iOS's separator inset), and a body that carries the row's
       * trailing padding runs the line under that padding to the card's edge.
       * Nothing about the inset is a number: it falls out of the layout, so
       * two lists with different wells agree by construction.
       *
       * The line takes no space and is the two rows' shared border, the way a
       * collapsed table border is: a pseudo-element centred on the seam, half
       * a pixel into the row above and half into the row below, so each row
       * is the same size with or without it and neither owns the line. It
       * paints above both rows' fills, so a hover on either row runs under
       * its half. At 2x that is one device pixel each side of the seam. Where
       * a device pixel can't be split (1x, 1.25x, 1.5x) the browser snaps the
       * line whole to one side, which side depending on where the list falls
       * on the pixel grid; it never blurs across both. `top: -0.5px` rather
       * than `translateY(-50%)`, which does blur there (measured 2026-09-30).
       *
       * A row clipped to the card's corner has to leave its content unclipped,
       * as `Pill` does, or the clip cuts the half that lies in the row above.
       * `Divider` is this line on a rule of no height. A row's hover and
       * press fill covers the whole of each line it shares: see
       * `.list-hairline-fill` below.
       */
      ".list-hairline": {
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: "-0.5px",
          left: "0",
          right: "0",
          borderTop: `1px solid ${line.DEFAULT}`,
          pointerEvents: "none",
        },
      },
      /**
       * A hairline-list row's hover and press fill, run over the whole of each
       * line the row shares, so the line lies inside the fill whichever of its
       * two rows is lit. The row sets `--list-fill` for the state, e.g.
       * `hover:[--list-fill:theme(colors.fill.2)]`, and every piece of its
       * fill reads it.
       *
       * `.list-hairline-fill` is a middle row's, with a line above and below:
       * one layer from the top edge of the line above to the bottom edge of
       * the line below. Its top is the line's own `-0.5px`. Its bottom is the
       * line's own 1px border, transparent, under a box one row tall: a border
       * is drawn in whole device pixels (0.8px at 1.25x), so a plain `0.5px`
       * past the row would overshoot the line by a pixel there. One layer,
       * because fills are alpha, and two that overlap show as a darker band.
       *
       * An end row keeps its fill on its own surface, a `Pill` cut from the
       * card's corner, and carries a `.list-hairline-overhang-below` (the top
       * row) or `-above` (the bottom row) for the half of its line past its
       * edge: a copy of the line's box in the fill, clipped to the far side of
       * the seam. Clipped by `overflow`, which the browser snaps to device
       * pixels; a `clip-path` blurs the edge, and a separate half-pixel strip
       * is drawn a whole device pixel tall. Each was measured at 1x, 1.25x,
       * 1.5x, 2x and 3x (2026-09-30): no pixel filled twice, none missed.
       */
      ".list-hairline-fill": {
        position: "relative",
        isolation: "isolate",
        "&::before": {
          content: '""',
          position: "absolute",
          top: "-0.5px",
          left: "0",
          right: "0",
          height: "100%",
          boxSizing: "content-box",
          borderBottom: "1px solid transparent",
          backgroundColor: "var(--list-fill, transparent)",
          zIndex: "-1",
          pointerEvents: "none",
        },
      },
      ".list-hairline-overhang-below": {
        position: "absolute",
        top: "100%",
        left: "0",
        right: "0",
        height: "1px",
        overflow: "hidden",
        pointerEvents: "none",
        "&::after": {
          content: '""',
          position: "absolute",
          top: "-0.5px",
          left: "0",
          right: "0",
          borderTop: "1px solid var(--list-fill, transparent)",
        },
      },
      ".list-hairline-overhang-above": {
        position: "absolute",
        bottom: "100%",
        left: "0",
        right: "0",
        height: "1px",
        overflow: "hidden",
        pointerEvents: "none",
        "&::after": {
          content: '""',
          position: "absolute",
          top: "0.5px",
          left: "0",
          right: "0",
          borderTop: "1px solid var(--list-fill, transparent)",
        },
      },

      ".type-data": {
        fontFamily: "PPNeueMontrealMono, monospace",
        fontSize: "0.875rem",
        lineHeight: "1.25rem",
        fontVariantNumeric: "tabular-nums",
      },
    });
  }),
  plugin(({ addVariant }) => {
    addVariant(
      "split-sidebar",
      `@container ${splitView.container} (min-width: ${splitView.sidebarAt})`,
    );
    addVariant(
      "split-inspector",
      `@container ${splitView.container} (min-width: ${splitView.inspectorAt})`,
    );
  }),
];

export const theme: Partial<
  CustomThemeConfig & {
    extend: Partial<CustomThemeConfig>;
  }
> = {
  fontFamily: {
    sans: ["PPNeueMontreal", "sans-serif"],
    mono: ["PPNeueMontrealMono", "monospace"],
    /**
     * The Text cut, for text pages, where reading is the task. It sets about 12%
     * wider than the sans, so the interface stays on `sans`.
     */
    text: ["PPNeueMontrealText", "PPNeueMontreal", "sans-serif"],
  },
  extend: {
    backgroundImage,
    borderColor,
    // Tailwind reads a function as a colour, but its types only allow strings.
    colors: themeColors as unknown as CustomThemeConfig["colors"],
    boxShadow,
    zIndex,
    /*
     * A bare `transition-*` carries Tailwind's `DEFAULT` duration and curve,
     * which were Tailwind's own 150ms on `cubic-bezier(0.4, 0, 0.2, 1)`: a
     * transition written without a token still moved, on a curve the system
     * does not have. The defaults are the tokens instead — `base` on
     * `standard` — so it lands on one. They live here rather than in the
     * exports, which the motion specimens list.
     */
    transitionDuration: { ...transitionDuration, DEFAULT: transitionDuration.base },
    transitionTimingFunction: {
      ...transitionTimingFunction,
      DEFAULT: transitionTimingFunction.standard,
    },
    fontSize: {
      /** `type-micro` — kbd, badges, dense meta. Was the `.text-xxs` base class. */
      micro: [MICRO.fontSize, { lineHeight: MICRO.lineHeight }],
    },
    spacing: {
      /**
       * 18px, Nucleo's grid and this app's standard icon size. Tailwind's own
       * scale jumps 16 → 20, so `size-4.5` has to be declared before a control
       * can ask its glyph for it.
       */
      "4.5": "1.125rem",
      /** The navigation rail, and the settings category column that matches it. */
      sidebar: "18rem",
      /**
       * The same rail, collapsed to its icons: 16px of gutter either side of a
       * 40px square. That gutter is not a round number by accident — it puts a
       * collapsed glyph on the exact centre line its expanded row's glyph sat
       * on (12px of scroll gutter plus the row's own 14px of padding), so the
       * icons hold still while the rail narrows around them and only the
       * labels leave.
       */
      "sidebar-collapsed": "4.5rem",
    },
  },
};

/**
 * The theme and the plugins as one Tailwind config: what `@nuxtjs/tailwindcss`
 * loads from the layer's root, and what a Tailwind config outside Nuxt takes as
 * a preset (`presets: [sine]`). Content paths are the app's to give; the module
 * adds the layer's own.
 */
export default { theme, plugins } satisfies Partial<Config>;
