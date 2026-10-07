<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from "vue";
import Input from "#layers/sine/app/components/UI/Input.vue";
import { nameOf, useLayoutApp } from "../composables/useLayoutApp";

/**
 * The open layout's name, in the title bar where a document app names its
 * document, and renamed in place there: a click (or F2) turns it into its
 * field, Enter or leaving it keeps the name, and Escape puts it back.
 */
const app = useLayoutApp();
const name = computed(() => nameOf(app.layout.value));
const dirty = computed(() => app.dirty.value);
const field = useTemplateRef<InstanceType<typeof Input>>("field");
const trigger = useTemplateRef<HTMLButtonElement>("trigger");
let settled = false;

watch(app.renaming, async (renaming) => {
  if (!renaming) return;
  settled = false;
  await nextTick();
  const input = field.value?.$el?.querySelector("input") as HTMLInputElement | undefined;
  input?.focus();
  input?.select();
});

async function finish(keep: boolean, event?: Event) {
  if (settled || !app.renaming.value) return;
  settled = true;
  if (keep && event) app.rename((event.target as HTMLInputElement).value);
  app.renaming.value = false;
  await nextTick();
  trigger.value?.focus();
}
</script>

<template>
  <Input
    v-if="app.renaming.value"
    ref="field"
    size="sm"
    container-class="w-72 min-w-0"
    :model-value="app.layout.value.meta.name"
    placeholder="Untitled layout"
    aria-label="Layout name"
    autocomplete="off"
    spellcheck="false"
    @keydown.enter.prevent="finish(true, $event)"
    @keydown.esc.prevent.stop="finish(false)"
    @blur="finish(true, $event)" />
  <button
    v-else
    ref="trigger"
    type="button"
    class="focus-ring flex h-8 min-w-0 items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink hover:bg-fill-2 active:bg-fill-3"
    :aria-label="`Rename “${name}”`"
    aria-keyshortcuts="F2"
    @click="app.renaming.value = true">
    <span class="truncate">{{ name }}</span>
    <span v-if="dirty" class="size-1.5 shrink-0 rounded-full bg-ink-4" aria-hidden="true" />
  </button>
</template>
