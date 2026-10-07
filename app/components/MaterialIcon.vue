<script setup lang="ts">
defineProps<{ name: 'expand-more' | 'close' | 'add' | 'keyboard' }>()

// Google Material Icons, Apache-2.0. Adapted to a shared, decorative SVG component.
// Source: https://github.com/google/material-design-icons/tree/master/src
// License: public/licenses/material-icons.txt
const paths = {
  'expand-more': 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  keyboard: 'M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z',
}
</script>

<template>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" class="shrink-0" :data-material-icon="name">
    <path :d="paths[name]" />
  </svg>
</template>
