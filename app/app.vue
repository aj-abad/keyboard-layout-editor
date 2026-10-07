<template>
  <SharedToasters />
  <DialogBackdrop />
  <!-- The lit rims the `.glass-*` classes and glass squircles draw with. -->
  <GlassFilters />
  <SharedSequenceIndicator />

  <!-- A document window: its title bar, and the editor under it. Every other
       layout is a browser tab of its own. -->
  <div class="flex h-dvh flex-col bg-surface">
    <AppTopBar :json-controls="app.dockUp.value ? DOCK_ID : POPOVER_ID" />
    <main class="relative min-h-0 flex-1">
      <div
        class="h-full transition-[padding] duration-slow ease-standard"
        :style="{ paddingRight: dockReach ? `${dockReach}px` : undefined }">
        <EditorWorkspace />
      </div>
      <div
        v-if="app.draggingFiles.value"
        class="pointer-events-none absolute inset-2 z-raised flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface outline-dashed outline-2 -outline-offset-2 outline-line-strong">
        <p class="type-label text-ink">Drop to open in a new tab</p>
        <p class="type-caption">Each file opens in a browser tab of its own.</p>
      </div>
      <ShellDock
        v-if="app.pinnable.value"
        :id="DOCK_ID"
        :tools="TOOLS"
        :pinned="toolState.pinned"
        :forward="toolState.forward"
        :collapsed="toolState.collapsed"
        heading-id="json-dock-heading"
        class="absolute bottom-4 right-4 top-4 z-raised"
        @select="app.tools.value.select($event)"
        @close="closeTab"
        @float="float"
        @collapse="collapse">
        <JsonPanel />
      </ShellDock>
    </main>
  </div>

  <ShellToolPopover
    :id="POPOVER_ID"
    :open="toolState.popover === JSON_TOOL"
    title="JSON"
    :glyph="IconNucleoBracketsCurly"
    :pinnable="app.pinnable.value"
    heading-id="json-popover-heading"
    class="fixed right-3 top-14"
    @pin="pin"
    @close="closePopover">
    <JsonPanel />
  </ShellToolPopover>

  <AppCommandPalette />
  <ShortcutsPanel />
  <FilePicker />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount } from "vue";
import SharedSequenceIndicator from "#layers/sine/app/components/Shared/SequenceIndicator.vue";
import SharedToasters from "#layers/sine/app/components/Shared/Toasters.vue";
import ShellDock from "#layers/sine/app/components/Shell/Dock.vue";
import ShellToolPopover from "#layers/sine/app/components/Shell/ToolPopover.vue";
import type { ShellTool } from "#layers/sine/app/components/Shell/tools";
import DialogBackdrop from "#layers/sine/app/components/UI/DialogBackdrop.vue";
import GlassFilters from "#layers/sine/app/components/UI/GlassFilters.vue";
import IconNucleoBracketsCurly from "#layers/sine/app/components/Icon/Nucleo/BracketsCurly.vue";
import { useOutsideClickSelection } from "#layers/sine/app/composables/useOutsideClickSelection";
import { useEditorCommands } from "./composables/useEditorCommands";
import { JSON_TOOL, nameOf, openTabDocument, provideLayoutApp } from "./composables/useLayoutApp";

// A click outside selectable text clears its highlight, as in a native app
// (Sine: Patterns › Text selection and copy).
useOutsideClickSelection();

// The tab's layout is settled before anything draws: which one its address
// names, and whether another tab already has it open.
const app = provideLayoutApp(await openTabDocument());
useEditorCommands(app);
useHead({ title: computed(() => nameOf(app.layout.value)) });
onBeforeUnmount(app.dispose);

const POPOVER_ID = "json-popover";
const DOCK_ID = "json-dock";
const TOOLS: readonly ShellTool[] = [{ id: JSON_TOOL, name: "JSON", glyph: IconNucleoBracketsCurly }];
/** How far the dock reaches into the window: the 384px card and the 16px it keeps from the edge. */
const DOCK_REACH = 384 + 16;

const toolState = computed(() => app.tools.value.state.value);
const dockReach = computed(() => (app.pinnable.value && app.dockUp.value ? DOCK_REACH : 0));

// Where focus goes as the tool moves between its shapes (Sine: Patterns › Shell).
async function focusSelector(selector: string) {
  await nextTick();
  document.querySelector<HTMLElement>(selector)?.focus();
}
const focusButton = () => focusSelector('[data-tool="json"]');
function closePopover() {
  app.tools.value.closePopover();
  focusButton();
}
function pin() {
  app.tools.value.pin();
  focusSelector("#json-dock-heading");
}
function float() {
  app.tools.value.float();
  focusSelector("#json-popover-heading");
}
function collapse() {
  app.tools.value.collapse();
  focusButton();
}
function closeTab(id: string) {
  app.tools.value.closeTab(id);
  focusButton();
}
</script>
