<template>
  <component :is="as" v-bind="passthrough" :class="rootClass">
    <!-- Named by the root, so the image never announces a second time. -->
    <img
      v-if="src && !imageFailed"
      ref="image"
      :src="src"
      alt=""
      draggable="false"
      class="size-full object-cover"
      @error="imageFailed = true" />
    <slot v-else :icon-size="metrics.icon">
      <component :is="icon" v-if="icon" :size="metrics.icon" />
      <span v-else-if="initials">{{ initials }}</span>
      <span v-else-if="art" class="avatar-art absolute inset-0" aria-hidden="true">
        <!--
          Sized inline, not by class: `Button` and `IconButton` size every svg
          inside them to their icon (`[&_svg]:size-4.5`), a rule a class on
          the art can't outrank, and the art has to fill the well.
        -->
        <svg
          :viewBox="ART_VIEWBOX"
          class="block"
          style="width: 100%; height: 100%"
          focusable="false">
          <path
            v-for="layer in art.layers"
            :key="layer.depth"
            :d="layer.d"
            :fill="art.colors[layer.depth]"
            :fill-rule="layer.evenOdd ? 'evenodd' : undefined"
            :stroke="layer.gutter ? art.colors.ground : undefined"
            :class="layer.gutter ? 'avatar-art__gutter' : undefined" />
        </svg>
      </span>
    </slot>
    <!--
      The ring is its own layer over the content. An inset shadow on the root
      paints under the root's children, so a full-bleed image or art hid it.
    -->
    <span
      v-if="ring || drawsArt"
      class="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-line"
      aria-hidden="true" />
    <span
      v-if="$slots.overlay"
      class="absolute inset-0 flex items-center justify-center"
      aria-hidden="true">
      <slot name="overlay" />
    </span>
  </component>
</template>

<script setup lang="ts">
import { statusFillClass, statusInkClass, type StatusTone } from "../../utils/status";
import { AVATAR_ART_BOX, avatarArt } from "../../utils/avatarArt";
import type { IconSize } from "../../utils/icons";
import { cn } from "../../utils/cn";

/**
 * The well: an image avatar, an icon well, an initials badge, or a seed's art.
 *
 * Round by default, for a person or a thing. A workspace or an organization
 * takes `shape="tile"`, its corners a quarter of the side, so the outline says
 * what a row names; Ampere's own avatar is a hexagon. Both are CSS corners,
 * not a `Squircle`. The `full` squircle radius keeps the 0.7 smoothing, so on
 * an equal-sided box it would not draw the true circle a person's avatar is.
 * And at these sizes the house continuous corner sits within 0.21px of a
 * circular corner of the same radius (at 64px; 0.08px at 24px), so the tile
 * needs none of the squircle's measuring either. `StatTile`'s compact glyph
 * well is a different shape; do not fold the two together.
 *
 * `EmptyState` draws its well from here, so the two cannot drift.
 */
type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/**
 * The well sits on the control height scale (§ Controls and icons), and its
 * glyph is one of the seven sizes icons are drawn at — never a size chosen to
 * fill the room. Every step clears the 4px minimum inset a decorative badge
 * keeps, by 6px or more.
 */
const SIZES = {
  xs: { box: "size-6", icon: 12, text: "text-micro" },
  sm: { box: "size-8", icon: 18, text: "text-xs" },
  md: { box: "size-10", icon: 18, text: "text-sm" },
  lg: { box: "size-12", icon: 24, text: "text-base" },
  xl: { box: "size-14", icon: 24, text: "text-lg" },
  "2xl": { box: "size-16", icon: 32, text: "text-xl" },
} as const satisfies Record<AvatarSize, { box: string; icon: IconSize; text: string }>;

const ART_VIEWBOX = `0 0 ${AVATAR_ART_BOX} ${AVATAR_ART_BOX}`;

