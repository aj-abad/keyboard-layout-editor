<template>
  <Pill
    @click="guardClick"
    @auxclick="guardClick"
    v-bind="{ ...boundAttrs, ...rootProps, ...shellProps }"
    :data-variant="variant"
    :class="buttonClass">
    <span
      v-if="$slots.leading || spinnerAt() === 'leading'"
      :class="cn(iconWellClass, 'col-start-1 -ml-0.5 justify-self-start')">
      <Spinner v-if="spinnerAt() === 'leading'" :size="ICON[size].px" aria-hidden="true" />
      <slot v-else name="leading" />
    </span>
    <span
      data-button-label
      :class="
        cn('col-start-2 min-w-0', shape === 'cell' ? 'line-clamp-2 whitespace-normal' : 'truncate')
      ">
      <slot />
    </span>
    <span
      v-if="$slots.trailing || spinnerAt() === 'trailing'"
      :class="cn(iconWellClass, 'col-start-3 -mr-0.5 justify-self-end')">
      <Spinner v-if="spinnerAt() === 'trailing'" :size="ICON[size].px" aria-hidden="true" />
      <slot v-else name="trailing" />
    </span>
  </Pill>
</template>

<script setup lang="ts">
import type { NuxtLinkProps } from "#app";
import { cva, type VariantProps } from "class-variance-authority";
import { resolveComponent, type Component } from "vue";
import { line } from "../../../tailwind.config";
import { RADIUS } from "../../utils/controlSquircle";
import type { IconSize } from "../../utils/icons";
import type { SquircleRadius } from "../../utils/squircle";
import Pill from "./Pill.vue";
import { cn } from "../../utils/cn";
import Spinner from "./Spinner.vue";

/**
 * The button.
 *
 * A squircle pill, inline and centred by default, at the 32px `sm` height that the rest
 * of the operator surface is built on — decisions 5 and 6 in
 * `docs/design-system.md`. `block` opts into filling the container; `md` and
 * `lg` are for forms, login and onboarding, where the inputs beside it are
 * taller.
 *
 * **Icons sit at the edges and the label is centred on the full width**
 * (decision 12, 2026-09-06). A `block` button is a `1fr auto 1fr` grid: the
 * leading icon at the start of the first column, the trailing icon at the end
 * of the third, the label in the middle. The outer columns share the free
 * space equally, so the label lands where a text-only sibling's does whether
 * the button carries no icon, one, or two — a stack keeps one label axis and
 * one icon column. An inline button is a flex cluster, which at intrinsic
 * width is the same picture; the two layouts only differ where there is free
 * space. Each icon pulls 2px into the padding at every size: an icon's ink sits
 * inside its box by about that much, and the pill's curve leaves its corner
 * less room than a cap height gets, so 2px is what puts icon ink and text ink
 * the same distance from the edge. A larger pull would put the icon closer.
 *
 * The button owns its icon size (`ICON`): any SVG in a slot is drawn at the
 * size the control size calls for, so a call site passes the icon and nothing
 * else. Weight stays with the caller — `bold` at 16 and under.
 *
 * `loading` is the busy state. It draws `Spinner` in the trailing icon's
 * place, or the leading icon's when that is the only icon, or at the trailing
 * edge when there is none; the label stays, so the width does too when there
 * is an icon to swap. It refuses clicks through `aria-disabled` and
 * `aria-busy` rather than the native `disabled`, so the button keeps focus and
 * full colour — a busy control is not an unavailable one. Pass `disabled`
 * beside it only for a button that should also read as unavailable.
 *
 * `shape="cell"` is the one departure from the pill, and `Shared/DialogFooter.vue`
 * is its only caller: a joined dialog action is a cell *in* its sheet rather
 * than a pill placed on it, so it fills the strip, takes the sheet's corners at
 * the strip's ends, and draws its fill and focus stroke on that shape. See
 * `cellVariants` for what a cell's role is spent on, since the strip is
 * transparent at rest.
 *
 * Every state colour is instant (decision 11): no `transition-colors`, no
 * fading ring. Focus is the shared 2px squircle stroke, the same treatment
 * every other shaped control carries — and the browser's own ring is off,
 * since a stroke that follows the corner and an outline that cannot would
 * otherwise both be drawn. `primary` is the exception: its fill is the
 * stroke's own `surface-inverse`, which would swallow it, so the fill opens
 * instead — a 2px cut, 2px in from the edge, through to whatever the button
 * sits on (`focusRing="cut"`).
 *
 * This replaced a Carbon-shaped button (2026-09-05): block by default, label
 * left-aligned, an inset focus ring animated inside the fill, the trailing icon
 * as the primary slot. 124 of 201 call sites had passed `inline` to escape the
 * default, which is what a wrong default looks like from the outside.
 */
