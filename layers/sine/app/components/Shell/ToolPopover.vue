<template>
  <Transition :css="false" @leave="exitDropdownContent">
    <!-- `.dropdown-content` carries the house entrance and exit, as it does for
         every menu; `data-side` and `data-align` set its origin to the corner
         the popover hangs from. -->
    <Squircle
      v-if="open"
      as="aside"
      :id="id"
      :aria-label="title"
      :radius="RADIUS.card"
      glass="lg"
      v-bind="{ ...glassStroke(), ...rest }"
      clip-content
      content-class="flex h-full min-h-0 flex-col"
      data-side="bottom"
      data-align="end"
      data-state="open"
      :class="
        cn(
          'dropdown-content dropdown-content--panel h-[34rem] max-h-[calc(100vh-4rem)] w-96',
          attrs.class as string,
        )
      "
      :style="{ zIndex: zIndex.floating }"
      @keydown.escape="emit('close')">
      <ShellToolHead
        :title="title"
        :glyph="glyph"
        :pinnable="pinnable"
        :heading-id="headingId"
        @pin="emit('pin')"
        @close="emit('close')">
        <template v-if="$slots.actions" #actions>
          <slot name="actions" />
        </template>
      </ShellToolHead>
      <div class="min-h-0 flex-1">
        <slot />
      </div>
    </Squircle>
  </Transition>
</template>

<script setup lang="ts">
import { useAttrs, type Component } from "vue";
import { zIndex } from "../../../tailwind.config";
import { RADIUS, glassStroke } from "../../utils/controlSquircle";
import { exitDropdownContent } from "../../utils/dropdownExit";
import { Squircle } from "../../utils/squircle";
import { cn } from "../../utils/cn";
import ShellToolHead from "./ToolHead.vue";

/**
 * A tool, open over the page (Patterns › Shell): one tool at a time, from its
 * button in the top bar, until it is closed or pinned. It is the inbox
 * panel’s sibling, `glass-lg` at the card radius, 384 by 544, the same size
 * whatever it holds, so nothing in it moves as its content arrives. It stays
 * open while the operator works on the page, and Escape, with focus inside,
 * closes it.
 *
 * The host places it: under the top bar at the right, `fixed right-4 top-14`
 * in the portal, and returns focus to the tool’s button when it closes. The
 * body is the slot, which scrolls on its own where it needs to.
 */
defineOptions({ inheritAttrs: false });

const {
  open = false,
  title,
  glyph,
  pinnable = true,
  id,
  headingId,
} = defineProps<{
  open?: boolean;
  /** The tool’s name: the heading, and the popover’s accessible name. */
  title: string;
  glyph?: Component;
  /** Below `xl` nothing pins: the host hides the pin there. */
  pinnable?: boolean;
  /** For the tool button’s `aria-controls`. */
  id?: string;
  headingId?: string;
}>();

const emit = defineEmits<{
  pin: [];
  close: [];
}>();

const attrs = useAttrs();
/** Everything but `class`, which is merged above so a host’s size and place win. */
const rest = computed(() => {
  const { class: _class, ...others } = attrs;
  return others;
});
</script>
