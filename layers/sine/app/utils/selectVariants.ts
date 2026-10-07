/**
 * Trigger chrome for the select family, drawn by `UI/SelectTrigger.vue`, which
 * `UI/Select.vue` and `UI/MultiSelect.vue` both open from.
 *
 * The two components exist separately because their models differ (one string
 * vs. a string array, with correspondingly different empty-state semantics),
 * but they sit next to each other in filter bars and must stay pixel-identical
 * — so the classes live here, and the trigger lives in one component.
 *
 * The trigger is the package's `Squircle` rendered through Reka's
 * `as-child`, so what is left here is only what belongs on the button itself:
 * layout, height, padding and the disabled state. The shape, the fill and the
 * keyline are the squircle's, and the radius comes from `controlRadius` in
 * `utils/controlSquircle` — the same one `UI/Input.vue` uses, which is what
 * keeps a search field and the select beside it cut to the same corner.
 */

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/**
 * `outline-none` is load-bearing, not tidying. The focus treatment on squircle
 * chrome is a 2px `CONTROL_FOCUS_COLOR` stroke drawn *on* the trigger's edge,
 * because an outline cannot follow a smoothed corner — and the browser's own
 * `:focus-visible` ring sits **outside** the border box, so a keyboard-focused
 * trigger drew both: the UA ring, a gap, then ours. `UI/Input.vue` never showed
 * it because its `<input>` carries `outline-none` in the same position; the
 * trigger is a `<button>`, which had nothing. (A pointer click never revealed
 * it — `:focus-visible` does not match — so it only ever appeared to keyboard
 * users.) Tailwind's `outline-none` is a transparent 2px outline rather than
 * `outline: none`, so the ring is still there in forced-colours mode.
 *
 * `text-ink` is the value's ink, stated here rather than inherited. Each
 * trigger already puts `ink-4` on its *placeholder*, so a control that let its
 * value inherit drew the two states apart only while the surrounding ink was
 * `ink` — and `SectionHeading`'s trailing slot is `type-caption`, whose role
 * carries `ink-4`, so the Overview's location filter read the same whether the
 * fleet was filtered or not. A control owns its value's ink the way `Button`
 * owns its label's; the placeholder classes on the value span still win over
 * this, since they sit on the element itself.
 *
 * `gap-2` is the house label-to-glyph gap (`docs/design-system.md` § Controls
 * and icons), and it is what the caret's `ml-auto` cannot give: `justify-between`
 * only separates the two while there is room to spare, so a value long enough
 * to truncate ran its ellipsis flush against the caret. The gap comes off the
 * value's width, so the ellipsis now lands 8px short of it at every length.
 */
export const selectTriggerVariants = cva(
  "w-full flex items-center justify-between gap-2 bg-transparent text-ink outline-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "text-sm h-8 px-3",
        md: "text-base h-10 px-3.5",
        lg: "text-lg h-12 px-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type SelectTriggerVariants = VariantProps<typeof selectTriggerVariants>;

type SelectSize = NonNullable<SelectTriggerVariants["size"]>;

/**
 * A list row's left padding for each trigger size, so a row's text starts on
 * the trigger's text column. The trigger insets its value 12, 14 and 16px
 * (`px-3`, `px-3.5`, `px-4` above); a row sits 4px into the list and pads 8px
 * of its own, so the row adds the difference. It is what lets the aligned list
 * land flush on its trigger: Reka places that list so the chosen row's text
 * starts where the value starts, and a row inset 12px at every size landed the
 * list 2px inside a medium trigger and 4px inside a large one, beside the ring
 * the trigger keeps while it is open. The highlight keeps its 4px inset, so
 * its 8px corner stays concentric with the list's 12px.
 */
export const selectRowInset: Record<SelectSize, string> = { sm: "", md: "pl-2.5", lg: "pl-3" };

/**
 * Fill for the trigger's squircle surface. A `bg-*` on the button itself would
 * paint a rectangle inside the smoothed corner, so the disabled tint has to be
 * resolved here rather than by a `disabled:` variant.
 */
export const selectSurfaceClass = (disabled?: boolean) =>
  cn("bg-surface", disabled && "bg-surface-sunken");
