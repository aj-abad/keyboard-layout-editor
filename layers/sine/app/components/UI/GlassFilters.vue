<template>
  <svg class="pointer-events-none absolute size-0" aria-hidden="true" focusable="false">
    <defs>
      <GlassRimFilter
        v-for="(level, name) in glass"
        :id="`glass-rim-${name}`"
        :key="name"
        :width="level.rim" />
    </defs>
  </svg>
</template>

<script setup lang="ts">
import { glass } from "../../../tailwind.config";
import GlassRimFilter from "./GlassRimFilter.vue";

/**
 * The document's glass filters, mounted once in the app shell beside
 * `DialogBackdrop`: one lit rim per level, `#glass-rim-sm`, `-md` and `-lg`,
 * each at its level's width.
 *
 * A CSS `filter: url(#…)` can only name a filter in the same document, so the
 * `.glass-*` classes light their rim from here. A glass `Squircle` builds its
 * own and needs none of this. Without it the class's rim layer draws
 * unfiltered, as a black shape blended with `plus-lighter`, which adds
 * nothing: the edge loses its light and nothing else changes.
 *
 * Not `display: none`, which would stop the filters from rendering in some
 * browsers: a box with no size, taken out of flow.
 */
</script>