const buttonVariants = cva(
  "group/button relative select-none items-center justify-center gap-2 whitespace-nowrap align-middle [&_svg]:shrink-0 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "text-ink-inverse",
        secondary: "text-ink-2",
        outline: "text-ink-2",
        ghost: "text-ink-2",
        /**
         * The action *on* a dark surface — a toast, or anything else built on
         * `surface-inverse`. `primary` is that same dark surface, so it
         * disappears there; this is its mirror, drawn on the inverse fill and
         * line scale the config keeps for exactly this case.
         */
        inverse: "text-ink-inverse",
        /**
         * The action *on* a toned sheet — the status capsule in the shell,
         * which is the one place a control sits on a status fill. A `surface`
         * chip in the sheet's own ink (`currentColor`, so `bad` on the
         * offline capsule): the mirror of `inverse`, which lifts off a dark
         * pill with a keyline where this lifts off a tint by going white. It
         * was a text button until 2026-09-19 — same ink, size and weight as
         * the figure beside it, a hairline its only affordance — and read as
         * more copy. On white the ink clears 4.5:1 through `ghost`'s own
         * steps (`#b91c1c` is 6.5:1 at rest, 5.8 through `fill-2`, 5.2
         * through `fill-3`), so it takes them. See `docs/design-system.md`
         * § Connection.
         */
        toned: "text-current",
        destructive: "text-bad",
      },
      size: {
        xs: "h-6 gap-1.5 px-2.5 text-xs",
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-5 text-lg",
      },
      block: {
        true: "grid w-full grid-cols-[1fr_auto_1fr]",
        false: "inline-flex w-auto shrink-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "sm",
      block: false,
    },
  },
);

const buttonSurfaceVariants = cva("", {
  variants: {
    variant: {
      primary:
        "bg-surface-inverse group-hover/button:bg-surface-inverse-hover group-active/button:bg-surface-inverse-pressed",
      secondary: "bg-fill-2 group-hover/button:bg-fill-3 group-active/button:bg-fill-4",
      outline: "group-hover/button:bg-fill-1 group-active/button:bg-fill-2",
      ghost: "group-hover/button:bg-fill-2 group-active/button:bg-fill-3",
      inverse: "group-hover/button:bg-fill-inverse-2 group-active/button:bg-fill-inverse-3",
      // White, then the state fill on a pseudo-element inside the one clipped
      // layer — `statusSheetClass`'s construction — so the chip stays white
      // under its hover rather than swapping white for a black alpha over the
      // sheet's tint.
      toned:
        "bg-surface after:absolute after:inset-0 group-hover/button:after:bg-fill-2 group-active/button:after:bg-fill-3",
      destructive: "group-hover/button:bg-bad/10 group-active/button:bg-bad/15",
    },
  },
});

/**
 * A joined dialog action: a cell in the sheet's own bottom edge.
 *
 * The strip is transparent at rest — a fill there would be a second primary
 * button inside a sheet that already has one — so a cell's role is carried by
 * ink and weight instead. The action the sheet is asking for takes full ink at
 * 500, a destructive one takes `bad`, and the dismissals beside them take
 * `ink-2` at 400. A dismissal's ink rises to full under the pointer, which is
 * the answer `.menu-item` and `.list-row` already give a row that is being
 * pointed at without having been chosen.
 */
const cellVariants = cva("flex h-full w-full px-4 py-1 text-sm", {
  variants: {
    variant: {
      primary: "font-medium text-ink",
      secondary: "font-normal text-ink-2 hover:text-ink",
      outline: "font-normal text-ink-2 hover:text-ink",
      ghost: "font-normal text-ink-2 hover:text-ink",
      /** A strip is cut from a light sheet, so an inverse or toned cell is a dismissal. */
      inverse: "font-normal text-ink-2 hover:text-ink",
      toned: "font-normal text-ink-2 hover:text-ink",
      destructive: "font-medium text-bad",
    },
  },
});

/**
 * And the fill under it, which says only that the cell is under the pointer.
 * The action reacts one step harder than the dismissal beside it, for the same
 * reason it carries more ink; a destructive one reacts in its own colour, as it
 * does everywhere else.
 */
const cellSurfaceVariants = cva("", {
  variants: {
    variant: {
      primary: "group-hover/button:bg-fill-3 group-active/button:bg-fill-4",
      secondary: "group-hover/button:bg-fill-2 group-active/button:bg-fill-3",
      outline: "group-hover/button:bg-fill-2 group-active/button:bg-fill-3",
      ghost: "group-hover/button:bg-fill-2 group-active/button:bg-fill-3",
      inverse: "group-hover/button:bg-fill-2 group-active/button:bg-fill-3",
      toned: "group-hover/button:bg-fill-2 group-active/button:bg-fill-3",
      destructive: "group-hover/button:bg-bad/10 group-active/button:bg-bad/15",
    },
  },
});

type ButtonVariants = VariantProps<typeof buttonVariants>;
type ButtonSize = NonNullable<ButtonVariants["size"]>;

/**
 * The icon each control size draws — the "Icon" column of § Controls and
 * icons in the spec. The class sizes whatever SVG the slot holds (it beats the
 * `width`/`height` attributes an icon component sets), and `px` is handed to
 * the spinner so its attributes agree with its box.
 */
