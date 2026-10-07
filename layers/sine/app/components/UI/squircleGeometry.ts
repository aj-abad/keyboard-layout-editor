import type { ComponentPublicInstance, CSSProperties } from "vue";

export const DEFAULT_SQUIRCLE_RADIUS = 16;
/** The one corner treatment used by every squircle, including pills. */
export const DEFAULT_SQUIRCLE_SMOOTHING = 0.7;

/**
 * How a corner is drawn. `g3` since 2026-09-26: curvature rises along a
 * smoothstep off the edge, holds on the arc and falls back, so it is
 * continuous at every joint, and its rate of change is too, to within 5.4% of
 * its peak (see `G3_BREAKS`). `figma` is Figma's corner smoothing, a Bézier into a
 * circular arc: continuous where it leaves the edge, but at 0.7 it reaches the
 * arc at 1.43/r where the arc continues at 1/r, a step in curvature that
 * reads as a shoulder in a reflection. It is kept for side-by-sides, and as
 * the way back.
 */
export type SquircleConstruction = "g3" | "figma";
export const SQUIRCLE_CONSTRUCTION: SquircleConstruction = "g3";

export type RadiusToken = "none" | "sm" | "DEFAULT" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";

export type SquircleCornerRadius = number | RadiusToken;
export type SquircleCornerRadii = readonly [
  SquircleCornerRadius,
  SquircleCornerRadius,
  SquircleCornerRadius,
  SquircleCornerRadius,
];
export type SquircleRadius = SquircleCornerRadius | SquircleCornerRadii;
export type SquirclePixelRadii = readonly [number, number, number, number];
/** A distance a shape sits inside its container: one value, or `[top, right, bottom, left]`. */
export type SquircleInset = number | readonly [number, number, number, number];
export type SquirclePathRadius = number | SquirclePixelRadii;
export type SquircleBorderSideWidths = readonly [number, number, number, number];
export type SquircleBorderSideColors = readonly [string, string, string, string];
export type SquircleBorderStyle = "solid" | "dashed" | "dotted";
export type SquircleBorderSideStyle = SquircleBorderStyle | "none";
export type SquircleBorderSideStyles = readonly [
  SquircleBorderSideStyle,
  SquircleBorderSideStyle,
  SquircleBorderSideStyle,
  SquircleBorderSideStyle,
];

export interface MotionValueLike<T> {
  get(): T;
  on(event: "change", listener: (value: T) => void): () => void;
}

export type SquircleVisualValue<T> = T | MotionValueLike<T>;

export interface SquircleAppearance {
  readonly radius?: SquircleVisualValue<SquircleRadius>;
  readonly borderWidth?: SquircleVisualValue<number | SquircleBorderSideWidths>;
  readonly borderColor?: SquircleVisualValue<string | SquircleBorderSideColors>;
}

export type SquircleGlass = "sm" | "md" | "lg";

export interface SquircleShadowLayer {
  readonly x?: number;
  readonly y?: number;
  readonly blur?: number;
  readonly spread?: number;
  readonly color?: string;
  /** Drawn inside the shape, as `box-shadow: inset` is: a recessed surface. */
  readonly inset?: boolean;
}

/**
 * The elevation ladder, both ways from the surface: `sm` to `xl` raise, the
 * `inset-*` three recess by the same steps. Mirrors `shadowLayers` in
 * `tailwind.config.ts`, which is the source.
 */
export type SquircleShadowPreset =
  "sm" | "md" | "lg" | "xl" | "glass" | "inset-sm" | "inset-md" | "inset-lg";

/**
 * An opening through the fill: a band `width` px wide whose outer edge sits
 * `inset` px inside the outline, concentric with it. It is a hole in the
 * fill's clip path rather than a line painted to match, so whatever lies
 * behind the shape shows through it — a card, the canvas, glass, a map —
 * without the shape having to know which. Only the fill is cut; the content,
 * the strokes and the shadows are drawn as before.
 */
export interface SquircleCut {
  readonly inset: number;
  readonly width: number;
}

export type SquircleTipSide = "top" | "right" | "bottom" | "left";

/**
 * A tip: a triangle standing on one side of the outline, the point a tooltip
 * aims at what it names. It is part of the path rather than a second shape
 * laid against it, so everything drawn from the path takes it: the fill, a
 * glass surface's blur and its lit rim, the border, and the shadow, which a
 * triangle of CSS borders beside the box could carry none of.
 *
 * The tip stands outside the box, as a shadow does: the box keeps its size and
 * the caller leaves the tip its room. It needs a straight run to stand on, so
 * the corners of its side give up smoothing to make one where the side is
 * short, and a side with no run at all, a capsule's end, draws no tip.
 */
export interface SquircleTip {
  readonly side: SquircleTipSide;
  /**
   * Where the point sits along the side, in px: from the left of a top or
   * bottom side, from the top of a left or right one. The middle of the side
   * when left out. It is held clear of the corners.
   */
  readonly at?: number;
  /** The base, along the side. */
  readonly width?: number;
  /** How far the point stands off the side. Half the base when left out. */
  readonly height?: number;
  /** The radius the point is rounded to. */
  readonly radius?: number;
}

/** The house tip: a tooltip's, 8px across and 4px tall, its point just off sharp. */
export const DEFAULT_SQUIRCLE_TIP = { width: 8, radius: 1 } as const;

/** A tip with nothing left to default, fitted to the side it stands on. */
export type PlacedSquircleTip = Required<SquircleTip>;

export interface ConcentricOptions {
  /**
   * The floor a derived corner will not go below. Defaults to a square corner,
   * which is what the arithmetic gives whenever a shape is inset by its
   * container's whole radius — the house `p-6` card on a 24px corner.
   */
  readonly minimum?: SquircleCornerRadius;
}

