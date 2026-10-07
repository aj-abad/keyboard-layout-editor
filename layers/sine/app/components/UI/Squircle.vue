<script setup lang="ts">
import {
  computed,
  onMounted,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
  type Component,
  type ComponentPublicInstance,
} from "vue";
import SquircleChrome from "./SquircleChrome.vue";
import {
  DEFAULT_SQUIRCLE_RADIUS,
  radiiToPx,
  toSquircleElement,
  type ConcentricOptions,
  type MotionValueLike,
  type SquircleAppearance,
  type SquirclePixelRadii,
  type SquircleProps,
  type SquircleRadius,
  type SquircleShadowLayer,
  type SquircleVisualValue,
} from "./squircleGeometry";
import { provideSquircleContainer, useConcentricRadius } from "./useConcentricRadius";
import { cn } from "../../utils/cn";
import { shadowLayers } from "../../../tailwind.config";

/**
 * The portal's smoothed surface primitive.
 *
 * Background, shadow and stroke live in separate layers because a `clip-path`
 * would otherwise cut off shadows and inline popovers. Animated appearance
 * values are resolved by `SquircleChrome`, outside the content slot's update
 * boundary, so the dashboard shell can animate without rerendering its page.
 *
 * The root never clips. The cast shadow is drawn past the root's box, so an
 * `overflow-*` there cuts the shadow to that box and clips the content to a
 * rectangle, not the shape. `clipContent` is the clip: the slot moves into a
 * layer clipped to the path that stays in flow, so the squircle keeps its
 * height and its shadow. The layer fills the root edge to edge, so a clipped
 * squircle pads and lays out through `contentClass`.
 */

const props = withDefaults(defineProps<SquircleProps>(), {
  as: "div",
  appearance: () => ({}),
  concentric: false,
  clipContent: false,
  highlight: undefined,
  borderStyle: "solid",
  rightInset: 0,
});

defineSlots<{ default?: () => unknown }>();

const host = useTemplateRef<HTMLElement | ComponentPublicInstance>("host");
const clipId = `squircle-${useId()}`;
const measured = shallowRef(false);

const rootTag = computed(() => props.as as string | Component);

/**
 * `radius` stays the corner this squircle asks for; `concentric` says to take
 * the enclosing squircle's corner less the inset instead, once both boxes have
 * been measured. So `radius` doubles as the pre-measurement fallback — one
 * frame of the author's own value rather than a frame of nothing — and remains
 * the answer wherever there is no enclosing squircle to derive from.
 */
const concentricOptions = computed<ConcentricOptions | null>(() =>
  props.concentric ? (props.concentric === true ? {} : props.concentric) : null,
);
const concentricRadii = useConcentricRadius(
  () => host.value,
  () => concentricOptions.value,
);
const effectiveRadius = computed<SquircleRadius | undefined>(
  () => concentricRadii.value ?? props.radius,
);

const resolvedAppearance = computed<SquircleAppearance>(() => ({
  radius: props.appearance.radius ?? effectiveRadius.value,
  borderWidth: props.appearance.borderWidth ?? props.borderWidth,
  borderColor: props.appearance.borderColor ?? props.borderColor,
}));
/**
 * The ground inside the clip. `clipContent` puts the slot in a layer clipped to
 * the path, and a clipped layer is the backdrop root of any glass inside it: a
 * backdrop blur takes in only what that layer holds. The fill is painted by the
 * chrome, outside it, so glass in the content over anything see-through had no
 * ground to blur and could only lay a blurred copy over the sharp content.
 *
 * So a plain, opaque fill is painted again inside the clipped layer, where it
 * covers nothing the fill did not already cover. Only then: a see-through fill
 * painted twice would darken, a fill with state variants may turn see-through,
 * and a second coat over glass, a cut or an inset shadow would double the
 * wash, close the cut or cover the shadow. Opacity is read off the surface once
 * it is mounted, since a token's alpha is not in its name. A fill in
 * `contentClass` wins over the ground.
 */
