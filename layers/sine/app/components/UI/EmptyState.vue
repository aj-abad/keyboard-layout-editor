<template>
  <div
    :class="
      cn(
        variant === 'quiet' ? 'text-left' : 'flex flex-col items-center justify-center text-center',
        variant === 'quiet' ? undefined : compact ? 'px-4 py-8' : 'px-6 py-12',
        $attrs.class as string,
      )
    ">
    <p v-if="variant === 'quiet'" class="type-caption text-ink-4">{{ title }}</p>
    <template v-else>
      <div v-if="$slots.illustration" :class="compact ? 'mb-2' : 'mb-3'">
        <slot name="illustration" />
      </div>
      <Avatar
        v-else-if="$slots.icon"
        :size="compact ? 'md' : 'xl'"
        :tone="tone"
        :class="compact ? 'mb-2' : 'mb-3'">
        <slot name="icon" />
      </Avatar>
      <p :class="compact ? 'type-label text-ink' : 'type-subheading'">{{ title }}</p>
      <p
        v-if="description || $slots.default"
        class="type-body-sm mt-1 max-w-[44ch] text-ink-3 text-balance">
        <slot>{{ description }}</slot>
      </p>
      <div v-if="$slots.action" :class="compact ? 'mt-3' : 'mt-6'">
        <slot name="action" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Avatar from "./Avatar.vue";
import type { StatusTone } from "../../utils/status";
import { cn } from "../../utils/cn";

/**
 * An empty state as one primitive: icon well, title, one sentence, optional
 * action. It replaced about twenty hand-rolled variants — bare centred text,
 * bordered translucent boxes, shadowed cards — that disagreed on padding, ink
 * and whether there was an icon at all.
 *
 * It draws no card of its own. Put it *inside* a `Card` when the list it
 * stands in for lives in one, and straight on the canvas when the list does.
 * `compact` is for an illustrated state inside a panel or a small card, where
 * the full 56px well would be most of the height. `variant="quiet"` is the
 * title-only treatment for a small absence inside a table, detail panel or
 * other dense operational surface. Its parent owns padding and alignment.
 *
 * `tone` tints the icon well — `warn` for "no location assigned", for example —
 * and is deliberately optional: most empty states are neutral, and a colour
 * there is a claim about the situation. Glass illustrations use
 * `#illustration` instead and do not draw a well.
 *
 * Icon: choose the matching native cut for its well; Glass uses the illustration slot.
 * Illustration: a standalone SVG in `#illustration`, without an avatar well.
 */
const {
  title,
  description,
  tone,
  compact = false,
  variant = "default",
} = defineProps<{
  title: string;
  description?: string;
  tone?: StatusTone;
  compact?: boolean;
  variant?: "default" | "quiet";
}>();

defineOptions({ inheritAttrs: false });
</script>