export interface SquircleProps {
  readonly as?: string | object;
  readonly appearance?: SquircleAppearance;
  readonly radius?: SquircleRadius;
  readonly concentric?: boolean | ConcentricOptions;
  readonly surfaceClass?: string;
  /**
   * Open a band through the fill (`SquircleCut`). `Pill` sets it while the
   * keyboard focuses a pill with `focusRing="cut"`: the primary button's ring.
   */
  readonly surfaceCut?: SquircleCut | null;
  /**
   * Stand a tip on one side of the outline (`SquircleTip`). The fill, the
   * glass, the border and the shadow all follow it; the content and its clip
   * keep to the box.
   */
  readonly tip?: SquircleTip | null;
  /**
   * Clip the slot to the shape as well, for content that paints to the edge: a
   * map, an image, or rows whose fills reach the corners. The clipped layer
   * stays in flow and fills the root, so padding and layout go on
   * `contentClass`. Never clip the root itself: `overflow-*` there cuts the
   * shadow. The clipped layer is the backdrop root of any glass inside it, so a
   * plain, opaque `surfaceClass` fill is painted inside it too, as its ground.
   */
  readonly clipContent?: boolean;
  /** The clipped layer's classes: with `clipContent`, the slot's padding and layout. */
  readonly contentClass?: string;
  readonly glass?: SquircleGlass;
  readonly shadow?: SquircleShadowPreset | readonly SquircleShadowLayer[] | null;
  readonly highlight?: boolean | string;
  readonly borderWidth?: number | SquircleBorderSideWidths;
  readonly borderColor?: string | SquircleBorderSideColors;
  readonly borderStyle?: SquircleBorderStyle | SquircleBorderSideStyles;
  readonly rightInset?: SquircleVisualValue<number>;
}

/** Tailwind's default `borderRadius` scale at a 16px root. */
export const RADIUS_TOKENS: Record<RadiusToken, number> = {
  none: 0,
  sm: 2,
  DEFAULT: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  full: 9999,
};

export const radiusToPx = (radius: SquircleCornerRadius): number =>
  typeof radius === "number" ? radius : RADIUS_TOKENS[radius];

export const radiiToPx = (radius: SquircleRadius): SquirclePathRadius =>
  Array.isArray(radius)
    ? [radiusToPx(radius[0]), radiusToPx(radius[1]), radiusToPx(radius[2]), radiusToPx(radius[3])]
    : radiusToPx(radius as SquircleCornerRadius);

export interface SquirclePathOptions {
  readonly width: number;
  readonly height: number;
  readonly radius: SquirclePathRadius;
  readonly x?: number;
  readonly y?: number;
  /** A tip standing on one side. Drawn by the house construction only. */
  readonly tip?: SquircleTip | null;
  /** The house value unless a test or a side-by-side is asking what another looks like. */
  readonly smoothing?: number;
  /** The house construction unless a test or a side-by-side is asking for the other. */
  readonly construction?: SquircleConstruction;
}

/**
 * The Bézier that takes one edge into the arc, from Figma's construction:
 * `a`, `b`, `c` step along the edge and `d` off it, so the curve leaves the
 * edge at `(1 + smoothing) × radius` from the corner and meets the circle
 * `45° × smoothing` in. The leaving Bézier is the same curve mirrored.
 */
