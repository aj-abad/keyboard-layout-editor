<template>
  <div class="flex justify-center py-2" aria-hidden="true">
    <div class="h-1 w-9 bg-fill-4" :style="HANDLE_STYLE" />
  </div>
</template>

<script setup lang="ts">
import { squircleStyle } from "../../utils/squircle";

/**
 * The grab handle at the top of a context-menu sheet: the platform's own
 * sign that this is a sheet, and nothing more — it does not drag, since a
 * tap on the scrim and Escape both close the sheet. Decorative, so hidden
 * from the tree. A fixed-size pill with no chrome is a `squircleStyle()` clip
 * rather than a `Squircle` or a `rounded-full` box.
 *
 * It keeps its own 8px from the sheet's top edge. The sheet's surface is not
 * padded, so that its body can run to the bottom edge and fade into the rim,
 * and a margin here would collapse through the surface rather than hold it.
 */

const HANDLE_STYLE = squircleStyle({ width: 36, height: 4, radius: "full" });
</script>
