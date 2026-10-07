<template>
  <Pill
    v-bind="rootBindings()"
    glass="md"
    :class="cn('flex items-center gap-2 px-3 py-1.5', $attrs.class as string)"
    data-sequence-indicator
    aria-hidden="true">
    <KeyboardShortcut :keys="keys" kbd-class="font-medium text-ink-2" />

    <svg
      class="size-4 shrink-0 -rotate-90"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false">
      <circle
        class="text-ink-5"
        cx="8"
        cy="8"
        :r="RING_RADIUS"
        fill="none"
        stroke="currentColor"
        :stroke-width="RING_WIDTH" />
      <circle
        class="text-ink-3"
        cx="8"
        cy="8"
        :r="RING_RADIUS"
        fill="none"
        stroke="currentColor"
        :stroke-width="RING_WIDTH"
        stroke-linecap="round"
        :stroke-dasharray="RING_LENGTH"
        :stroke-dashoffset="RING_LENGTH * (1 - fraction)" />
    </svg>
  </Pill>
</template>

<script setup lang="ts">
import { cn } from "../../utils/cn";
import { glassStroke } from "../../utils/controlSquircle";
import Pill from "../UI/Pill.vue";
import KeyboardShortcut from "../UI/KeyboardShortcut.vue";

const { keys, remainingFraction } = defineProps<{
  keys: readonly string[];
  remainingFraction: number;
}>();

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const rest = () => {
  const { class: _class, ...others } = attrs;
  return others;
};
const rootBindings = () => ({ ...rest(), ...glassStroke() });

const RING_WIDTH = 2;
const RING_RADIUS = 6;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const fraction = computed(() => Math.min(1, Math.max(0, remainingFraction)));
</script>