interface CornerParams {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const round = (value: number) => Number(value.toFixed(4));

const getCornerParams = (radius: number, smoothing: number): CornerParams => {
  const clampedSmoothing = Math.max(0, Math.min(smoothing, 1));
  const p = (1 + clampedSmoothing) * radius;
  const arcMeasure = 90 * (1 - clampedSmoothing);
  const arcSectionLength = Math.sin(toRadians(arcMeasure / 2)) * radius * Math.SQRT2;
  const angleAlpha = (90 - arcMeasure) / 2;
  const p3ToP4Distance = radius * Math.tan(toRadians(angleAlpha / 2));
  const angleBeta = 45 * clampedSmoothing;
  const c = p3ToP4Distance * Math.cos(toRadians(angleBeta));
  const d = c * Math.tan(toRadians(angleBeta));
  const b = (p - arcSectionLength - c - d) / 3;
  const a = 2 * b;

  return { a, b, c, d };
};

const asFourRadii = (radius: SquirclePathRadius): SquirclePixelRadii =>
  typeof radius === "number" ? [radius, radius, radius, radius] : radius;

/**
 * `full` is a semantic pill radius, not a literal 9999px corner: it asks for
 * **half the short side**, whatever that side currently measures. Resolving it
 * here rather than leaving 9999 to `fitSquircleRadii` is what lets a per-corner
 * value sit beside it in the same tuple — the proportional fit would otherwise
 * scale the whole set down by the sentinel and take the stated corner with it.
 *
 * A pill is a capsule, and a capsule's end is a semicircle. Half the short side
 * is a radius the corner cannot smooth *across that side*: `fitCornerClaims`
 * finds two of them facing each other with no straight edge between them and
 * hands each back exactly its own radius there — but only there. Along the
 * long side the same corner keeps an eased approach — `CAPSULE_SMOOTHING`,
 * since 2026-09-13 — so the cap is a semicircle entered through a curve that
 * ramps in rather than starting all at once. Before that a corner carried one
 * smoothing for both of its edges, the cap's zero won, and the ends were plain
 * semicircles meeting the long edges with a visible change of curvature —
 * invisible on a button, plain on a 470px toast.
 * The full 0.7 was tried there first and stretched the ends into ellipses;
 * see `CAPSULE_SMOOTHING` for the number.
 *
 * It was briefly `min / (2 × (1 + smoothing))` (2026-09-08), sized so each
 * corner's whole `(1 + smoothing) × radius` claim fit inside half the side.
 * That keeps 0.7 intact and costs the pill: a 48px control drew a 14px arc
 * where a capsule wants 24, so every button, chip, tab and nav row flattened
 * into a rounded rectangle. Only the clipped surface flattened, at that — the
 * stroke and shadow paths derive their radii through an offset, landing a hair
 * under the sentinel and back on this rule — so a bordered pill drew a capsule
 * keyline around a squarer fill. The login field's autofill tint, which is
 * painted on that surface layer, is where the gap showed.
 */
const resolveFullRadii = (
  width: number,
  height: number,
  radius: SquirclePathRadius,
): SquirclePixelRadii => {
  const pillRadius = Math.min(width, height) / 2;

  const [topLeft, topRight, bottomRight, bottomLeft] = asFourRadii(radius);
  const resolve = (corner: number) => (corner >= RADIUS_TOKENS.full ? pillRadius : corner);
  return [resolve(topLeft), resolve(topRight), resolve(bottomRight), resolve(bottomLeft)];
};

/**
 * Move every corner of a radius in or out by `offset`, keeping `full` full.
 *
 * A stroke is drawn along a path inset by half its width and a shadow along one
 * grown by its spread, and both need the corner that box would have. Subtracting
 * from the pill sentinel drops it just under the threshold, so the derived shape
 * stops being read as a pill; it is `resolveFullRadii` that knows what `full`
 * means at a given size, and it is handed the offset box anyway.
 */
export const offsetSquircleRadius = (
  radius: SquirclePathRadius,
  offset: number,
): SquirclePathRadius => {
  const move = (corner: number) =>
    corner >= RADIUS_TOKENS.full ? corner : Math.max(0, corner + offset);

  if (typeof radius === "number") return move(radius);
  return [move(radius[0]), move(radius[1]), move(radius[2]), move(radius[3])];
};

/** Apply CSS's proportional overlap rule before smoothing claims side length. */
export const fitSquircleRadii = (
  width: number,
  height: number,
  radius: SquirclePathRadius,
): SquirclePixelRadii => {
  const [rawTopLeft, rawTopRight, rawBottomRight, rawBottomLeft] = asFourRadii(radius);
  const topLeft = Math.max(0, rawTopLeft);
  const topRight = Math.max(0, rawTopRight);
  const bottomRight = Math.max(0, rawBottomRight);
  const bottomLeft = Math.max(0, rawBottomLeft);
  const ratios = [
    width / (topLeft + topRight),
    height / (topRight + bottomRight),
    width / (bottomRight + bottomLeft),
    height / (bottomLeft + topLeft),
  ].filter(Number.isFinite);
  const scale = Math.min(1, ...ratios);

  return [topLeft * scale, topRight * scale, bottomRight * scale, bottomLeft * scale];
};

/**
 * The radius a shape needs to nest **concentrically** inside a container: the
 * container's own corner, less the distance the shape sits inside it, floored
 * at `minimum`. It is SwiftUI's `ConcentricRectangle` as arithmetic — two
 * corners that share a curve centre read as one shape held at two depths,
 * where two independently chosen radii read as two shapes.
 *
 * Three things it decides, none of them obvious:
 *
 * - **A corner takes the larger of its two adjacent insets.** A shape inset
 *   unevenly has no single answer at a corner, and the larger inset is the one
 *   that has already moved the corner away from the container's. This is the
 *   same rule `SquircleChrome`'s `innerBorderPath` uses to derive the inside of
 *   an unequal border, so a nested shape and a thick border round alike.
 * - **A pill container stays a pill.** `full` is semantic geometry rather than a
 *   9999px corner (see `resolveFullRadii`), so subtracting from it would drop
 *   the corner just under the threshold and hand `squirclePath` a literal
 *   9991px radius to fit against the *container's* box rather than the inset
 *   one. A capsule inset by any amount is still a capsule, and half the inset
 *   shape's own short side is the corner that says so.
 * - **A negative inset is read as zero.** A shape hanging outside its container
 *   has no concentric answer; taking the container's own corner is the reading
 *   that stays continuous as it crosses back inside.
 *
 * The result collapses to a single number when all four corners agree, so the
 * common case stays a plain radius rather than a tuple.
 */
export const concentric = (
  container: SquircleRadius,
  inset: SquircleInset,
  minimum: SquircleCornerRadius = 0,
): number | SquirclePixelRadii => {
  const [topLeft, topRight, bottomRight, bottomLeft] = asFourRadii(radiiToPx(container));
  const [top, right, bottom, left] =
    typeof inset === "number" ? ([inset, inset, inset, inset] as const) : inset;
  const floor = radiusToPx(minimum);

  const corner = (radius: number, first: number, second: number) =>
    radius >= RADIUS_TOKENS.full
      ? RADIUS_TOKENS.full
      : Math.max(floor, radius - Math.max(first, second, 0));

  const corners: SquirclePixelRadii = [
    corner(topLeft, top, left),
    corner(topRight, top, right),
    corner(bottomRight, bottom, right),
    corner(bottomLeft, bottom, left),
  ];

  return corners.every((value) => value === corners[0]) ? corners[0]! : corners;
};

/** Which edge of its container a flush row shares — see `flushRadii`. */
export type FlushEdge = "top" | "bottom" | "both";

/**
 * The corners of a row that runs edge to edge inside a squircle and sits
 * flush with its top, its bottom, or both: the container's own corners on the
 * edge they share — `concentric` at an inset of 0 — and square where the row
 * meets the next one. This is how an iOS grouped list draws its cells: the
 * section's corner belongs to the first and last cell's highlight, and a cell
 * in the middle of the stack is a rectangle that needs no clip at all. Only
 * the two ends of a hairline list take one; see `Overview/AttentionList.vue`.
 */
export const flushRadii = (container: SquircleRadius, edge: FlushEdge): SquirclePixelRadii => {
  const [topLeft, topRight, bottomRight, bottomLeft] = asFourRadii(radiiToPx(container));
  return [
    edge === "bottom" ? 0 : topLeft,
    edge === "bottom" ? 0 : topRight,
    edge === "top" ? 0 : bottomRight,
    edge === "top" ? 0 : bottomLeft,
  ];
};

export type SquircleElementTarget = HTMLElement | ComponentPublicInstance | null | undefined;

/** The host element behind a template ref, whether it resolved to a tag or a component. */
export const toSquircleElement = (target: SquircleElementTarget): HTMLElement | null => {
  if (!target) return null;
  if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) return target;
  const root = (target as ComponentPublicInstance).$el as unknown;
  return typeof HTMLElement !== "undefined" && root instanceof HTMLElement ? root : null;
};

/**
 * How far along each of its two edges a corner reaches: `(1 + smoothing) ×
 * radius`, cut back to what the edge has room for. `x` is the claim along the
 * horizontal edge, `y` along the vertical one.
 */
interface CornerClaims {
  x: number;
  y: number;
}

/**
 * The smoothing a corner keeps along its long edge once its other edge is a
 * cap — a capsule's end, or one side of a fully rounded box.
 *
 * A capped corner has no straight run on one side, so the house 0.7 has
 * nowhere to go there; the question is how much of it to keep on the other.
 * All of it reads wrong: at 0.7 the approach runs `1.7 × r` along an end only
 * `r` high, and a 52px toast's ends came out as visibly stretched ellipses
 * (2026-09-13). None of it is the plain semicircle that met the long edges
 * with a kink. At 0.35 the join is eased and the end still reads as a
 * semicircle. This is not a second house smoothing — every squircle with two
 * straight edges to run along still gets 0.7 — it is what a capsule can carry.
 */
