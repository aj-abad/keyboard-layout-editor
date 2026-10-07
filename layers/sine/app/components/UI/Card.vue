<template>
  <Squircle
    :as="as"
    :radius="RADIUS[radius]"
    :surface-class="cn('bg-surface', surfaceClass)"
    :shadow="shadow"
    :clip-content="clipContent"
    :content-class="cn(clipContent && PADDING[padding], contentClass)"
    :border-width="focusVisible ? focusRingWidth : undefined"
    :border-color="focusVisible ? CONTROL_FOCUS_COLOR : undefined"
    :class="
      cn(
        !clipContent && PADDING[padding],
        focusRing && mounted && 'focus-visible:outline-none',
        $attrs.class as string,
      )
    "
    v-bind="rest"
    @focusin="onFocusIn"
    @focusout="onFocusOut">
    <slot />
  </Squircle>
</template>

<script setup lang="ts">
import { useMounted } from "@vueuse/core";
import { focusRing as focusRingGeometry } from "../../../tailwind.config";
import { Squircle, type SquircleShadowPreset } from "../../utils/squircle";
import { CONTROL_FOCUS_COLOR, RADIUS } from "../../utils/controlSquircle";
import { cn } from "../../utils/cn";

/**
 * A card: a low-elevation `card`-radius squircle on the canvas, white unless
 * told otherwise. Every card in the portal is this — there is no CSS
 * `rounded-3xl bg-surface` card and no call-site shadow recipe. The default
 * `sm` shadow separates a card from the canvas; pass `shadow=null` only when
 * this geometry is serving as a recessed or flush nested panel rather than an
 * elevated card.
 *
 * `padding` is a preset rather than a class because the four values the portal
 * had settled on (12, 16, 24 and none) are a scale, and a fifth would be drift:
 *
 * - `lg` (24) — the reference, `Insights/StationEconomics.vue`: a card holding
 *   a title and a table or chart.
 * - `md` (16) — a card holding tiles or a form.
 * - `sm` (12) — a card holding chip rows that carry their own padding, like
 *   the operating-hours rows in the location dialog.
 * - `none` — the card pads nothing and the content does: a header or a row
 *   that is a card of its own, and every hairline list, whose rows run edge
 *   to edge so their fills span the card (`Overview/AttentionList.vue`; see
 *   `docs/design-system.md` § Hairline lists).
 *
 * The fill goes on `surfaceClass`, never `class`: a `bg-*` on the root paints a
 * rectangle inside the smoothed corner.
 *
 * A card that is a link is the link itself — `as` a `NuxtLink`, with `focusRing`
 * — rather than a card inside an `<a>`. Its ring is then the squircle one: a 2px
 * `surface-inverse` stroke along the card's own edge, switched by a focus handler
 * like `Pill`'s. An outline on an `<a>` around the card would follow a CSS
 * corner, a circle's, rather than the card's own.
 */
const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
} as const;

const {
  as = "div",
  radius = "card",
  padding = "lg",
  surfaceClass,
  shadow = "sm",
  clipContent = false,
  contentClass,
  focusRing = false,
} = defineProps<{
  /** The root's tag, or a component such as `NuxtLink` for a card that is a link. */
  as?: string | object;
  /**
   * `card` (24) is a card on the canvas; `row` (16) is a card nested inside one,
   * so the two corners read as belonging to each other rather than competing.
   */
  radius?: "card" | "row" | "menu";
  padding?: keyof typeof PADDING;
  /** A fill other than `surface` — `bg-surface-sunken` for a recessed panel. */
  surfaceClass?: string;
  /** The shared elevation preset. `null` is reserved for recessed or flush nested content. */
  shadow?: SquircleShadowPreset | null;
  /**
   * Clip the slot to the corner too, for content that paints to the edge: a
   * map, an image, a table or rows whose fills reach the corners. The card
   * keeps its height and its shadow, and `padding` moves onto the clipped
   * layer, which `contentClass` lays out.
   */
  clipContent?: boolean;
  /** The clipped layer's classes, with `clipContent`: the slot's layout. */
  contentClass?: string;
  /**
   * The keyboard focus ring, for a card that is itself a link or a button: a
   * 2px `surface-inverse` stroke along the card's own edge, as `Pill` draws
   * one, in place of the browser's outline.
   */
  focusRing?: boolean;
}>();

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const rest = computed(() => {
  const { class: _class, ...others } = attrs;
  return others;
});

const focusRingWidth = focusRingGeometry.width;
const focusVisible = shallowRef(false);
/**
 * The stroke is drawn by a focus handler, which a server-rendered page doesn't
 * have until it hydrates. Until then the browser's own ring stays on, as on a
 * `Pill`.
 */
const mounted = useMounted();

const onFocusIn = (event: FocusEvent) => {
  focusVisible.value =
    focusRing && event.target instanceof HTMLElement && event.target.matches(":focus-visible");
};

const onFocusOut = (event: FocusEvent) => {
  if (!(event.currentTarget instanceof HTMLElement)) return;
  if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
    return;
  focusVisible.value = false;
};
</script>
