<template>
  <button
    v-bind="attrs"
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClass"
    v-on="tooltip.on">
    <Spinner v-if="loading" :size="ICON[size].px" class="text-current" />
    <span v-else class="flex size-full items-center justify-center">
      <slot />
    </span>
    <Tooltip
      v-model="showTooltip"
      :text="getTooltipLabel()"
      :instant="tooltip.instant.value"
      :announce="tooltip.fromPointer.value" />
  </button>
</template>

<script setup lang="ts">
import { useTooltipTrigger } from "../../composables/useTooltipTrigger";
import { cva, type VariantProps } from "class-variance-authority";
import type { IconSize } from "../../utils/icons";
import Spinner from "./Spinner.vue";
import Tooltip from "./Tooltip.vue";
import { cn } from "../../utils/cn";

/**
 * An icon-only button. Always give it an `aria-label`: it is the accessible
 * name, and it is also the tooltip that appears after `tooltipDelay`, unless
 * `disableTooltip` leaves the tooltip out.
 *
 * Sizes share `Button`'s scale — `sm` is 32px, the default, matching an
 * `sm` text button beside it — after a 2026-09-05 re-base. Before that this
 * component's `md` was 32px and `Button`'s was 40px, so a "medium" icon
 * button beside a "medium" button was 8px short, and `SidePanel` asked for
 * `lg` to compensate.
 *
 * `ghost` is the default because it was the de-facto one: 51 of 55 call sites
 * asked for it by hand.
 *
 * The button owns its icon size (`ICON`), as `Button` does: any SVG in the
 * slot is drawn at the size the control size calls for, so a call site passes
 * the icon and nothing else. Weight stays with the caller. Until 2026-09-16
 * only the spinner was sized here and every caller restated `:size` on the
 * glyph — sixteen of them at a size other than the control's, and six files
 * at nothing, which is Phosphor's `1em`.
 */
const buttonVariants = cva(
  "focus-ring relative inline-flex shrink-0 select-none items-center justify-center rounded-full align-middle disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-surface-inverse text-ink-inverse hover:bg-surface-inverse-hover active:bg-surface-inverse-pressed",
        ghost: "bg-transparent text-ink-3 hover:bg-fill-2 hover:text-ink active:bg-fill-3",
        /** `ghost` on a dark surface. Same shape, the inverse ink and fills. */
        inverse:
          "focus-ring-inverse bg-transparent text-ink-inverse-3 hover:bg-fill-inverse-2 hover:text-ink-inverse active:bg-fill-inverse-3",
      },
      size: {
        xs: "size-6",
        sm: "size-8",
        md: "size-10",
        lg: "size-12",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "sm",
    },
  },
);

type ButtonVariants = VariantProps<typeof buttonVariants>;
type ButtonSize = NonNullable<ButtonVariants["size"]>;

interface Props {
  variant?: ButtonVariants["variant"];
  size?: ButtonSize;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  /** Milliseconds of hover or keyboard focus before the label appears as a tooltip. */
  tooltipDelay?: number;
  /**
   * Leave the tooltip out and keep the name. For the four conventions a glyph
   * says on its own: the × that dismisses the surface it sits on, the × that
   * clears its field, the chevrons that page, and the minus and plus that
   * step a value. Every other icon button keeps its tooltip.
   */
  disableTooltip?: boolean;
}

defineOptions({
  inheritAttrs: false,
});

const {
  variant = "ghost",
  size = "sm",
  type = "button",
  disabled = false,
  loading = false,
  tooltipDelay = 500,
  disableTooltip = false,
} = defineProps<Props>();

const attrs = useAttrs();

const getTooltipLabel = () => {
  const label = attrs["aria-label"];
  return typeof label === "string" ? label : "";
};

/** Reka's triggers set it on the button they wrap, and a tool sets it itself. */
const isExpanded = () => attrs["aria-expanded"] === true || attrs["aria-expanded"] === "true";

/**
 * When the tooltip shows is `useTooltipTrigger`'s: a dwell, a handoff between
 * neighbors, the keyboard as well as the pointer, and never over the menu or
 * popover the button has open.
 */
const tooltip = useTooltipTrigger({
  label: getTooltipLabel,
  enabled: () =>
    !disableTooltip && !disabled && !loading && !isExpanded() && Boolean(getTooltipLabel()),
  delay: () => Math.max(0, tooltipDelay),
});
const showTooltip = tooltip.open;

/**
 * The icon each control size draws — the "Icon" column of § Controls and
 * icons in the spec, the same table `Button` keeps. The class sizes whatever
 * SVG the slot holds (it beats the `width`/`height` attributes an icon
 * component sets), and `px` is handed to the spinner so its attributes agree
 * with its box.
 */
const ICON: Record<ButtonSize, { px: IconSize; class: string }> = {
  xs: { px: 12, class: "[&_svg]:size-3" },
  sm: { px: 18, class: "[&_svg]:size-4.5" },
  md: { px: 18, class: "[&_svg]:size-4.5" },
  lg: { px: 18, class: "[&_svg]:size-4.5" },
};

const buttonClass = computed(() =>
  cn(buttonVariants({ variant, size }), ICON[size].class, attrs.class as string),
);

watch(
  () => attrs,
  (newAttrs) => {
    if (!newAttrs["aria-label"]) {
      console.error("IconButton component requires an 'aria-label' attribute for accessibility.");
    }
  },
  { immediate: true },
);
</script>
