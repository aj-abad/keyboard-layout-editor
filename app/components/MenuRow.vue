<script setup lang="ts">
import type { Component } from "vue";
import { DropdownMenuItem } from "reka-ui";
import KeyboardShortcut from "#layers/sine/app/components/UI/KeyboardShortcut.vue";
import { ariaKeyshortcuts } from "../utils/shortcuts";

/**
 * One command in a menu: its glyph, its name, and its shortcut as a hint
 * (Sine: Patterns › Menus › Shortcut hints). The hint is drawn for the eye and
 * stated to assistive technology as the row's `aria-keyshortcuts`. A row that
 * opens a dialog ends its label in an ellipsis.
 */
const {
  label,
  shortcut,
  icon,
  disabled = false,
  destructive = false,
} = defineProps<{
  label: string;
  shortcut?: string;
  icon?: Component;
  disabled?: boolean;
  destructive?: boolean;
}>();
const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <DropdownMenuItem
    :class="['menu-item', destructive && 'menu-item--destructive']"
    :disabled="disabled"
    :aria-keyshortcuts="shortcut ? ariaKeyshortcuts(shortcut) : undefined"
    @select="emit('select')">
    <component :is="icon" v-if="icon" :size="18" aria-hidden="true" class="shrink-0" />
    <span class="min-w-0 flex-1 truncate">{{ label }}</span>
    <KeyboardShortcut v-if="shortcut" :keys="shortcut" class="shrink-0 text-ink-4" aria-hidden="true" />
  </DropdownMenuItem>
</template>
