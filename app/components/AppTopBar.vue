<script setup lang="ts">
import Button from "#layers/sine/app/components/UI/Button.vue";
import IconButton from "#layers/sine/app/components/UI/IconButton.vue";
import KeyboardShortcut from "#layers/sine/app/components/UI/KeyboardShortcut.vue";
import IconNucleoBracketsCurly from "#layers/sine/app/components/Icon/Nucleo/BracketsCurly.vue";
import IconNucleoCircleQuestion from "#layers/sine/app/components/Icon/Nucleo/CircleQuestion.vue";
import IconNucleoMagnifier from "#layers/sine/app/components/Icon/Nucleo/Magnifier.vue";
import { useLayoutApp } from "../composables/useLayoutApp";
import { ariaKeyshortcuts } from "../utils/shortcuts";

/**
 * The title bar of a document window: the app's mark, the layout's name and
 * its help; the search that opens the command palette; and on the right what
 * is done to the layout: new and open, which go to browser tabs of their own,
 * Export, the page's primary action, and the JSON tool.
 */
const { jsonControls } = defineProps<{ jsonControls?: string }>();
const app = useLayoutApp();
</script>

<template>
  <header
    class="app-titlebar grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b px-3 md:grid-cols-[1fr_minmax(0,auto)_1fr] md:gap-4">
    <div class="flex min-w-0 items-center gap-1">
      <IconKeyboard class="mx-1.5 shrink-0 text-ink" aria-hidden="true" />
      <LayoutTitle />
      <IconButton
        aria-label="Help and keyboard shortcuts"
        aria-keyshortcuts="F1"
        class="shrink-0"
        @click="app.helpOpen.value = true">
        <IconNucleoCircleQuestion />
      </IconButton>
    </div>
    <div class="hidden items-center md:flex">
      <Button
        variant="outline"
        size="sm"
        class="text-ink-3"
        :aria-keyshortcuts="ariaKeyshortcuts('mod+k')"
        @click="app.paletteOpen.value = true">
        <template #leading><IconNucleoMagnifier /></template>
        <span class="mr-8 font-medium">Search commands…</span>
        <KeyboardShortcut keys="mod+k" />
      </Button>
    </div>
    <div class="flex min-w-0 items-center justify-end gap-3">
      <SaveStatus />
      <IconButton aria-label="Search commands" class="md:hidden" @click="app.paletteOpen.value = true">
        <IconNucleoMagnifier />
      </IconButton>
      <NewLayoutMenu />
      <ExportMenu />
      <!-- A tool takes `tint` while it is showing, never the dark of the primary action. -->
      <IconButton
        data-tool="json"
        aria-label="JSON"
        :aria-keyshortcuts="ariaKeyshortcuts('mod+j')"
        :aria-expanded="app.jsonShowing.value"
        :aria-controls="app.jsonShowing.value ? jsonControls : undefined"
        :class="app.jsonShowing.value && 'bg-tint text-ink hover:bg-tint'"
        @click="app.pressJson()">
        <IconNucleoBracketsCurly />
      </IconButton>
    </div>
  </header>
</template>
