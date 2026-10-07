<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { DropdownMenuSeparator } from "reka-ui";
import Button from "#layers/sine/app/components/UI/Button.vue";
import ContextMenu from "#layers/sine/app/components/UI/ContextMenu.vue";
import ContextMenuContent from "#layers/sine/app/components/UI/ContextMenuContent.vue";
import EmptyState from "#layers/sine/app/components/UI/EmptyState.vue";
import IconButton from "#layers/sine/app/components/UI/IconButton.vue";
import IconNucleoArrowRotateClockwise from "#layers/sine/app/components/Icon/Nucleo/ArrowRotateClockwise.vue";
import IconNucleoArrowRotateAnticlockwise from "#layers/sine/app/components/Icon/Nucleo/ArrowRotateAnticlockwise.vue";
import IconNucleoCopy from "#layers/sine/app/components/Icon/Nucleo/Copy.vue";
import IconNucleoExpand from "#layers/sine/app/components/Icon/Nucleo/Expand.vue";
import IconNucleoPen2 from "#layers/sine/app/components/Icon/Nucleo/Pen2.vue";
import IconNucleoPlus from "#layers/sine/app/components/Icon/Nucleo/Plus.vue";
import IconNucleoRedo from "#layers/sine/app/components/Icon/Nucleo/Redo.vue";
import IconNucleoSidebarRight from "#layers/sine/app/components/Icon/Nucleo/SidebarRight.vue";
import IconNucleoSquareDashed2 from "#layers/sine/app/components/Icon/Nucleo/SquareDashed2.vue";
import IconNucleoTrash from "#layers/sine/app/components/Icon/Nucleo/Trash.vue";
import IconNucleoUndo from "#layers/sine/app/components/Icon/Nucleo/Undo.vue";
import type { ContextMenuOpenRequest } from "#layers/sine/app/utils/contextMenu";
import type { Key } from "../utils/layout";
import type { Zoom } from "../utils/zoom";
import { useLayoutApp } from "../composables/useLayoutApp";
import { ariaKeyshortcuts } from "../utils/shortcuts";

/**
 * The editor's page: one instrument, edge to edge in the canvas (Sine:
 * Patterns › Page composition › Workspace pages). The stage and its toolbar
 * row, and the inspector beside them, divided by hairlines. The inspector
 * stands beside the stage while the workspace is at least 42rem wide (a
 * 24rem stage and the 18rem inspector) and under it when narrower, where it
 * isn't drawn while nothing is selected.
 */
const app = useLayoutApp();
const editor = app.editor;
const layout = app.layout;
const selectedIds = computed(() => editor.value.selectedIds.value);
const selectedKeys = computed(() => editor.value.selectedKeys.value);
const zoom = computed<Zoom>({
  get: () => app.document.zoom.value,
  set: (value) => {
    app.document.zoom.value = value;
  },
});

const canvas = useTemplateRef<{ editLegend: (id: string) => Promise<void> }>("canvas");
const inspector = useTemplateRef<{ focusLegends: () => Promise<void> }>("inspector");
/** Several keys' legends are typed once in the inspector, which writes them all. */
async function editInInspector() {
  app.inspectorHidden.value = false;
  // A hidden inspector mounts first, then takes the caret.
  await nextTick();
  inspector.value?.focusLegends();
}
/** Edit legends: one key's on the key itself, several keys' in the inspector. */
function editLegends() {
  const [only, ...others] = selectedIds.value;
  if (only && !others.length && canvas.value) canvas.value.editLegend(only);
  else editInInspector();
}
// The menu gives focus back to where it was when it closes; a choice that
// opens a field takes that focus instead, once the menu has gone.
let editOnClose = false;
function editAfterMenu() {
  editOnClose = true;
}
function onMenuClosed(event: Event) {
  if (!editOnClose) return;
  editOnClose = false;
  event.preventDefault();
  editLegends();
}

// -- The stage's one menu ------------------------------------------------------

const menuSubject = ref<"keys" | "stage">("stage");
/** A right-click on a key acts on the selection, which takes the key if it wasn't in it. */
function pickSubject({ event }: ContextMenuOpenRequest) {
  const id = (event.target as Element | null)?.closest<SVGElement>("[data-key-id]")?.dataset.keyId;
  if (!id) {
    menuSubject.value = "stage";
    return;
  }
  if (!selectedIds.value.includes(id)) editor.value.selectKey(id);
  menuSubject.value = "keys";
}

