<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue";
import { useLayoutApp } from "../composables/useLayoutApp";

/**
 * The editor's one way in for files: a hidden `type=file` behind Open… (⌘O or
 * Ctrl+O), and the whole window as a drop target for KLE JSON. Each file opens
 * in a browser tab of its own, in the order it was chosen. Installed as an
 * app, it also takes the JSON files the system opens it with, each in a window
 * of its own.
 */
const app = useLayoutApp();
const input = useTemplateRef<HTMLInputElement>("input");
let depth = 0;

function choose(event: Event) {
  const target = event.target as HTMLInputElement;
  app.openFiles(Array.from(target.files ?? []));
  target.value = "";
}

const carriesFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");
function enter(event: DragEvent) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  depth++;
  app.draggingFiles.value = true;
}
function over(event: DragEvent) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  app.draggingFiles.value = true;
}
function leave(event: DragEvent) {
  if (!carriesFiles(event)) return;
  depth = Math.max(0, depth - 1);
  if (!depth || !event.relatedTarget) app.draggingFiles.value = false;
}
function reset() {
  depth = 0;
  app.draggingFiles.value = false;
}
function drop(event: DragEvent) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  reset();
  app.openFiles(Array.from(event.dataTransfer?.files ?? []));
}

const listeners = [
  ["dragenter", enter],
  ["dragover", over],
  ["dragleave", leave],
  ["drop", drop],
  ["dragend", reset],
] as const;
/** The installed app's files, opened from the system's file manager with “Open with”. */
interface LaunchParams {
  files: readonly { getFile: () => Promise<File> }[];
}
interface LaunchQueue {
  setConsumer: (consumer: (params: LaunchParams) => void) => void;
}

onMounted(() => {
  app.filePicker.value = { open: () => input.value?.click() };
  for (const [type, listener] of listeners) window.addEventListener(type, listener, true);
  window.addEventListener("blur", reset);
  const queue = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
  queue?.setConsumer(async ({ files }) => {
    if (files.length) app.openLaunched(await Promise.all(files.map((handle) => handle.getFile())));
  });
});
onBeforeUnmount(() => {
  app.filePicker.value = null;
  for (const [type, listener] of listeners) window.removeEventListener(type, listener, true);
  window.removeEventListener("blur", reset);
});
</script>

<template>
  <input
    ref="input"
    type="file"
    accept=".json,.json5,application/json,text/plain"
    multiple
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
    @change="choose" />
</template>
