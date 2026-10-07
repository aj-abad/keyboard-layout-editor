<template>
  <IconButton
    variant="ghost"
    size="md"
    :aria-label="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
    @click="isSidebarCollapsed = !isSidebarCollapsed">
    <svg aria-hidden="true" focusable="false" viewBox="0 0 18 18">
      <path :d="FRAME_PATH" fill="currentColor" opacity="0.4" />
      <path :d="PANEL_PATH" fill="currentColor" />
      <motion.polyline
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        :initial="false"
        :animate="iconState"
        :variants="chevronVariants"
        :transition="chevronTransition"
        :points="HIDE_CHEVRON_POINTS"
        tabindex="-1" />
    </svg>
  </IconButton>
</template>
<script setup lang="ts">
import { motion, useReducedMotion } from "motion-v";
import IconButton from "../UI/IconButton.vue";

// Nucleo ui/sidebar-left-hide and ui/sidebar-left-show (glyph-duo, 18px).
// Their filled background and solid panel stay fixed. The vendor's rounded
// chevron is drawn as its equivalent polyline so `points` interpolates and
// it folds through flat, the way the caret always has.
const PANEL_PATH =
  "M7.00012 2H3.75012C2.23352 2 1.00012 3.2334 1.00012 4.75V13.25C1.00012 14.7666 2.23352 16 3.75012 16H7.00012V2Z";
const FRAME_PATH =
  "M14.2501 2H3.75012C2.23134 2 1.00012 3.23122 1.00012 4.75V13.25C1.00012 14.7688 2.23134 16 3.75012 16H14.2501C15.7689 16 17.0001 14.7688 17.0001 13.25V4.75C17.0001 3.23122 15.7689 2 14.2501 2Z";
const HIDE_CHEVRON_POINTS = "12.25 6.5 9.75 9 12.25 11.5";
const SHOW_CHEVRON_POINTS = "10.25 6.5 12.75 9 10.25 11.5";

const isSidebarCollapsed = defineModel<boolean>("isCollapsed", { required: true });
const reducedMotion = useReducedMotion();

const iconState = computed(() => (isSidebarCollapsed.value ? "collapsed" : "expanded"));
const chevronTransition = computed(() =>
  reducedMotion.value
    ? ({ duration: 0 } as const)
    : ({ duration: 0.2, ease: [0.37, 0, 0.63, 1] } as const),
);

const chevronVariants = {
  expanded: { points: HIDE_CHEVRON_POINTS },
  collapsed: { points: SHOW_CHEVRON_POINTS },
};
</script>