export const CAPSULE_SMOOTHING = 0.35;

/** Per corner, whether each of its edges runs along a cap. */
type CappedEdges = readonly [
  Record<"x" | "y", boolean>,
  Record<"x" | "y", boolean>,
  Record<"x" | "y", boolean>,
  Record<"x" | "y", boolean>,
];

const NO_RESERVE = [0, 0, 0, 0] as const;

/** The sides of the box as `[first corner, second corner, axis, length]`. */
const boxSides = (width: number, height: number) =>
  [
    [0, 1, "x", width],
    [1, 2, "y", height],
    [2, 3, "x", width],
    [3, 0, "y", height],
  ] as const;

/**
 * A side its two arcs already fill is a cap: a capsule's end, or one side of a
 * fully rounded box. Both of its corners are capped along that side's axis.
 */
const cappedEdges = (radii: SquirclePixelRadii, width: number, height: number): CappedEdges => {
  const capped = radii.map(() => ({ x: false, y: false })) as [
    Record<"x" | "y", boolean>,
    Record<"x" | "y", boolean>,
    Record<"x" | "y", boolean>,
    Record<"x" | "y", boolean>,
  ];
  for (const [first, second, axis, length] of boxSides(width, height)) {
    if (radii[first] + radii[second] < length) continue;
    capped[first][axis] = true;
    capped[second][axis] = true;
  }
  return capped;
};

/**
 * A corner's claims are fitted **per edge**. Two corners sharing a side split
 * that side's shortfall in proportion to the smoothing each brought, and a
 * side that has no room at all takes both back to the bare radius — but only
 * along itself. The same corner's other edge is fitted against its own side.
 *
 * That independence is what makes a capsule: its short side has no straight
 * run, so the claims across it collapse to the radius and the cap is a true
 * semicircle, while the long side keeps an approach — `CAPSULE_SMOOTHING` of
 * it, since the full value stretched the end. One claim per corner (until
 * 2026-09-13) let the short side's zero decide both edges, and every pill met
 * its long edges with a kink.
 *
 * `reserve` is length a side keeps back from its corners, in the order of
 * `boxSides`: the base of a tip standing on it. The corners split what is left
 * as they split any shortfall, so on a short side they ease in over less of it
 * and the tip keeps a straight run to stand on.
 */
const fitCornerClaims = (
  radii: SquirclePixelRadii,
  smoothing: number,
  width: number,
  height: number,
  reserve: readonly [number, number, number, number] = NO_RESERVE,
): readonly [CornerClaims, CornerClaims, CornerClaims, CornerClaims] => {
  const clampedSmoothing = Math.max(0, Math.min(smoothing, 1));
  const sides = boxSides(width, height);

  // Each corner of a cap approaches along its *other* edge with the capsule's
  // smoothing.
  const capped = cappedEdges(radii, width, height);
  const along = (index: number, axis: "x" | "y") => {
    const other = axis === "x" ? "y" : "x";
    const value = capped[index]![other]
      ? Math.min(clampedSmoothing, CAPSULE_SMOOTHING)
      : clampedSmoothing;
    return radii[index]! * (1 + value);
  };
  const claims = radii.map((_, index) => ({
    x: along(index, "x"),
    y: along(index, "y"),
  })) as [CornerClaims, CornerClaims, CornerClaims, CornerClaims];

  for (const [index, [first, second, axis, length]] of sides.entries()) {
    const overflow = claims[first][axis] + claims[second][axis] - (length - reserve[index]!);
    if (overflow <= 0) continue;

    const firstExtra = claims[first][axis] - radii[first];
    const secondExtra = claims[second][axis] - radii[second];
    const extra = firstExtra + secondExtra;
    if (extra <= 0) continue;

    const remaining = Math.max(0, extra - overflow) / extra;
    claims[first][axis] = radii[first] + firstExtra * remaining;
    claims[second][axis] = radii[second] + secondExtra * remaining;
  }

  return claims;
};

/**
 * One corner's drawing: the Bézier that leaves the edge it is entered from,
 * the arc, and the Bézier that lands on the edge it leaves by. `in` and `out`
 * are `getCornerParams` for each edge's own smoothing, and `arcIn`/`arcOut`
 * are the arc's chord resolved along the entering and leaving directions —
 * equal when the two smoothings match, which is the symmetric corner the
 * Figma construction describes, and different for a capsule's end.
 */
interface Corner {
  readonly in: CornerParams;
  readonly out: CornerParams;
  readonly arcIn: number;
  readonly arcOut: number;
}

const buildCorner = (radius: number, smoothingIn: number, smoothingOut: number): Corner => {
  // Each Bézier turns through 45° × its smoothing; the arc takes the rest of
  // the quarter, from the entering Bézier's end to the leaving one's start.
  const from = toRadians(45 * Math.max(0, Math.min(smoothingIn, 1)));
  const to = toRadians(90 - 45 * Math.max(0, Math.min(smoothingOut, 1)));
  return {
    in: getCornerParams(radius, smoothingIn),
    out: getCornerParams(radius, smoothingOut),
    arcIn: radius * (Math.sin(to) - Math.sin(from)),
    arcOut: radius * (Math.cos(from) - Math.cos(to)),
  };
};

/*
 * The G3 corner. It is specified by its curvature rather than by control
 * points: zero on the edge, rising along a smoothstep to the arc's 1/R,
 * holding for the arc and falling back the same way, then integrated into an
 * outline. Smoothstep starts and ends flat, so curvature and its rate of
 * change both meet the edge and the arc without a step. SVG only has cubic
 * Béziers, which cannot hold that exactly, so each transition is drawn as
 * cubics that are exact to curvature (G2) at every joint and follow the
 * profile closely in between.
 */

/**
 * Where a transition is cut into cubics, as fractions of its length. A cubic
 * that leaves a straight edge with zero curvature grows its curvature
 * linearly, where smoothstep's grows as the square, so the pieces are short
 * where the ramp starts flat. These breakpoints make the largest step left in
 * the rate of change of curvature as small as four pieces allow: 5.4% of its
 * peak at 0.7. The Figma corner steps by 8.6% of that peak where it leaves the
 * edge, and at its arc it steps in curvature itself.
 */
const G3_BREAKS = [0, 0.036, 0.151, 0.488, 1] as const;