const ICON: Record<ButtonSize, { px: IconSize; class: string }> = {
  xs: { px: 12, class: "[&_svg]:size-3" },
  sm: { px: 18, class: "[&_svg]:size-4.5" },
  md: { px: 18, class: "[&_svg]:size-4.5" },
  lg: { px: 18, class: "[&_svg]:size-4.5" },
};

type ButtonDestination =
  | { to: NonNullable<NuxtLinkProps["to"]>; href?: never }
  | { to?: never; href: string }
  | { to?: never; href?: never };

type ButtonProps = ButtonDestination & {
  variant?: ButtonVariants["variant"];
  size?: ButtonSize;
  /** Fill the container. The default is intrinsic width. */
  block?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  /**
   * Busy: a spinner in the icon's place, clicks refused, focus and colour
   * kept. See the component note for which icon it takes.
   */
  loading?: boolean;
  /** Joined dialog actions are cells in their sheet rather than standalone pills. */
  shape?: "pill" | "cell";
  /**
   * A cell's own corners, handed to it by the strip: the sheet's at the strip's
   * two ends and square where it meets its neighbour. The cell clips its fill
   * and draws its focus stroke on that shape, so the strip needs no clip of its
   * own — and the focus ring stops being a rectangle cut off by the sheet's
   * corner. Ignored by a pill, which is always `RADIUS.pill`.
   */
  cellRadius?: SquircleRadius;
};

defineOptions({
  inheritAttrs: false,
});

const {
  variant = "primary",
  size = "sm",
  block = false,
  type = "button",
  disabled = false,
  loading = false,
  shape = "pill",
  cellRadius = "none",
  to,
  href,
} = defineProps<ButtonProps>();

const attrs = useAttrs();
const slots = defineSlots<{
  default?: () => unknown;
  leading?: () => unknown;
  trailing?: () => unknown;
}>();
const NuxtLink = resolveComponent("NuxtLink") as Component;

const isLink = computed(() => to !== undefined || href !== undefined);
const rootComponent = computed(() =>
  to !== undefined ? NuxtLink : href !== undefined ? "a" : "button",
);

/** `class` is folded into `buttonClass` through `cn()`; binding it raw as well would bypass the merge. */
const boundAttrs = computed(() => {
  const { class: _class, ...rest } = attrs;
  return rest;
});

const rootProps = computed(() => {
  const inertLink = isLink.value && (disabled || loading);
  const state = {
    "aria-disabled": inertLink || loading ? "true" : attrs["aria-disabled"],
    "aria-busy": loading ? "true" : attrs["aria-busy"],
    tabindex: inertLink ? -1 : attrs.tabindex,
    "data-disabled": disabled ? "" : attrs["data-disabled"],
  };

  if (to !== undefined) return { ...state, to, draggable: false };
  if (href !== undefined) return { ...state, href, draggable: false };

  return { ...state, type, disabled };
});

/**
 * Which slot the spinner takes while loading. Read at render time rather than
 * in a computed: slot presence is not reactive, and a caller can `v-if` a
 * slot template.
 */
const spinnerAt = (): "leading" | "trailing" | null => {
  if (!loading) return null;
  return slots.leading && !slots.trailing ? "leading" : "trailing";
};

/**
 * Listed before `v-bind` so it runs ahead of the caller's own `@click` and
 * `stopImmediatePropagation` can skip it. The pointer cut already stops the
 * mouse; this is the keyboard, and the click a form fires at its default
 * button on Enter.
 */
const guardClick = (event: MouseEvent) => {
  if (!loading && !(isLink.value && disabled)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
};

const iconWellClass = computed(() =>
  cn("flex shrink-0 items-center justify-center", ICON[size].class),
);

const buttonClass = computed(() =>
  cn(
    buttonVariants({ variant, size, block }),
    shape === "cell" && cellVariants({ variant }),
    // Both states cut the pointer, which is what stops the hover rules; only
    // an unavailable button dims. A busy one keeps its colour under the
    // spinner.
    (disabled || loading) && "pointer-events-none",
    disabled && !loading && "opacity-50",
    attrs.class as string,
  ),
);

const buttonSurfaceClass = computed(() =>
  shape === "cell" ? cellSurfaceVariants({ variant }) : buttonSurfaceVariants({ variant }),
);
const buttonBorderWidth = computed(() =>
  shape !== "cell" && (variant === "outline" || variant === "inverse") ? 1 : 0,
);
const buttonBorderColor = computed(() => (variant === "inverse" ? line.inverse : line.DEFAULT));
const shellProps = computed(() => ({
  as: rootComponent.value,
  radius: shape === "cell" ? cellRadius : RADIUS.pill,
  surfaceClass: buttonSurfaceClass.value,
  borderWidth: buttonBorderWidth.value,
  borderColor: buttonBorderColor.value,
  // A primary cell is transparent at rest, so it takes the stroke like any other cell.
  focusRing:
    variant === "inverse"
      ? ("inverse" as const)
      : variant === "primary" && shape === "pill"
        ? ("cut" as const)
        : true,
}));
</script>
