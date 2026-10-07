<!-- The editor's own mark: a keyboard, drawn for Nucleo's 18px UI grid in the
     glyph-duo treatment (Sine: Foundations › Iconography › Custom marks). The
     case is the soft layer and the keys the solid subject. -->
<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 18 18"
    fill="none"
    :width="size"
    :height="size"
    focusable="false">
    <rect
      x="1"
      y="3.75"
      width="16"
      height="10.5"
      rx="2.5"
      fill="currentColor"
      :opacity="duoOpacity"
      data-color="color-2" />
    <g fill="currentColor">
      <rect v-for="x in KEYS" :key="`a${x}`" :x="x" y="5.75" width="1.5" height="1.5" rx="0.5" />
      <rect v-for="x in KEYS" :key="`b${x}`" :x="x" y="8.25" width="1.5" height="1.5" rx="0.5" />
      <rect x="2.75" y="10.75" width="1.5" height="1.5" rx="0.5" />
      <rect x="5.5" y="10.75" width="7" height="1.5" rx="0.5" />
      <rect x="13.75" y="10.75" width="1.5" height="1.5" rx="0.5" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import type { NucleoIconProps } from "#layers/sine/app/utils/icons";

const { size = 18, duoOpacity = 0.4 } = defineProps<NucleoIconProps>();

/** Five keys a row, 1.5 wide with 1.25 between, centered in the 16px live area. */
const KEYS = [2.75, 5.5, 8.25, 11, 13.75];
</script>
