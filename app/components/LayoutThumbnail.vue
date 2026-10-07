<script setup lang="ts">
import { computed } from "vue";
import { line } from "#layers/sine/tailwind.config";
import type { Layout } from "../utils/layout";
import { canvasFrame, keyRects, PLATE_FALLBACK, safeColor, UNIT } from "../utils/svg";

/**
 * A layout in miniature, as a document's icon: its plate and its caps in their
 * own colors, without legends. It tells an ErgoDox from a 60% at a glance,
 * which a name alone often can't.
 */
const { layout } = defineProps<{ layout: Layout }>();

const frame = computed(() => canvasFrame(layout, UNIT / 3));
const caps = computed(() =>
  layout.keys.flatMap((key) =>
    key.decal
      ? []
      : keyRects(key).map((rect, index) => ({
          id: `${key.id}-${index}`,
          // Inset so neighboring caps stay apart at this size.
          x: rect.x + 4,
          y: rect.y + 4,
          width: Math.max(1, rect.width - 8),
          height: Math.max(1, rect.height - 8),
          fill: safeColor(key.color),
          opacity: key.ghost ? 0.45 : 1,
          transform: `rotate(${key.rotation_angle} ${key.rotation_x * UNIT} ${key.rotation_y * UNIT})`,
        })),
  ),
);
</script>

<template>
  <svg
    :viewBox="`${frame.x} ${frame.y} ${frame.width} ${frame.height}`"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    focusable="false"
    class="overflow-visible">
    <rect
      :x="frame.x"
      :y="frame.y"
      :width="frame.width"
      :height="frame.height"
      :rx="UNIT / 4"
      :fill="safeColor(layout.meta.backcolor, PLATE_FALLBACK)"
      :stroke="line.DEFAULT"
      stroke-width="1"
      vector-effect="non-scaling-stroke" />
    <rect
      v-for="cap in caps"
      :key="cap.id"
      :x="cap.x"
      :y="cap.y"
      :width="cap.width"
      :height="cap.height"
      :rx="UNIT / 10"
      :fill="cap.fill"
      :opacity="cap.opacity"
      :transform="cap.transform" />
  </svg>
</template>
