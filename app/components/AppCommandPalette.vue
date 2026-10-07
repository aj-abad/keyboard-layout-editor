<script setup lang="ts">
import { computed, ref } from "vue";
import CommandPalette, { type CommandPaletteItem } from "#layers/sine/app/components/UI/CommandPalette.vue";
import { commands, searchCommands } from "#layers/sine/app/composables/commandRegistry";
import { useLayoutApp } from "../composables/useLayoutApp";

/**
 * Sine's command palette over every command the editor has registered, best
 * match first. It opens on ⌘K or Ctrl+K, and from the title bar's search.
 */
const app = useLayoutApp();
const query = ref("");
const results = computed(() =>
  searchCommands(
    commands.value.filter((command) => !command.hidden),
    query.value,
  ),
);
function run(item: CommandPaletteItem) {
  results.value.find((command) => command.id === item.id)?.action();
}
</script>

<template>
  <CommandPalette
    v-model:open="app.paletteOpen.value"
    v-model:query="query"
    :items="results"
    title="Commands"
    placeholder="Search commands…"
    initial-text="Type to search commands."
    @select="run" />
</template>
