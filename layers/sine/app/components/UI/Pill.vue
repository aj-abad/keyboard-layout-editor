<template>
  <Squircle
    :as="as"
    :radius="radius"
    :surface-class="surfaceClass"
    :surface-cut="surfaceCut"
    :clip-content="clipContent"
    :content-class="contentClass"
    :glass="glass"
    :shadow="shadow"
    :highlight="highlight"
    :border-width="resolvedBorderWidth"
    :border-color="resolvedBorderColor"
    :border-style="borderStyle"
    :class="
      cn(focusRing !== false && mounted && 'focus-visible:outline-none', $attrs.class as string)
    "
    v-bind="rest()"
    @focusin="onFocusIn"
    @focusout="onFocusOut">
    <slot />
  </Squircle>
</template>

<script setup lang="ts">
import { useMounted } from "@vueuse/core";
import { ink, surface } from "../../../tailwind.config";
import { Squircle, type SquircleProps } from "../../utils/squircle";
import { CONTROL_FOCUS_CUT, RADIUS } from "../../utils/controlSquircle";
import { cn } from "../../utils/cn";

/**
 * A fluid squircle pill. Use this for controls, chips, tabs, nav rows and
 * progress tracks whose width is greater than their height. True circles —
 * dots, avatars and equal-size icon wells — stay `rounded-full`.
 *
 * Like every `Squircle`, fills and their interaction states belong on
 * `surfaceClass`. `focusRing` draws the shared 2px focus treatment as a shape
 * stroke, because a CSS outline cannot follow the smoothed path — and takes
 * the browser's own ring off the root with it, since the two would otherwise
 * both be drawn and only one of them follows the corner. A fill in the ring's
 * own `surface-inverse` would swallow that stroke, so `focusRing="cut"` opens
 * the fill instead, 2px in from the edge (`CONTROL_FOCUS_CUT`).
 *
 * `radius` is the fluid pill unless the shape is cut from something else: a
 * dialog footer cell fills the sheet's bottom edge, so it takes the sheet's
 * corners at the strip's ends and square ones at the divider. Anything wider
 * than it is tall and shaped in its own right is still `RADIUS.pill`.
 */
type PillProps = Pick<
  SquircleProps,
  | "as"
  | "radius"
  | "surfaceClass"
  | "clipContent"
  | "contentClass"
  | "glass"
  | "shadow"
  | "highlight"
  | "borderWidth"
  | "borderColor"
  | "borderStyle"
> & {
  /**
   * The keyboard focus ring. `true` strokes the pill's edge in
   * `surface-inverse`, and `inverse` in `ink-inverse`, for a pill on a dark
   * surface. `cut` is for a pill filled with `surface-inverse` itself, where
   * the stroke would vanish: the fill opens in a 2px band, 2px in from the
   * edge, through to whatever lies behind.
   */
  focusRing?: boolean | "inverse" | "cut";
};

const {
  as = "div",
  radius = RADIUS.pill,
  surfaceClass,
  clipContent = false,
  contentClass,
  glass,
  shadow,
  highlight,
  borderWidth = 0,
  borderColor,
  borderStyle = "solid",
  focusRing = false,
} = defineProps<PillProps>();

defineOptions({ inheritAttrs: false });
defineSlots<{ default?: () => unknown }>();

const attrs = useAttrs();
const focusVisible = shallowRef(false);
/**
 * The stroke is drawn by a focus handler, which a server-rendered page doesn't
 * have until it hydrates. Until then the browser's own ring stays on, so a
 * keyboard can see where it is.
 */
const mounted = useMounted();
const rest = () => {
  const { class: _class, ...others } = attrs;
  return others;
};

/** A `cut` ring opens the fill rather than stroking the edge, so the keyline stays as it is. */
const stroked = computed(() => focusVisible.value && focusRing !== "cut");
const resolvedBorderWidth = computed(() => (stroked.value ? 2 : borderWidth));
const resolvedBorderColor = computed(() =>
  stroked.value ? (focusRing === "inverse" ? ink.inverse : surface.inverse) : borderColor,
);
const surfaceCut = computed(() =>
  focusVisible.value && focusRing === "cut" ? CONTROL_FOCUS_CUT : null,
);

const onFocusIn = (event: FocusEvent) => {
  focusVisible.value =
    focusRing !== false &&
    event.target instanceof HTMLElement &&
    event.target.matches(":focus-visible");
};

const onFocusOut = (event: FocusEvent) => {
  if (!(event.currentTarget instanceof HTMLElement)) return;
  if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
    return;
  focusVisible.value = false;
};
</script>
