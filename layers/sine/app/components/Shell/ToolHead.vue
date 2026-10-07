<template>
  <header class="flex shrink-0 items-center gap-1 py-3 pl-6 pr-3">
    <!-- Where an open from the palette or a chord puts focus: the tool's name. -->
    <h2
      :id="headingId"
      data-shell-heading
      tabindex="-1"
      class="type-subheading flex min-w-0 flex-1 items-center gap-2 outline-none">
      <component :is="glyph" v-if="glyph" aria-hidden="true" class="shrink-0" />
      <span class="truncate"
        ><slot name="title">{{ title }}</slot></span
      >
    </h2>
    <slot name="actions" />
    <IconButton
      v-if="pinnable"
      :aria-label="pinned ? `Unpin ${title}` : `Pin ${title} beside the page`"
      :aria-pressed="pinned"
      :class="pinned && 'bg-tint text-ink hover:bg-tint'"
      @click="pinned ? emit('unpin') : emit('pin')">
      <IconDock />
    </IconButton>
    <IconButton v-if="pinned" aria-label="Collapse the dock" @click="emit('collapse')">
      <IconNucleoDoubleChevronRight />
    </IconButton>
    <IconButton v-else :aria-label="`Close ${title}`" disable-tooltip @click="emit('close')">
      <IconNucleoXmark />
    </IconButton>
  </header>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import IconButton from "../UI/IconButton.vue";
import IconDock from "../Icon/Dock.vue";
import IconNucleoDoubleChevronRight from "../Icon/Nucleo/DoubleChevronRight.vue";
import IconNucleoXmark from "../Icon/Nucleo/Xmark.vue";

/**
 * The head a tool keeps in both of its shapes (Patterns › Shell): its name,
 * led by its glyph where it has one, the tool’s own actions, then the pin and
 * the way out. In the popover the pin is at rest and the way out is a close.
 * In a dock holding one tool the pin is pressed, so pressing it again floats
 * the tool back, and the way out is the dock’s collapse, which keeps the pin.
 * A second pinned tool replaces this head with the tab strip.
 */
const {
  title,
  glyph,
  pinned = false,
  pinnable = true,
  headingId,
} = defineProps<{
  /** The tool’s name, which is also the heading. */
  title: string;
  /** The tool’s glyph, drawn before its name as it is on its button. */
  glyph?: Component;
  /** The tool is in the dock. */
  pinned?: boolean;
  /** Below `xl` nothing pins: the host hides the pin there. */
  pinnable?: boolean;
  headingId?: string;
}>();

const emit = defineEmits<{
  pin: [];
  unpin: [];
  close: [];
  collapse: [];
}>();
</script>