/** Eight-point Gauss–Legendre nodes and weights on [−1, 1]. */
const GAUSS_LEGENDRE = [
  [-0.9602898564975363, 0.1012285362903763],
  [-0.7966664774136267, 0.2223810344533745],
  [-0.525532409916329, 0.3137066458778873],
  [-0.1834346424956498, 0.362683783378362],
  [0.1834346424956498, 0.362683783378362],
  [0.525532409916329, 0.3137066458778873],
  [0.7966664774136267, 0.2223810344533745],
  [0.9602898564975363, 0.1012285362903763],
] as const;

/** A cubic's two handles and its end: `[x1, y1, x2, y2, x, y]`. */
type Cubic = readonly [number, number, number, number, number, number];

/**
 * One transition at a unit arc radius, in its own frame: it leaves the origin
 * heading along +x and bends toward +y through `turn` radians. The arc it hands
 * over to is centred `along` the edge from the origin and `1 + off` away from
 * it: easing curvature in carries the curve wide of the circle it would
 * otherwise start on, so the arc sits `off` further in.
 */
interface Transition {
  readonly turn: number;
  readonly along: number;
  readonly off: number;
  readonly pieces: readonly Cubic[];
}

/**
 * The cubic from `(x0, y0)` at heading `h0` and curvature `k0` to `(x3, y3)` at
 * heading `h3` and curvature `k3`: G2 Hermite interpolation. The two handle
 * lengths solve a pair of quadratics, found by Newton's method from a circular
 * arc's handles. A piece this short and this gently bent has one positive
 * solution beside that guess, and the guess stands if the iteration strays.
 */
const g2Cubic = (
  x0: number,
  y0: number,
  h0: number,
  k0: number,
  x3: number,
  y3: number,
  h3: number,
  k3: number,
  length: number,
): Cubic => {
  const cos0 = Math.cos(h0);
  const sin0 = Math.sin(h0);
  const cos3 = Math.cos(h3);
  const sin3 = Math.sin(h3);
  const dx = x3 - x0;
  const dy = y3 - y0;
  // Cross products of the two unit tangents and the chord.
  const tangents = cos0 * sin3 - sin0 * cos3;
  const leaving = cos0 * dy - sin0 * dx;
  const arriving = dx * sin3 - dy * cos3;
  const bend = h3 - h0;
  const guess = Math.abs(bend) > 1e-9 ? (length * (4 / 3) * Math.tan(bend / 4)) / bend : length / 3;

  let a = guess;
  let b = guess;
  for (let step = 0; step < 24; step++) {
    const f1 = 1.5 * k0 * a * a - leaving + b * tangents;
    const f2 = 1.5 * k3 * b * b - arriving + a * tangents;
    const j11 = 3 * k0 * a;
    const j22 = 3 * k3 * b;
    const det = j11 * j22 - tangents * tangents;
    if (Math.abs(det) < 1e-18) break;
    const da = (f2 * tangents - f1 * j22) / det;
    const db = (f1 * tangents - f2 * j11) / det;
    a += da;
    b += db;
    if (Math.abs(da) + Math.abs(db) < 1e-14) break;
  }
  if (!(a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b))) {
    a = guess;
    b = guess;
  }
  return [x0 + a * cos0, y0 + a * sin0, x3 - b * cos3, y3 - b * sin3, x3, y3];
};

const transitionCache = new Map<number, Transition>();

/**
 * The transition for one smoothing value, cached, since a page's corners only
 * take a handful. The ramp is smoothstep in closed form: at a fraction `u` of
 * its length, curvature is u²(3 − 2u) and heading is turn × u³(2 − u), and at a
 * unit radius the length is twice the turn. Each piece's end is integrated by
 * Gauss–Legendre quadrature.
 */
const transitionFor = (smoothing: number): Transition => {
  const key = Math.round(Math.max(0, Math.min(smoothing, 1)) * 1e6);
  const cached = transitionCache.get(key);
  if (cached) return cached;

  const turn = toRadians(45 * (key / 1e6));
  let transition: Transition = { turn: 0, along: 0, off: 0, pieces: [] };
  if (turn > 0) {
    const length = 2 * turn;
    const heading = (u: number) => turn * u * u * u * (2 - u);
    const curvature = (u: number) => u * u * (3 - 2 * u);
    const pieces: Cubic[] = [];
    let x = 0;
    let y = 0;
    for (let index = 1; index < G3_BREAKS.length; index++) {
      const from = G3_BREAKS[index - 1]!;
      const to = G3_BREAKS[index]!;
      const half = (to - from) / 2;
      let cos = 0;
      let sin = 0;
      for (const [node, weight] of GAUSS_LEGENDRE) {
        const h = heading(from + half * (1 + node));
        cos += weight * Math.cos(h);
        sin += weight * Math.sin(h);
      }
      const endX = x + cos * half * length;
      const endY = y + sin * half * length;
      pieces.push(
        g2Cubic(
          x,
          y,
          heading(from),
          curvature(from),
          endX,
          endY,
          heading(to),
          curvature(to),
          (to - from) * length,
        ),
      );
      x = endX;
      y = endY;
    }
    transition = { turn, along: x - Math.sin(turn), off: y - (1 - Math.cos(turn)), pieces };
  }
  if (transitionCache.size >= 1024) transitionCache.clear();
  transitionCache.set(key, transition);
  return transition;
};

/** A sized G3 corner: its arc, its transition along each edge, and its reach along each. */
interface G3Corner {
  readonly arc: number;
  readonly x: Transition;
  readonly y: Transition;
  readonly reachX: number;
  readonly reachY: number;
}

/**
 * Size a corner. Easing curvature in pushes the arc inward, so an arc that
 * kept the corner's radius would cut deeper than the corner used to. The arc
 * is sized instead to take the same amount off the sharp corner as a circle
 * of that radius: it passes `(√2 − 1) × radius` from the corner point, which
 * is where the Figma corner's arc crosses the diagonal. That holds each
 * token's silhouette within about half a percent of its radius of the Figma
 * one. A capped corner has no choice: its arc has to meet its twin's across
 * the cap, so it reaches exactly its radius along that side.
 */