const groundFill = computed(() => {
  if (!props.clipContent || props.glass || props.surfaceCut) return undefined;
  const shadow = props.shadow ?? [];
  const layers: readonly SquircleShadowLayer[] =
    typeof shadow === "string" ? shadowLayers[shadow] : shadow;
  if (layers.some((layer) => layer.inset)) return undefined;
  const tokens = (props.surfaceClass ?? "").split(/\s+/).filter(Boolean);
  if (tokens.some((token) => token.includes(":"))) return undefined;
  const fill = tokens.filter((token) => token.startsWith("bg-"));
  return fill.length > 0 ? fill.join(" ") : undefined;
});

/**
 * A computed colour's alpha: the value after the slash, the fourth of a legacy
 * `rgba()`, 1 for a colour function without either, and 0 for anything else.
 * Browsers compute a twinned token on a wide-gamut screen to
 * `color(display-p3 …)` and a mixed one to `oklab(…)`, not `rgb()`.
 */
const alphaOf = (color: string) => {
  const body = /^[a-z-]+\((.*)\)$/.exec(color.trim())?.[1];
  if (body === undefined) return 0;
  const slash = body.split("/")[1]?.trim();
  if (slash !== undefined) {
    return slash.endsWith("%") ? Number.parseFloat(slash) / 100 : Number(slash);
  }
  const channels = body.split(",");
  return channels.length === 4 ? Number(channels[3]) : 1;
};

const groundOpaque = shallowRef(false);
const readGround = () => {
  const surface = groundFill.value
    ? toSquircleElement(host.value)?.querySelector<HTMLElement>(":scope > .squircle__surface")
    : null;
  if (!surface) {
    groundOpaque.value = false;
    return;
  }
  const style = getComputedStyle(surface);
  groundOpaque.value = style.backgroundImage === "none" && alphaOf(style.backgroundColor) === 1;
};
onMounted(readGround);
watch(groundFill, readGround, { flush: "post" });

const contentClasses = computed(() =>
  cn("squircle__content", groundOpaque.value && groundFill.value, props.contentClass),
);

const isMotionValueLike = <T,>(value: unknown): value is MotionValueLike<T> => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<MotionValueLike<T>>;
  return typeof candidate.get === "function" && typeof candidate.on === "function";
};

const readVisualValue = <T,>(source: SquircleVisualValue<T> | undefined, fallback: T): T => {
  if (source === undefined) return fallback;
  return isMotionValueLike<T>(source) ? source.get() : source;
};

const fallbackRadius = computed(() => {
  const radius = radiiToPx(
    readVisualValue(resolvedAppearance.value.radius, DEFAULT_SQUIRCLE_RADIUS),
  );
  return typeof radius === "number"
    ? `${radius}px`
    : radius.map((corner) => `${corner}px`).join(" ");
});
/**
 * On glass the clipped layer is masked rather than clipped: the chrome fades
 * content out across the rim, and the fade's mask is closed past the outline,
 * so it is the clip as well. An SVG clip beside it would only repeat it, and
 * Chromium has been seen to drop an element's mask under one.
 */
const clippedContentStyle = computed(() => {
  if (!measured.value) return { borderRadius: fallbackRadius.value };
  return props.glass ? {} : { clipPath: `url(#${clipId})` };
});

/**
 * What a nested squircle measures against. The radii are read after this one's
 * own concentric pass, so containers chain; a `MotionValue` radius is read at
 * evaluation time rather than subscribed to, so a corner that animates settles
 * its descendants on the next measurement instead of every frame.
 */
const containerRadii = computed<SquirclePixelRadii>(() => {
  const corners = radiiToPx(
    readVisualValue(resolvedAppearance.value.radius, DEFAULT_SQUIRCLE_RADIUS),
  );
  return typeof corners === "number" ? [corners, corners, corners, corners] : corners;
});
provideSquircleContainer({
  element: computed(() => toSquircleElement(host.value)),
  radii: containerRadii,
});
</script>

<template>
  <component :is="rootTag" ref="host" :class="['squircle', clipContent && 'squircle--clip']">
    <SquircleChrome
      :host
      :clip-id="clipId"
      :appearance="resolvedAppearance"
      :surface-class="surfaceClass"
      :surface-cut="surfaceCut"
      :tip
      :glass
      :shadow
      :highlight
      :border-style="borderStyle"
      :right-inset="rightInset"
      @measured-change="measured = $event" />

    <div v-if="clipContent" :class="contentClasses" :style="clippedContentStyle">
      <slot />
    </div>
    <slot v-else />
  </component>
</template>
