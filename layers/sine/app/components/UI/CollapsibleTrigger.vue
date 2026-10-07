<template>
  <CollapsibleTrigger as-child>
    <!-- `none`: the caller draws the control (a `Button`, say) and Reka
         forwards `aria-expanded`, `aria-controls`, `data-state` and the click
         onto it. -->
    <slot v-if="variant === 'none'" />

    <!-- `bare` is a plain button: it has no chrome to be a squircle for, and
         a `Pill` here was a measured component per trigger — 45 on a fleet
         page — for nothing but a focus stroke, which the offset ring draws. -->
    <component
      v-else
      :is="variant === 'row' ? Squircle : variant === 'bare' ? 'button' : Pill"
      v-bind="{ ...elementProps, ...rest }"
      :class="cn(triggerVariants({ variant, size }), $attrs.class as string)">
      <component
        :is="caretGlyphs.leading"
        v-if="caret === 'leading'"
        v-bind="caretProps"
        class="group-data-[state=open]:rotate-90" />
      <slot />
      <component
        :is="caretGlyphs.trailing"
        v-if="caret === 'trailing'"
        v-bind="caretProps"
        class="group-data-[state=open]:rotate-180" />
    </component>
  </CollapsibleTrigger>
</template>

<script setup lang="ts">
import { CollapsibleTrigger, injectCollapsibleRootContext } from "reka-ui";
import { cva, type VariantProps } from "class-variance-authority";
import IconNucleoChevronDown from "../Icon/Nucleo/ChevronDown.vue";
import IconNucleoChevronDown12 from "../Icon/Nucleo/ChevronDown12.vue";
import IconNucleoChevronRight from "../Icon/Nucleo/ChevronRight.vue";
import IconNucleoChevronRight12 from "../Icon/Nucleo/ChevronRight12.vue";
import { Squircle } from "../../utils/squircle";
import Pill from "./Pill.vue";
import { RADIUS } from "../../utils/controlSquircle";
import { cn } from "../../utils/cn";

/**
 * The control that opens a `Collapsible`, and the caret that says so.
 *
 * The four variants are the four shapes the portal had already settled into —
 * they are not a palette to pick from, they are where a disclosure sits:
 *
 * - `row` — a full-width row *inside a card*: the "Setup defaults" panel on
 *   the station form. Drawn as a `Squircle`, so its hover fill goes on the
 *   surface layer (rule 3): a `bg-*` on the row would paint a rectangle into
 *   the card's smoothed corner, and the row, not the card, owns its shape.
 * - `chip` — a pill that carries a resting fill, for a disclosure that is a
 *   thing in its own right rather than an affordance on something else: the
 *   folded heartbeat run in the OCPP feed.
 * - `quiet` — a pill that fills only under the pointer, for "N more" and
 *   "Details" tucked at the edge of a card.
 * - `bare` — a caret and a label, no chrome. For a disclosure inside content
 *   that is already dense: the frame dump on an OCPP exchange.
 * - `none` — the caller draws the control. `Settings/Integrations/WebhookRow`
 *   uses a `Button`, which has its own chrome and should not grow a second
 *   copy of it here.
 *
 * **The caret rotates; nothing beside it moves.** `transition-transform` alone
 * over `duration-base`, per decision 11 — the ink either side of a state change
 * lands on the next frame. It reads `data-state` off the trigger through
 * `group`, so it needs no open state of its own, and a caller that wants no
 * caret at all passes `caret="none"`.
 */
const triggerVariants = cva(
  "group focus-ring flex select-none items-center [&_svg]:shrink-0 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        row: "w-full cursor-pointer justify-between gap-4 px-3 py-2.5 text-left",
        chip: "w-fit gap-1.5 px-3.5 py-1.5 text-ink-3",
        quiet: "w-fit gap-1.5 px-2.5 py-1 text-ink-3 hover:text-ink-2",
        bare: "w-fit gap-1 rounded-md text-ink-3 hover:text-ink-2",
        none: "",
      },
      size: {
        xs: "text-xs",
        sm: "text-sm",
        md: "text-sm",
        lg: "type-heading text-ink",
      },
    },
    defaultVariants: { variant: "quiet", size: "xs" },
  },
);

type TriggerVariants = VariantProps<typeof triggerVariants>;

/**
 * Caret px per size step, on the § Controls and icons scale: the 12 grid at
 * `xs`, 18 above it, each drawn by the glyph cut for that grid.
 */
const CARET = { xs: 12, sm: 18, md: 18, lg: 18 } as const;

const {
  variant = "quiet",
  size = "xs",
  caret = "trailing",
} = defineProps<{
  variant?: NonNullable<TriggerVariants["variant"]>;
  size?: NonNullable<TriggerVariants["size"]>;
  /** `leading` is the `<summary>` idiom — a caret that turns 90° at the left. */
  caret?: "trailing" | "leading" | "none";
}>();

defineOptions({ inheritAttrs: false });

/**
 * Name the panel before this trigger renders.
 *
 * Reka assigns the shared id from `CollapsibleContent`'s setup
 * (`contentId ||= useId()`), and the context it lives on is a plain object
 * rather than a reactive one — so a trigger written *above* its panel, which is
 * most of them, renders first, reads an id that is still the empty string, and
 * is never re-rendered to pick up the real one. The button ships
 * `aria-controls=""`: a screen reader is told it expands something without
 * being told what, and it only corrects itself on the first toggle, which is
 * exactly too late to be worth anything.
 *
 * Claiming the id here closes that window, and the `||=` is what makes it safe
 * in both directions — whichever of the two mounts first names the panel, and
 * the other keeps that name.
 */
const root = injectCollapsibleRootContext();
root.contentId ||= useId();

const caretGlyphs = computed(() =>
  size === "xs"
    ? { leading: IconNucleoChevronRight12, trailing: IconNucleoChevronDown12 }
    : { leading: IconNucleoChevronRight, trailing: IconNucleoChevronDown },
);

const caretProps = computed(() => ({
  size: CARET[size],
  "aria-hidden": true,
  class: "shrink-0 text-ink-4 transition-transform duration-base ease-standard",
}));

/**
 * `row` is a squircle at the card's own radius; `chip` and `quiet` are pills,
 * and on this branch a pill is `Pill` rather than a `rounded-full` button
 * (rule 2). Both draw their fill on the surface layer instead of the element —
 * a `bg-*` on the root paints a rectangle into the smoothed corner — and the
 * states are `group-*` because that layer is a sibling of the content rather
 * than its ancestor, so a bare `hover:` there never fires.
 *
 * `bare` has no fill and so no surface: it is a plain `<button>` with the
 * offset focus ring, the treatment the system gives a control that is not a
 * squircle. It used to be a `Pill` as well, for the pill-shaped stroke
 * alone, and at one per connector summary that was a measured component per
 * fleet row.
 */
const SURFACES: Record<string, string | undefined> = {
  chip: "bg-fill-2 group-hover:bg-fill-3 group-active:bg-fill-4",
  quiet: "group-hover:bg-fill-2 group-active:bg-fill-3",
};

const elementProps = computed(() => {
  if (variant === "row") {
    return {
      as: "button",
      type: "button",
      radius: RADIUS.row,
      surfaceClass: "group-hover:bg-fill-1 group-active:bg-fill-2",
    };
  }
  if (variant === "bare") return { type: "button" };
  return { as: "button", type: "button", surfaceClass: SURFACES[variant] };
});

const attrs = useAttrs();
const rest = computed(() => {
  const { class: _class, ...others } = attrs;
  return others;
});
</script>