const sizeG3Corner = (
  radius: number,
  alongX: Transition,
  alongY: Transition,
  capped: Record<"x" | "y", boolean>,
): G3Corner => {
  const arc =
    capped.x && capped.y
      ? radius
      : capped.y
        ? radius / (1 + alongX.off)
        : capped.x
          ? radius / (1 + alongY.off)
          : (radius * (Math.SQRT2 - 1)) / (Math.hypot(1 + alongX.off, 1 + alongY.off) - 1);
  return {
    arc,
    x: alongX,
    y: alongY,
    reachX: arc * (alongX.along + 1 + alongY.off),
    reachY: arc * (alongY.along + 1 + alongX.off),
  };
};

const g3Round = (value: number) => Math.round(value * 1e4) / 1e4;

/** The sides in the order of `boxSides`, clockwise from the top. */
const TIP_SIDES: readonly SquircleTipSide[] = ["top", "right", "bottom", "left"];

/** A side with under a pixel of straight run draws no tip. */
const TIP_MINIMUM = 1;

/**
 * One edge of a tip, in the tip's own frame: `u` along the side from the
 * tip's middle, `v` out from the side. The point is an arc of `radius` whose
 * top is the tip's height off the side, and each edge runs from an end of the
 * base to where it touches that arc, so rounding the point steepens the edges
 * rather than shortening the tip. This is the edge on the `+u` side; the other
 * is its mirror.
 */
interface TipEdge {
  /** Where the edge meets the arc. A sharp point's is the point itself. */
  readonly u: number;
  readonly v: number;
  /** The edge's unit normal, away from the tip. */
  readonly normalU: number;
  readonly normalV: number;
  /** The point's radius, held to what the tip has room for. */
  readonly radius: number;
}

const tipEdge = (halfWidth: number, height: number, radius: number): TipEdge => {
  const rounding = Math.max(0, Math.min(radius, height, halfWidth));
  const centre = height - rounding;
  const distance = Math.hypot(halfWidth, centre);
  const run = Math.sqrt(Math.max(0, distance * distance - rounding * rounding));
  const heading = Math.atan2(centre, -halfWidth) - Math.asin(Math.min(1, rounding / distance));
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  return { u: halfWidth + run * cos, v: run * sin, normalU: sin, normalV: -cos, radius: rounding };
};

/**
 * A placed tip on the outline moved `offset` px out, or in when negative: the
 * tip a stroke, a shadow's spread or a rim's face draws, so each runs parallel
 * to the fill's tip the whole way round it. The edges move along their
 * normals, which narrows the base as the outline moves in, and the point's
 * radius moves with them. Moved in past its own rounding the point is sharp,
 * where the two edges cross, and a tip with nothing left of its base is gone.
 */
export const offsetSquircleTip = (
  tip: PlacedSquircleTip,
  offset: number,
): PlacedSquircleTip | undefined => {
  if (offset === 0) return tip;
  const halfWidth = tip.width / 2;
  const edge = tipEdge(halfWidth, tip.height, tip.radius);
  const moved = halfWidth + (offset * (1 - edge.normalV)) / edge.normalU;
  if (!(moved >= TIP_MINIMUM / 2)) return undefined;

  const radius = edge.radius + offset;
  const height =
    radius >= 0
      ? tip.height
      : (offset + halfWidth * edge.normalU) / Math.max(edge.normalV, 1e-9) - offset;
  if (!(height > 0)) return undefined;
  return {
    side: tip.side,
    at: tip.at + offset,
    width: 2 * moved,
    height,
    radius: Math.max(0, radius),
  };
};

/** The four corners as the G3 outline draws them, and the tip as its side has room for it. */
interface G3Layout {
  readonly corners: readonly [
    G3Corner | undefined,
    G3Corner | undefined,
    G3Corner | undefined,
    G3Corner | undefined,
  ];
  readonly tip?: PlacedSquircleTip;
}

/**
 * Size the corners and place the tip. The tip's base is kept back from its
 * side before the corners are fitted, so they leave it a run; it is then cut
 * down to the run there is, which only a side too short for the bare radii and
 * the base together falls short of, and held clear of both corners.
 */
const layoutG3 = (
  width: number,
  height: number,
  radius: SquirclePathRadius,
  smoothing: number,
  tip?: SquircleTip | null,
): G3Layout => {
  const radii = fitSquircleRadii(width, height, resolveFullRadii(width, height, radius));
  const capped = cappedEdges(radii, width, height);

  const tipWidth = tip ? (tip.width ?? DEFAULT_SQUIRCLE_TIP.width) : 0;
  const tipHeight = tip ? (tip.height ?? tipWidth / 2) : 0;
  const wanted = tip && tipWidth > 0 && tipHeight > 0 ? tip : undefined;
  const sideIndex = wanted ? TIP_SIDES.indexOf(wanted.side) : -1;
  const reserve = (index: number) => (index === sideIndex ? tipWidth : 0);
  const claims = fitCornerClaims(
    radii,
    smoothing,
    width,
    height,
    wanted ? [reserve(0), reserve(1), reserve(2), reserve(3)] : NO_RESERVE,
  );

  const corner = (index: number) => {
    const cornerRadius = radii[index]!;
    if (cornerRadius === 0) return undefined;
    return sizeG3Corner(
      cornerRadius,
      transitionFor(claims[index]!.x / cornerRadius - 1),
      transitionFor(claims[index]!.y / cornerRadius - 1),
      capped[index]!,
    );
  };
  const corners = [corner(0), corner(1), corner(2), corner(3)] as const;
  if (!wanted) return { corners };

  // The side from its start, the left of a horizontal one and the top of a
  // vertical one: its length, and what the corner at each end takes of it.
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const [length, before, after] =
    wanted.side === "top"
      ? [width, topLeft?.reachX ?? 0, topRight?.reachX ?? 0]
      : wanted.side === "bottom"
        ? [width, bottomLeft?.reachX ?? 0, bottomRight?.reachX ?? 0]
        : wanted.side === "left"
          ? [height, topLeft?.reachY ?? 0, bottomLeft?.reachY ?? 0]
          : [height, topRight?.reachY ?? 0, bottomRight?.reachY ?? 0];
  const room = length - before - after;
  if (room < TIP_MINIMUM) return { corners };

  const scale = Math.min(1, room / tipWidth);
  const base = tipWidth * scale;
  const at = Math.min(
    Math.max(wanted.at ?? length / 2, before + base / 2),
    length - after - base / 2,
  );
  return {
    corners,
    tip: {
      side: wanted.side,
      at,
      width: base,
      height: tipHeight * scale,
      radius: (wanted.radius ?? DEFAULT_SQUIRCLE_TIP.radius) * scale,
    },
  };
};

