<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose, DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from 'reka-ui'
import presets from './data/layouts.json'
import { useEditor } from './composables/useEditor'
import { layoutBounds, stringifyLayout } from './utils/layout'
import { layoutToSvg } from './utils/svg'
import type { Key } from './utils/layout'

const editor = useEditor()
const { layout, selectedIds, selectedKeys, canUndo, canRedo, storageError } = editor
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const zoom = ref(1)
const modalOpen = ref(false)
const modal = ref<'json' | 'help'>('json')
const raw = ref('')
const rawError = ref('')
const error = ref('')
const notice = ref('')
const dimensions = computed(() => layoutBounds(layout.value))
let noticeTimer: ReturnType<typeof setTimeout> | undefined

function notify(message: string) {
  notice.value = message
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 3500)
}
function fail(reason: unknown) { error.value = reason instanceof Error ? reason.message : String(reason) }
function download(content: BlobPart, extension: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${String(layout.value.meta.name || 'keyboard-layout').replace(/[^a-z\d _-]/gi, '').trim() || 'keyboard-layout'}.${extension}`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function exportJson() { download(stringifyLayout(layout.value), 'json', 'application/json'); notify('JSON exported') }
async function exportPng() {
  const url = URL.createObjectURL(new Blob([layoutToSvg(layout.value)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    const scale = Math.min(2, 8192 / Math.max(image.width, image.height))
    canvas.width = Math.ceil(image.width * scale)
    canvas.height = Math.ceil(image.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image export is unavailable in this browser.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not export the image.')), 'image/png'))
    download(blob, 'png', 'image/png')
    notify('PNG exported')
  } catch (reason) { fail(reason) }
  finally { URL.revokeObjectURL(url) }
}
async function openFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Please choose a JSON layout smaller than 5 MB.')
    editor.importLayout(await file.text())
    error.value = ''
    notify('Layout imported')
  } catch (reason) { fail(reason) }
  finally { input.value = '' }
}
function openModal(mode: 'json' | 'help') {
  modal.value = mode
  raw.value = stringifyLayout(layout.value)
  rawError.value = ''
  modalOpen.value = true
}
function applyJson() {
  try { editor.importLayout(raw.value); rawError.value = ''; modalOpen.value = false; notify('JSON applied') }
  catch (reason) { rawError.value = reason instanceof Error ? reason.message : String(reason) }
}
function defaults(property: 'textColor' | 'textSize', value: string | number) {
  if (property === 'textSize' && (!Number.isFinite(value) || Number(value) < 1 || Number(value) > 9)) return
  if (property === 'textColor') editor.setTextColor(String(value))
  else editor.setTextSize(Number(value))
}
function marquee(ids: string[], additive: boolean) { editor.selectIds(ids, additive) }
function updateKeys(patch: Partial<Key>) { editor.updateKeys(patch) }

function shortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (modalOpen.value || target.closest('input, textarea, select, [contenteditable=true], [role=menu], [role=dialog]')) return
  const command = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  let action: (() => void) | undefined
  if (command) {
    const actions: Record<string, () => void> = { a: editor.selectAll, c: editor.copy, x: editor.cut, v: editor.paste, d: editor.duplicateSelected, s: exportJson }
    action = key === 'z' ? (event.shiftKey ? editor.redo : editor.undo) : key === 'y' ? editor.redo : actions[key]
  } else if (key === 'delete' || key === 'backspace') action = editor.deleteSelected
  else if (key === 'escape') action = editor.clearSelection
  else if (key === 'insert') action = editor.addKey
  else if (key === '?') action = () => openModal('help')
  else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
    const step = event.shiftKey ? 1 : .25
    action = () => editor.moveSelected(key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0, key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0)
  }
  if (action) { event.preventDefault(); action() }
}
onMounted(() => window.addEventListener('keydown', shortcut))
onBeforeUnmount(() => { window.removeEventListener('keydown', shortcut); clearTimeout(noticeTimer) })
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4 sm:px-8">
      <div class="flex items-center gap-3">
        <MaterialIcon name="keyboard" class="size-9 text-emerald-900" />
        <div><h1 class="text-base font-semibold tracking-tight">Keyboard Layout Editor</h1><p class="text-xs text-stone-500">Personal workspace</p></div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DropdownMenuRoot>
          <DropdownMenuTrigger class="btn">New / preset <MaterialIcon name="expand-more" /></DropdownMenuTrigger>
          <DropdownMenuPortal><DropdownMenuContent class="menu-content" :side-offset="6" align="end">
            <DropdownMenuItem v-for="preset in presets.presets" :key="preset.name" class="menu-item" @select="editor.loadPreset(preset.data, preset.name)">{{ preset.name }}</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenuPortal>
        </DropdownMenuRoot>
        <button class="btn" @click="fileInput?.click()">Open JSON</button>
        <input ref="fileInput" class="hidden" type="file" accept=".json,application/json,text/plain" aria-label="Open layout file" @change="openFile">
        <DropdownMenuRoot>
          <DropdownMenuTrigger class="btn btn-primary">Export <MaterialIcon name="expand-more" /></DropdownMenuTrigger>
          <DropdownMenuPortal><DropdownMenuContent class="menu-content" :side-offset="6" align="end">
            <DropdownMenuItem class="menu-item" @select="exportJson">KLE JSON <span class="text-xs text-stone-400">Ctrl S</span></DropdownMenuItem>
            <DropdownMenuSeparator class="my-1 h-px bg-stone-200" />
            <DropdownMenuItem class="menu-item" @select="download(layoutToSvg(layout), 'svg', 'image/svg+xml')">SVG image</DropdownMenuItem>
            <DropdownMenuItem class="menu-item" @select="exportPng">PNG image</DropdownMenuItem>
          </DropdownMenuContent></DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    </header>

    <div v-if="error || storageError" role="alert" class="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900"><span>{{ error || storageError }}</span><button v-if="error" class="shrink-0 underline" @click="error = ''">Dismiss</button></div>
    <main class="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section class="flex min-w-0 flex-col gap-5 p-5 sm:p-8" aria-label="Layout workspace">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><h2 class="text-xl font-semibold tracking-tight">{{ layout.meta.name || 'Untitled layout' }}</h2><p class="mt-1 text-xs text-stone-500">{{ layout.keys.length }} keys <span class="mx-1.5">·</span> {{ dimensions.width.toFixed(2) }} × {{ dimensions.height.toFixed(2) }} u</p></div>
          <div class="flex items-center gap-1"><button class="btn" :disabled="!canUndo" title="Undo (Ctrl Z)" @click="editor.undo">Undo</button><button class="btn" :disabled="!canRedo" title="Redo (Ctrl Shift Z)" @click="editor.redo">Redo</button></div>
        </div>
        <div class="overflow-hidden rounded-xl border border-stone-300 bg-white">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
            <div class="flex flex-wrap gap-2"><button class="btn" @click="editor.addKey"><MaterialIcon name="add" />Add key</button><button class="btn" :disabled="!selectedIds.length" @click="editor.duplicateSelected">Duplicate</button><button class="btn" :disabled="!selectedIds.length" @click="editor.deleteSelected">Delete</button></div>
            <label class="flex items-center gap-2 text-xs text-stone-500">Zoom<select v-model.number="zoom" class="rounded border border-stone-300 bg-white px-2 py-1.5 text-stone-700"><option :value=".5">50%</option><option :value=".75">75%</option><option :value="1">100%</option><option :value="1.25">125%</option><option :value="1.5">150%</option><option :value="2">200%</option><option :value="3">300%</option><option :value="4">400%</option></select></label>
          </div>
          <div class="min-h-64 overflow-auto p-4 sm:p-6">
            <KeyboardCanvas :layout :selected-ids="selectedIds" :zoom @select="editor.selectKey" @clear="editor.clearSelection" @move="editor.moveSelected" @resize="editor.resizeKey" @marquee="marquee" />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 px-4 py-3 text-xs text-stone-500"><span>{{ selectedIds.length ? `${selectedIds.length} selected · drag edges to resize` : 'Click to select · drag to move · Shift-click for multiple' }}</span><button class="hover:text-stone-900" @click="editor.selectAll">Select all</button></div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500"><span role="status">{{ notice || (storageError ? 'Autosave unavailable' : 'Autosave on · this browser') }}</span><div class="flex gap-4"><button class="underline-offset-4 hover:underline" @click="openModal('json')">Edit raw JSON</button><button class="underline-offset-4 hover:underline" @click="openModal('help')">Shortcuts</button></div></div>
      </section>
      <aside class="border-t border-stone-200 bg-white lg:border-t-0 lg:border-l" aria-label="Layout inspector"><EditorInspector :layout :selected="selectedKeys" @update="updateKeys" @legend="editor.updateLegend" @defaults="defaults" @meta="editor.updateMeta" /></aside>
    </main>
    <footer class="border-t border-stone-200 px-5 py-3 text-[11px] text-stone-400 sm:px-8">Based on Keyboard Layout Editor by Ian Prest.</footer>

    <DialogRoot v-model:open="modalOpen">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-40 bg-stone-950/40" />
        <DialogContent class="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-auto rounded-xl bg-white p-6 shadow-xl">
          <div class="flex items-start justify-between gap-4"><DialogTitle class="text-lg font-semibold">{{ modal === 'json' ? 'Raw layout JSON' : 'Keyboard shortcuts' }}</DialogTitle><DialogClose class="btn px-2 py-1" aria-label="Close dialog"><MaterialIcon name="close" /></DialogClose></div>
          <DialogDescription class="mt-2 text-sm text-stone-500">{{ modal === 'json' ? 'Edit or paste a KLE layout. Apply changes to update the editor.' : 'Use these shortcuts when the canvas is focused. Use Command on macOS.' }}</DialogDescription>
          <template v-if="modal === 'json'">
            <textarea v-model="raw" class="field mt-5 min-h-72 resize-y font-mono text-xs" aria-label="Raw KLE JSON" spellcheck="false" />
            <p v-if="rawError" role="alert" class="mt-3 text-sm text-red-700">{{ rawError }}</p>
            <div class="mt-5 flex justify-end gap-2"><DialogClose class="btn">Cancel</DialogClose><button class="btn btn-primary" @click="applyJson">Apply JSON</button></div>
          </template>
          <dl v-else class="mt-5 grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 text-sm"><dt>Select all</dt><dd>Ctrl A</dd><dt>Copy / cut / paste keys</dt><dd>Ctrl C / X / V</dd><dt>Duplicate selection</dt><dd>Ctrl D</dd><dt>Undo / redo</dt><dd>Ctrl Z / Shift Z</dd><dt>Export JSON</dt><dd>Ctrl S</dd><dt>Move by ¼ unit / 1 unit</dt><dd>Arrows / Shift Arrows</dd><dt>Resize keycaps</dt><dd>Drag selected edges</dd><dt>Add / delete keys</dt><dd>Insert / Delete</dd><dt>Clear selection</dt><dd>Esc</dd><dt>Select multiple keys</dt><dd>Shift-click / drag a box</dd></dl>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