const {
  as = "div",
  size = "md",
  shape = "circle",
  tone,
  icon,
  initials,
  seed,
  src,
  label,
  ring = false,
} = defineProps<{
  /** Element to render. `li` for a list row, `button` for a picker trigger. */
  as?: string;
  size?: AvatarSize;
  /** `tile` for a workspace or an organization. People and things stay round. */
  shape?: "circle" | "tile";
  /**
   * Tints the well with a status fill and its ink. Deliberately optional —
   * most wells are neutral, and a colour here is a claim about the situation.
   */
  tone?: StatusTone;
  /** An icon component. Sized here; use a native cut matching this well. */
  icon?: Component;
  /** Fallback text where there is no image or icon — one or two letters. */
  initials?: string;
  /**
   * Draws the art `utils/avatarArt.ts` makes from this seed where there is no
   * image: one identity hue, cut into three levels. Give it something that
   * never changes, such as a workspace's id (`workspace:1042`); a name can be
   * edited, and the art would change with it. `icon` and `initials` win over
   * it, and an image wins over everything.
   */
  seed?: string | null;
  /** Image URL. Falls through to the slot, icon, initials or art if it fails. */
  src?: string | null;
  /**
   * Accessible name. Omitted, a non-interactive well is decorative
   * (`aria-hidden`) — the common case, since it sits beside the name it
   * illustrates. An interactive one is never hidden; name it here.
   */
  label?: string;
  /**
   * Hairline inside the edge, for an image that can meet the surface behind.
   * Seeded art always draws one: its ground is pale by design.
   */
  ring?: boolean;
}>();

/**
 * `class` is merged through `cn` rather than falling through, so a caller's
 * one-off ink (`text-ink-4` on the OCPP empty states) actually beats the
 * tone's. Everything else — `@click`, `type` — still lands on the element.
 */
defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const imageFailed = ref(false);

/** A new subject gets a fresh attempt at its image. */
watch(
  () => src,
  () => (imageFailed.value = false),
);

// On a server-rendered page the image starts loading before the page
// hydrates, and an image that fails in that time has fired its `error` with no
// listener to hear it. `decode()` answers for it either way: it rejects for an
// image that failed, whether before or after this.
const image = useTemplateRef<HTMLImageElement>("image");
onMounted(() => {
  const attempted = src;
  image.value?.decode().catch(() => {
    if (src === attempted) imageFailed.value = true;
  });
});

const metrics = computed(() => SIZES[size]);

/** Drawn only when nothing else fills the well, and memoised by seed. */
const art = computed(() => (seed ? avatarArt(seed) : null));

/** The art's turn in the fallthrough: no image, no slot, no icon, no initials. */
const slots = useSlots();
const drawsArt = computed(
  () => !!art.value && !(src && !imageFailed.value) && !slots.default && !icon && !initials,
);

/**
 * Focusable and `aria-hidden` is the one combination to avoid, so an
 * interactive well is never hidden — and its name belongs to the control,
 * where `role="img"` would overwrite it.
 */
const isInteractive = computed(() => as === "button" || as === "a");

const passthrough = computed(() => {
  const { class: _ignored, ...rest } = attrs;
  if (label)
    return { ...rest, ...(isInteractive.value ? {} : { role: "img" }), "aria-label": label };
  return isInteractive.value ? rest : { ...rest, "aria-hidden": "true" };
});

const rootClass = computed(() =>
  cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden font-medium",
    shape === "tile" ? "rounded-[25%]" : "rounded-full",
    metrics.value.box,
    metrics.value.text,
    tone ? cn(statusFillClass[tone], statusInkClass[tone]) : "bg-fill-2 text-ink-3",
    attrs.class as string,
  ),
);
</script>

<style scoped>
/*
 * The gutter that parts the art's figures is sized in CSS pixels by the size
 * the well is drawn at, which a caller may set by class rather than `size`:
 * 1px up to 24, 1.5px up to 48, 2px above. So it never thins to a blur as the
 * art shrinks. `avatarArtGutter` states the same steps for a renderer that
 * knows its size; the two must agree.
 */
.avatar-art {
  container-type: size;
}

.avatar-art__gutter {
  stroke-width: 2px;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

@container (max-width: 48px) {
  .avatar-art__gutter {
    stroke-width: 1.5px;
  }
}

@container (max-width: 24px) {
  .avatar-art__gutter {
    stroke-width: 1px;
  }
}
</style>