/**
 * Write a G3 outline clockwise from the top edge, as the Figma one is: `M`,
 * then relative `c`, `a` and `l`. Each step is measured from the point the
 * path has actually reached after rounding, so rounding never accumulates
 * around the outline.
 */
const drawG3 = (
  width: number,
  height: number,
  { corners, tip }: G3Layout,
  x: number,
  y: number,
): string => {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;

  let penX = g3Round(x + width - (topRight?.reachX ?? 0));
  let penY = g3Round(y);
  const out = [`M ${penX} ${penY}`];
  const handle = (toX: number, toY: number) => `${g3Round(toX - penX)} ${g3Round(toY - penY)}`;
  const step = (toX: number, toY: number) => {
    const dx = g3Round(toX - penX);
    const dy = g3Round(toY - penY);
    penX += dx;
    penY += dy;
    return `${dx} ${dy}`;
  };

  // A corner turned `quarter` right angles clockwise from the top-right one,
  // entered at `(startX, startY)`.
  const drawCorner = (
    shape: G3Corner | undefined,
    quarter: 0 | 1 | 2 | 3,
    startX: number,
    startY: number,
  ) => {
    if (!shape) return;
    const entering = quarter % 2 === 0 ? shape.x : shape.y;
    const leaving = quarter % 2 === 0 ? shape.y : shape.x;
    const scale = shape.arc;
    const reachIn = entering.along + 1 + leaving.off;
    const reachOut = leaving.along + 1 + entering.off;
    const toX = (u: number, v: number) =>
      startX + scale * (quarter === 0 ? u : quarter === 1 ? -v : quarter === 2 ? -u : v);
    const toY = (u: number, v: number) =>
      startY + scale * (quarter === 0 ? v : quarter === 1 ? u : quarter === 2 ? -v : -u);
    const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
      out.push(
        `c ${handle(toX(x1, y1), toY(x1, y1))} ${handle(toX(x2, y2), toY(x2, y2))} ${step(toX(x3, y3), toY(x3, y3))}`,
      );

    for (const [x1, y1, x2, y2, x3, y3] of entering.pieces) cubic(x1, y1, x2, y2, x3, y3);
    if (entering.turn + leaving.turn < Math.PI / 2 - 1e-9) {
      const endU = entering.along + Math.cos(leaving.turn);
      const endV = 1 + entering.off - Math.sin(leaving.turn);
      out.push(
        `a ${g3Round(scale)} ${g3Round(scale)} 0 0 1 ${step(toX(endU, endV), toY(endU, endV))}`,
      );
    }
    // The leaving transition is an entering one mirrored across the corner's
    // diagonal and run backwards: (u, v) becomes (reachIn − v, reachOut − u).
    const pieces = leaving.pieces;
    for (let index = pieces.length - 1; index >= 0; index--) {
      const [x1, y1, x2, y2] = pieces[index]!;
      const before = pieces[index - 1];
      const fromU = before ? before[4] : 0;
      const fromV = before ? before[5] : 0;
      cubic(
        reachIn - y2,
        reachOut - x2,
        reachIn - y1,
        reachOut - x1,
        reachIn - fromV,
        reachOut - fromU,
      );
    }
  };

  // The tip, on the side the outline is about to run down: out along one
  // edge, round the point, and back to the side along the other. The outline
  // runs clockwise, so the point turns the way every corner does.
  const drawTip = (side: SquircleTipSide) => {
    if (!tip || tip.side !== side) return;
    const halfWidth = tip.width / 2;
    const edge = tipEdge(halfWidth, tip.height, tip.radius);
    // The tip's frame here: where its middle meets the side, the way the
    // outline is travelling, and the way out of the box.
    const [originX, originY, alongX, alongY, outX, outY] =
      side === "top"
        ? [x + tip.at, y, 1, 0, 0, -1]
        : side === "right"
          ? [x + width, y + tip.at, 0, 1, 1, 0]
          : side === "bottom"
            ? [x + tip.at, y + height, -1, 0, 0, 1]
            : [x, y + tip.at, 0, -1, -1, 0];
    const to = (u: number, v: number) =>
      step(originX + u * alongX + v * outX, originY + u * alongY + v * outY);

    out.push(`l ${to(-halfWidth, 0)}`);
    out.push(`l ${to(-edge.u, edge.v)}`);
    if (edge.radius > 0) {
      const rounding = g3Round(edge.radius);
      out.push(`a ${rounding} ${rounding} 0 0 1 ${to(edge.u, edge.v)}`);
    }
    out.push(`l ${to(halfWidth, 0)}`);
  };

  drawCorner(topRight, 0, x + width - (topRight?.reachX ?? 0), y);
  drawTip("right");
  out.push(`l ${step(x + width, y + height - (bottomRight?.reachY ?? 0))}`);
  drawCorner(bottomRight, 1, x + width, y + height - (bottomRight?.reachY ?? 0));
  drawTip("bottom");
  out.push(`l ${step(x + (bottomLeft?.reachX ?? 0), y + height)}`);
  drawCorner(bottomLeft, 2, x + (bottomLeft?.reachX ?? 0), y + height);
  drawTip("left");
  out.push(`l ${step(x, y + (topLeft?.reachY ?? 0))}`);
  drawCorner(topLeft, 3, x, y + (topLeft?.reachY ?? 0));
  drawTip("top");
  out.push("Z");
  return out.join(" ");
};

/**
 * How far from its corner a squircle leaves the edge when both edges have
 * room: where the curve starts to bend. The Figma corner reaches
 * `(1 + smoothing) × radius`. The G3 corner reaches a little less, 1.43 ×
 * radius at 0.7, because its arc is a little tighter.
 */
export const squircleReach = (
  radius: number,
  smoothing = DEFAULT_SQUIRCLE_SMOOTHING,
  construction: SquircleConstruction = SQUIRCLE_CONSTRUCTION,
): number => {
  const clamped = Math.max(0, Math.min(smoothing, 1));
  if (construction === "figma") return (1 + clamped) * radius;
  const transition = transitionFor(clamped);
  return sizeG3Corner(radius, transition, transition, { x: false, y: false }).reachX;
};

/**
 * Build a squircle's SVG outline in border-box coordinates, in the house
 * construction unless a test or a side-by-side asks for the other.
 */
