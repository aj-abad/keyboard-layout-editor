<script setup lang="ts">
import { computed } from 'vue'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import type { Key, Layout } from '../utils/layout'

const props = defineProps<{ selected: Key[]; layout: Layout }>()
const emit = defineEmits<{
  update: [patch: Partial<Key>]
  legend: [index: number, text: string]
  defaults: [property: 'textColor' | 'textSize', value: string | number]
  meta: [patch: Record<string, string>]
}>()
const first = computed(() => props.selected[0])
const positions = ['Top left', 'Top center', 'Top right', 'Center left', 'Center', 'Center right', 'Bottom left', 'Bottom center', 'Bottom right', 'Front left', 'Front center', 'Front right']
const geometry = [
  { field: 'x', label: 'X', step: .25 }, { field: 'y', label: 'Y', step: .25 },
  { field: 'width', label: 'Width', step: .25, min: .25 }, { field: 'height', label: 'Height', step: .25, min: .25 },
  { field: 'rotation_angle', label: 'Angle (°)', step: 1 },
  { field: 'rotation_x', label: 'Origin X', step: .25 }, { field: 'rotation_y', label: 'Origin Y', step: .25 },
] as const
const secondary = [
  { field: 'x2', label: 'Offset X' }, { field: 'y2', label: 'Offset Y' },
  { field: 'width2', label: 'Width', min: .25 }, { field: 'height2', label: 'Height', min: .25 },
] as const
const flags = [
  { field: 'nub', label: 'Homing marker' }, { field: 'ghost', label: 'Ghost key' },
  { field: 'stepped', label: 'Stepped key' }, { field: 'decal', label: 'Decal' },
] as const

function value(field: keyof Key) {
  const initial = first.value?.[field]
  return props.selected.every(key => key[field] === initial) ? initial : ''
}
function numberChange(field: keyof Key, event: Event) {
  const input = event.target as HTMLInputElement
  const next = input.valueAsNumber
  if (input.value && Number.isFinite(next) && input.checkValidity()) emit('update', { [field]: next })
  else input.value = String(value(field) ?? '')
}
function text(event: Event) { return (event.target as HTMLInputElement).value }
function legendValue(index: number) {
  const initial = first.value?.labels[index] ?? ''
  return props.selected.every(key => (key.labels[index] ?? '') === initial) ? initial : ''
}
function legendSize() {
  const initial = first.value?.default.textSize
  return props.selected.every(key => key.default.textSize === initial) ? initial : ''
}
function legendSizeChange(event: Event) {
  const input = event.target as HTMLInputElement
  const size = input.valueAsNumber
  if (input.value && Number.isFinite(size) && input.checkValidity()) emit('defaults', 'textSize', size)
  else input.value = String(legendSize() ?? '')
}
</script>

<template>
  <TabsRoot default-value="keys" class="min-w-0">
    <TabsList class="flex border-b border-stone-200" aria-label="Inspector">
      <TabsTrigger class="tab" value="keys">Key properties</TabsTrigger>
      <TabsTrigger class="tab" value="layout">Layout</TabsTrigger>
    </TabsList>
    <TabsContent value="keys" class="p-5">
      <p v-if="!selected.length" class="py-8 text-center text-sm leading-6 text-stone-500">Select a key to edit its legends, shape, and color.<br>Shift-click to select multiple keys.</p>
      <div v-else class="space-y-6">
        <p class="text-xs text-stone-500">{{ selected.length }} {{ selected.length === 1 ? 'key' : 'keys' }} selected. Changes apply to all selected keys.</p>
        <section>
          <h2 class="section-label">Legends</h2>
          <div class="grid grid-cols-3 gap-2">
            <label v-for="(position, index) in positions" :key="position" class="field-label">
              <span class="truncate text-[10px]">{{ position }}</span>
              <input class="field px-2" :aria-label="`${position} legend`" :value="legendValue(index)" :placeholder="selected.length > 1 ? 'Mixed' : ''" @change="emit('legend', index, text($event))">
            </label>
          </div>
        </section>
        <section>
          <h2 class="section-label">Appearance</h2>
          <div class="grid grid-cols-2 gap-3">
            <label class="field-label">Key color<input type="color" class="field h-10 p-1" :value="String(first?.color ?? '#cccccc')" @change="emit('update', { color: text($event) })"></label>
            <label class="field-label">Legend color<input type="color" class="field h-10 p-1" :value="first?.default.textColor ?? '#000000'" @change="emit('defaults', 'textColor', text($event))"></label>
            <label class="field-label">Legend size<input type="number" class="field" min="1" max="9" step="1" :value="legendSize()" placeholder="Mixed" @change="legendSizeChange"></label>
            <label class="field-label">Profile<select class="field" :value="value('profile')" @change="emit('update', { profile: text($event) })"><option value="">Default</option><option v-for="profile in ['DCS', 'DSA', 'SA', 'OEM', 'CHICKLET', 'FLAT']" :key="profile">{{ profile }}</option></select></label>
          </div>
        </section>
        <section>
          <h2 class="section-label">Geometry · units</h2>
          <div class="grid grid-cols-2 gap-3">
            <label v-for="control in geometry" :key="control.field" class="field-label">
              {{ control.label }}<input class="field" type="number" :step="control.step" :min="'min' in control ? control.min : undefined" :value="value(control.field)" placeholder="Mixed" @change="numberChange(control.field, $event)">
            </label>
          </div>
          <details class="mt-4 text-xs text-stone-600">
            <summary class="cursor-pointer py-1">Secondary shape (ISO / stepped keys)</summary>
            <div class="mt-3 grid grid-cols-2 gap-3">
              <label v-for="control in secondary" :key="control.field" class="field-label">{{ control.label }}<input class="field" type="number" step=".25" :min="'min' in control ? control.min : undefined" :value="value(control.field)" @change="numberChange(control.field, $event)"></label>
            </div>
          </details>
        </section>
        <section class="grid grid-cols-2 gap-3 border-t border-stone-200 pt-4">
          <label v-for="flag in flags" :key="flag.field" class="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" class="size-4 accent-emerald-800" :checked="Boolean(value(flag.field))" @change="emit('update', { [flag.field]: ($event.target as HTMLInputElement).checked })">{{ flag.label }}</label>
        </section>
      </div>
    </TabsContent>
    <TabsContent value="layout" class="space-y-5 p-5">
      <label class="field-label">Name<input class="field" :value="layout.meta.name ?? ''" placeholder="Untitled layout" @change="emit('meta', { name: text($event) })"></label>
      <label class="field-label">Author<input class="field" :value="layout.meta.author ?? ''" @change="emit('meta', { author: text($event) })"></label>
      <label class="field-label">Background<input type="color" class="field h-10 p-1" :value="layout.meta.backcolor ?? '#eeeeee'" @change="emit('meta', { backcolor: text($event) })"></label>
      <label class="field-label">Notes<textarea class="field min-h-36 resize-y" :value="layout.meta.notes ?? ''" @change="emit('meta', { notes: text($event) })" /></label>
      <p class="text-xs leading-5 text-stone-500">Layouts save in this browser automatically. Export JSON to keep a portable copy.</p>
    </TabsContent>
  </TabsRoot>
</template>
