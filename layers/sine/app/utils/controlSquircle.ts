/**
 * Corner geometry shared by form chrome — text inputs, select triggers, and the
 * menus they open.
 *
 * These sit next to each other constantly (a filter bar is a search input and
 * three select triggers in a row; a menu opens flush under its trigger), so
 * their corners have to be cut from the same cloth. The numbers live here
 * rather than in each component for the same reason `selectVariants` exists:
 * a value copied into five files drifts.
 *
 * Radii are **unchanged** from the `rounded-*` utilities these controls used
 * before — the rollout swaps the corner *shape*, not its size, so nothing
 * reflows. They are expressed as Tailwind tokens rather than px so they stay
 * pinned to the same scale as any `rounded-*` still sitting beside them.
 *
 * The *colours* are no longer stated here: they are design tokens, imported
 * from `tailwind.config.ts` so a `Squircle` stroke and a `border-line` class
 * cannot drift apart. They used to be two hex literals written out by hand, one
 * of which disagreed with the theme's own default border by a shade nobody had
 * chosen — see `docs/design-history.md`.
 */

import type { RadiusToken, SquircleCut } from "./squircle";
import { focusRing, glassEdge, line, surface } from "../../tailwind.config";

/**
 * The radius ladder, as `RadiusToken`s. It maps exactly onto Tailwind's own
 * `rounded-*` scale, which is not a coincidence — the ladder was read off the
 * radii the portal had already settled into.
 *
 * `sheet` shares `card`'s 24px. Every radius uses the geometry primitive's
 * single 0.7 smoothing value.
 */
export const RADIUS = {
  /** 6px — kbd, checkbox, tooltip. */
  micro: "md",
  /** 8px — inputs, select triggers, menu items. */
  control: "lg",
  /** 12px — menus, popovers, callouts. */
  menu: "xl",
  /** 16px — list rows, nested cards. */
  row: "2xl",
  /** 24px — cards, panels. */
  card: "3xl",
  /** 24px — dialogs, side panels. */
  sheet: "3xl",
  /** Fluid squircle pill — buttons, chips, tabs, navigation rows and toasts. */
  pill: "full",
} as const satisfies Record<string, RadiusToken>;

/** The resting 1px keyline on form chrome — the theme's `line`. */
export const CONTROL_BORDER_COLOR = line.DEFAULT;

/**
 * The 2px ring a control shows on focus, on the next frame and never faded —
 * `surface-inverse`, as everywhere else.
 */
export const CONTROL_FOCUS_COLOR = surface.inverse;

/**
 * The ring on a fill that is `CONTROL_FOCUS_COLOR` itself — the primary
 * button's — where a stroke along the edge would vanish into it. The fill opens
 * instead (`Pill`'s `focusRing="cut"`), and the numbers are the outline's two
 * turned inward: a band of the fill as wide as the ring, then an opening as
 * wide as its offset.
 */
export const CONTROL_FOCUS_CUT = {
  inset: focusRing.width,
  width: focusRing.offset,
} as const satisfies SquircleCut;

/**
 * The flat under-stroke for a glass `Squircle`, as props to spread onto it.
 *
 * ```vue
 * <Squircle glass="lg" v-bind="glassStroke()">
 * ```
 *
 * A glass surface's edge is two layers: the lit rim over a flat keyline in this
 * shade. The `.glass-*` classes draw them on their two pseudo-elements; a
 * squircle lights the rim for free, inside its surface, whenever `glass` is set,
 * and this supplies the keyline.
 *
 * It exists because the two renderers had drifted apart underneath. Menus
 * passed `border-width: 0`, so a glass menu had the edge's highlight and no
 * shade under it, while a `.glass-md` chip had both. Naming the value here is
 * what keeps a menu and a map chip the same material. A glass squircle given
 * no border draws this keyline by default too (white at 20%, `line-glass`,
 * until 2026-09-28); spreading it says so where the surface is written.
 *
 * The stroke is drawn on an overlay layer, so unlike a real border it adds
 * nothing to the box and no existing glass surface changes size.
 */
export const glassStroke = () => ({ borderWidth: 1, borderColor: glassEdge.shade });

/** Trigger radius: `rounded-lg`, or the shared squircle pill. */
export const controlRadius = (rounded?: boolean | null): "full" | "lg" => (rounded ? "full" : "lg");

/** Menu radius, one step up from its trigger's so the two nest visually. */
export const menuRadius = (rounded?: boolean | null): "2xl" | "xl" => (rounded ? "2xl" : "xl");