export const squirclePath = ({
  width,
  height,
  radius,
  x = 0,
  y = 0,
  tip,
  smoothing = DEFAULT_SQUIRCLE_SMOOTHING,
  construction = SQUIRCLE_CONSTRUCTION,
}: SquirclePathOptions): string => {
  if (width <= 0 || height <= 0) return "";

  const radii = fitSquircleRadii(width, height, resolveFullRadii(width, height, radius));
  const tipped = Boolean(tip) && construction === "g3";

  if (radii.every((corner) => corner === 0) && !tipped) {
    return `M ${round(x)} ${round(y)} l ${round(width)} 0 l 0 ${round(height)} l ${round(-width)} 0 Z`;
  }

  if (construction === "g3") {
    return drawG3(width, height, layoutG3(width, height, radius, smoothing, tip), x, y);
  }

  const claims = fitCornerClaims(radii, smoothing, width, height);

  // The outline runs clockwise from the top edge, so each corner is entered
  // along one of its edges and left along the other; the smoothing it draws
  // with on each is that edge's own fitted claim.
  const smoothingAlong = (index: number, axis: "x" | "y") =>
    claims[index]![axis] / radii[index]! - 1;
  const corner = (index: number, entered: "x" | "y", left: "x" | "y") =>
    radii[index] === 0
      ? undefined
      : buildCorner(radii[index]!, smoothingAlong(index, entered), smoothingAlong(index, left));
  const topLeft = corner(0, "y", "x");
  const topRight = corner(1, "x", "y");
  const bottomRight = corner(2, "y", "x");
  const bottomLeft = corner(3, "x", "y");

  const cornerCommands = (
    shape: Corner | undefined,
    cornerRadius: number,
    quadrant: "top-right" | "bottom-right" | "bottom-left" | "top-left",
  ): string[] => {
    if (!shape) return [];
    const { in: i, out: o, arcIn, arcOut } = shape;
    const arc = `a ${round(cornerRadius)} ${round(cornerRadius)} 0 0 1`;

    switch (quadrant) {
      case "top-right":
        return [
          `c ${round(i.a)} 0 ${round(i.a + i.b)} 0 ${round(i.a + i.b + i.c)} ${round(i.d)}`,
          `${arc} ${round(arcIn)} ${round(arcOut)}`,
          `c ${round(o.d)} ${round(o.c)} ${round(o.d)} ${round(o.b + o.c)} ${round(o.d)} ${round(o.a + o.b + o.c)}`,
        ];
      case "bottom-right":
        return [
          `c 0 ${round(i.a)} 0 ${round(i.a + i.b)} ${round(-i.d)} ${round(i.a + i.b + i.c)}`,
          `${arc} ${round(-arcOut)} ${round(arcIn)}`,
          `c ${round(-o.c)} ${round(o.d)} ${round(-(o.b + o.c))} ${round(o.d)} ${round(-(o.a + o.b + o.c))} ${round(o.d)}`,
        ];
      case "bottom-left":
        return [
          `c ${round(-i.a)} 0 ${round(-(i.a + i.b))} 0 ${round(-(i.a + i.b + i.c))} ${round(-i.d)}`,
          `${arc} ${round(-arcIn)} ${round(-arcOut)}`,
          `c ${round(-o.d)} ${round(-o.c)} ${round(-o.d)} ${round(-(o.b + o.c))} ${round(-o.d)} ${round(-(o.a + o.b + o.c))}`,
        ];
      case "top-left":
        return [
          `c 0 ${round(-i.a)} 0 ${round(-(i.a + i.b))} ${round(i.d)} ${round(-(i.a + i.b + i.c))}`,
          `${arc} ${round(arcOut)} ${round(-arcIn)}`,
          `c ${round(o.c)} ${round(-o.d)} ${round(o.b + o.c)} ${round(-o.d)} ${round(o.a + o.b + o.c)} ${round(-o.d)}`,
        ];
    }
  };

  // The straight runs are what the corners' claims leave of each side.
  const [tl, tr, br, bl] = claims;
  return [
    `M ${round(x + width - tr.x)} ${round(y)}`,
    ...cornerCommands(topRight, radii[1], "top-right"),
    `l 0 ${round(height - tr.y - br.y)}`,
    ...cornerCommands(bottomRight, radii[2], "bottom-right"),
    `l ${round(-(width - br.x - bl.x))} 0`,
    ...cornerCommands(bottomLeft, radii[3], "bottom-left"),
    `l 0 ${round(-(height - bl.y - tl.y))}`,
    ...cornerCommands(topLeft, radii[0], "top-left"),
    "Z",
  ].join(" ");
};

/**
 * The tip as `squirclePath` draws it on this box: its defaults filled in, cut
 * down to the run its side has, and held clear of the corners. `undefined`
 * where the side has no run for one. A caller drawing more than one outline
 * round a tip, as the chrome does, places it once here and moves it with
 * `offsetSquircleTip`, so every layer agrees where it stands.
 */
export const fitSquircleTip = ({
  width,
  height,
  radius,
  tip,
  smoothing = DEFAULT_SQUIRCLE_SMOOTHING,
}: Pick<SquirclePathOptions, "width" | "height" | "radius" | "tip" | "smoothing">):
  PlacedSquircleTip | undefined => {
  if (!tip || width <= 0 || height <= 0) return undefined;
  return layoutG3(width, height, radius, smoothing, tip).tip;
};

export interface SquircleStyleOptions {
  readonly width: number;
  readonly height: number;
  readonly radius: SquircleRadius;
}

const styleCache = new Map<string, CSSProperties>();

/** Cached clip-path for fixed-size chips that do not need decorated layers. */
export const squircleStyle = ({ width, height, radius }: SquircleStyleOptions): CSSProperties => {
  const key = `${width}x${height}r${JSON.stringify(radius)}`;
  const cached = styleCache.get(key);
  if (cached) return cached;

  const pixelRadius = radiiToPx(radius);
  const path = squirclePath({ width, height, radius: pixelRadius });
  const cssRadius =
    typeof pixelRadius === "number"
      ? `${pixelRadius}px`
      : pixelRadius.map((corner) => `${corner}px`).join(" ");
  const style: CSSProperties = path ? { clipPath: `path("${path}")` } : { borderRadius: cssRadius };
  styleCache.set(key, style);
  return style;
};