const updateKeys = (patch: Partial<Key>) => editor.value.updateKeys(patch);
function defaults(property: "textColor" | "textSize", value: string | number) {
  if (property === "textColor") editor.value.setTextColor(String(value));
  else editor.value.setTextSize(Number(value));
}
const count = computed(() => {
  const selected = selectedIds.value.length;
  if (selected) return `${selected} selected`;
  const keys = layout.value.keys.length;
  return `${keys} ${keys === 1 ? "key" : "keys"}`;
});

/** The two-pane grid, from the workspace's own width rather than the window's. */
const GRID_WITH_INSPECTOR =
  "grid-rows-[minmax(0,1fr)_fit-content(40%)] [@container_editor_(min-width:42rem)]:grid-cols-[minmax(0,1fr)_18rem] [@container_editor_(min-width:42rem)]:grid-rows-[minmax(0,1fr)]";
const INSPECTOR_PANE =
  "min-h-0 min-w-0 border-t [@container_editor_(min-width:42rem)]:border-l [@container_editor_(min-width:42rem)]:border-t-0";
const INSPECTOR_IDLE = "hidden [@container_editor_(min-width:42rem)]:block";
</script>

<template>
  <div class="h-full min-h-0 min-w-0 bg-surface" style="container: editor / inline-size">
    <div
      class="grid h-full min-h-0"
      :class="app.inspectorHidden.value ? 'grid-rows-[minmax(0,1fr)]' : GRID_WITH_INSPECTOR">
      <section class="flex min-h-0 min-w-0 flex-col" aria-label="Layout">
        <!-- The pane's one toolbar row: what the stage holds on the left, and on the
             right the count, which becomes the selection and its verbs. -->
        <div class="flex h-12 shrink-0 items-center gap-2 border-b pl-4 pr-2">
          <Button
            variant="secondary"
            size="sm"
            :aria-keyshortcuts="ariaKeyshortcuts('n')"
            @click="editor.addKey()">
            <template #leading><IconNucleoPlus /></template>
            Add key
          </Button>
          <div class="ml-auto flex min-w-0 items-center gap-1">
            <p
              class="type-caption truncate pr-2 tabular-nums [@container_editor_(max-width:30rem)]:sr-only"
              :class="selectedIds.length ? 'text-ink-2' : undefined"
              aria-live="polite"
              aria-atomic="true">
              {{ count }}
            </p>
            <template v-if="selectedIds.length">
              <IconButton
                aria-label="Duplicate"
                :aria-keyshortcuts="ariaKeyshortcuts('mod+d')"
                @click="editor.duplicateSelected()">
                <IconNucleoCopy />
              </IconButton>
              <IconButton
                aria-label="Rotate clockwise"
                :aria-keyshortcuts="ariaKeyshortcuts('r')"
                @click="editor.rotateSelected(15)">
                <IconNucleoArrowRotateClockwise />
              </IconButton>
              <IconButton
                aria-label="Delete"
                :aria-keyshortcuts="ariaKeyshortcuts('delete')"
                @click="editor.deleteSelected()">
                <IconNucleoTrash />
              </IconButton>
              <span class="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
            </template>
            <IconButton
              aria-label="Undo"
              :aria-keyshortcuts="ariaKeyshortcuts('mod+z')"
              :disabled="!editor.canUndo.value"
              @click="editor.undo()">
              <IconNucleoUndo />
            </IconButton>
            <IconButton
              aria-label="Redo"
              :aria-keyshortcuts="ariaKeyshortcuts('mod+shift+z')"
              :disabled="!editor.canRedo.value"
              @click="editor.redo()">
              <IconNucleoRedo />
            </IconButton>
            <span class="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
            <IconButton
              :aria-label="app.inspectorHidden.value ? 'Show inspector' : 'Hide inspector'"
              :aria-keyshortcuts="ariaKeyshortcuts('mod+alt+i')"
              :aria-expanded="!app.inspectorHidden.value"
              @click="app.inspectorHidden.value = !app.inspectorHidden.value">
              <IconNucleoSidebarRight />
            </IconButton>
          </div>
        </div>

        <div class="relative min-h-0 flex-1">
          <ContextMenu @before-open="pickSubject">
            <template #trigger>
              <KeyboardCanvas
                ref="canvas"
                class="absolute inset-0"
                :layout="layout"
                :selected-ids="selectedIds"
                :zoom="zoom"
                @update:zoom="zoom = $event"
                @scale="app.stageScale.value = $event"
                @select="(id, additive) => editor.selectKey(id, additive)"
                @clear="editor.clearSelection()"
                @move="(dx, dy) => editor.moveSelected(dx, dy)"
                @duplicate="(ids, dx, dy) => editor.duplicateDragged(ids, dx, dy)"
                @resize="(id, geometry) => editor.resizeKey(id, geometry)"
                @marquee="(ids, additive) => editor.selectIds(ids, additive)"
                @legend="(id, index, text) => editor.updateKeyLegend(id, index, text)"
                @edit="editInInspector" />
            </template>
            <ContextMenuContent
              :aria-label="menuSubject === 'keys' ? 'Selected keys' : 'Layout'"
              @close-auto-focus="onMenuClosed">
              <template v-if="menuSubject === 'keys'">
                <MenuRow label="Edit legends" :icon="IconNucleoPen2" shortcut="enter" @select="editAfterMenu" />
                <DropdownMenuSeparator class="my-1 h-px bg-line" />
                <MenuRow label="Cut" shortcut="mod+x" @select="app.copyKeys(true)" />
                <MenuRow label="Copy" shortcut="mod+c" @select="app.copyKeys()" />
                <MenuRow
                  label="Paste"
                  shortcut="mod+v"
                  :disabled="!editor.canPaste.value"
                  @select="editor.paste()" />
                <MenuRow label="Duplicate" :icon="IconNucleoCopy" shortcut="mod+d" @select="editor.duplicateSelected()" />
                <DropdownMenuSeparator class="my-1 h-px bg-line" />
                <MenuRow
                  label="Rotate clockwise"
                  :icon="IconNucleoArrowRotateClockwise"
                  shortcut="r"
                  @select="editor.rotateSelected(15)" />
                <MenuRow
                  label="Rotate counterclockwise"
                  :icon="IconNucleoArrowRotateAnticlockwise"
                  shortcut="shift+r"
                  @select="editor.rotateSelected(-15)" />
                <DropdownMenuSeparator class="my-1 h-px bg-line" />
                <MenuRow
                  label="Delete"
                  :icon="IconNucleoTrash"
                  shortcut="delete"
                  destructive
                  @select="editor.deleteSelected()" />
              </template>
              <template v-else>
                <MenuRow label="Add key" :icon="IconNucleoPlus" shortcut="n" @select="editor.addKey()" />
                <MenuRow
                  label="Paste"
                  shortcut="mod+v"
                  :disabled="!editor.canPaste.value"
                  @select="editor.paste()" />
                <MenuRow
                  label="Select all"
                  :icon="IconNucleoSquareDashed2"
                  shortcut="mod+a"
                  :disabled="!layout.keys.length"
                  @select="editor.selectAll()" />
                <DropdownMenuSeparator class="my-1 h-px bg-line" />
                <MenuRow label="Zoom to fit" :icon="IconNucleoExpand" shortcut="mod+0" @select="zoom = 'fit'" />
              </template>
            </ContextMenuContent>
          </ContextMenu>

          <div v-if="!layout.keys.length" class="pointer-events-none absolute inset-0 flex flex-col">
            <div class="my-auto px-6 pb-16">
              <EmptyState
                title="No keys yet"
                description="Add a key to start. Templates and KLE JSON files open in a tab of their own.">
                <template #icon><IconKeyboard :size="24" /></template>
                <template #action>
                  <div class="pointer-events-auto flex gap-2">
                    <Button variant="secondary" @click="editor.addKey()">Add key</Button>
                    <Button variant="secondary" @click="app.pickFiles()">Open…</Button>
                  </div>
                </template>
              </EmptyState>
            </div>
          </div>

          <ZoomControl
            v-if="layout.keys.length"
            class="absolute bottom-4 right-4 z-floating"
            :zoom="zoom"
            :scale="app.stageScale.value"
            @zoom="zoom = $event" />
        </div>
      </section>

      <aside
        v-if="!app.inspectorHidden.value"
        :class="[INSPECTOR_PANE, !selectedIds.length && INSPECTOR_IDLE]"
        aria-label="Inspector">
        <EditorInspector
          ref="inspector"
          :layout="layout"
          :selected="selectedKeys"
          @update="updateKeys"
          @legend="(index, text) => editor.updateLegend(index, text)"
          @defaults="defaults"
          @meta="(patch) => editor.updateMeta(patch)" />
      </aside>
    </div>
  </div>
</template>
