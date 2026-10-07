<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from "vue";
import { stringifyRows, type Layout } from "../utils/layout";
import { useLayoutApp } from "../composables/useLayoutApp";

/**
 * The JSON tool's body for the tab's layout: its KLE JSON, or the edit to it
 * that hasn't been applied, which is kept with the layout until it is.
 */
const app = useLayoutApp();
const raw = app.document.raw;
const text = computed(() => raw.value ?? stringifyRows(app.layout.value));
const changed = computed(() => raw.value !== null);
const editor = useTemplateRef<{ focus: () => void }>("editor");

function change(next: string) {
  raw.value = next === stringifyRows(app.layout.value) ? null : next;
}
function discard() {
  raw.value = null;
}
function apply(parsed: Layout, source: string) {
  if (source !== text.value) return;
  app.editor.value.applyLayout(parsed);
  raw.value = null;
}

// Opened from the palette or its chord, the caret goes into the JSON.
watch(
  app.jsonFocus,
  async (requested) => {
    if (!requested) return;
    await nextTick();
    editor.value?.focus();
    app.jsonFocus.value = false;
  },
  { immediate: true },
);
</script>

<template>
  <RawJsonEditor
    ref="editor"
    :text="text"
    :changed="changed"
    :parse="app.parser.parse"
    @change="change"
    @apply="apply"
    @discard="discard" />
</template>
