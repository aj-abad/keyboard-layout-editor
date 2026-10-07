<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import type { Key, Layout } from '../utils/layout'
import { keyResizeBounds, resizeCursor, resizeKeyGeometry } from '../utils/resize'
import type { KeyGeometryPatch, ResizeEdge } from '../utils/resize'
import { canvasFrame, keyGeometry, keyIntersectsRect, safeColor, SYSTEM_FONT, UNIT } from '../utils/svg'

const { layout, selectedIds, zoom = 1 } = defineProps<{
  layout: Layout
  selectedIds: string[]
  zoom?: number
}>()
const emit = defineEmits<{
  select: [id: string, additive: boolean]
  clear: []
  move: [dx: number, dy: number]
  resize: [id: string, geometry: KeyGeometryPatch]
  marquee: [ids: string[], additive: boolean]
}>()

const svg = useTemplateRef<SVGSVGElement>('canvas')
const viewport = useTemplateRef<HTMLDivElement>('viewport')
const viewportWidth = ref(0)
let observer: ResizeObserver | undefined
const prefix = useId().replace(/:/g, '')
const lockedFrame = ref<ReturnType<typeof canvasFrame> | null>(null)
const lockedWidth = ref<number | null>(null)
const frame = computed(() => lockedFrame.value ?? canvasFrame(layout))
const displayWidth = computed(() => lockedWidth.value ?? Math.min(frame.value.width, viewportWidth.value || frame.value.width) * zoom)
const viewBox = computed(() => `${frame.value.x} ${frame.value.y} ${frame.value.width} ${frame.value.height}`)
const resizing = ref<{ id: string; geometry: KeyGeometryPatch } | null>(null)
const keys = computed(() => layout.keys.map(original => {
  const key = resizing.value?.id === original.id ? { ...original, ...resizing.value.geometry } : original
  return { key, shape: keyGeometry(key), handles: resizeHandles(key) }
}))
const selection = computed(() => new Set(selectedIds))
const preview = ref({ dx: 0, dy: 0 })
const marquee = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const movingIds = ref<string[]>([])
let gesture: {
  pointerId: number
  kind: 'move' | 'marquee' | 'resize'
  start: { x: number; y: number }
  clientX: number
  clientY: number
  additive: boolean
  moved: boolean
  matrix: DOMMatrix
  original?: Key
  edge?: ResizeEdge
} | null = null

function point(event: PointerEvent) {
  const matrix = gesture?.matrix ?? svg.value?.getScreenCTM()?.inverse()
  if (!matrix || !svg.value) return null
  const position = svg.value.createSVGPoint()
  position.x = event.clientX
  position.y = event.clientY
  return position.matrixTransform(matrix)
}

function additive(event: MouseEvent | KeyboardEvent) {
  return event.shiftKey || event.ctrlKey || event.metaKey
}

function blurInspector() {
  // Commit an inspector control's native change while its original selection is active.
  const active = document.activeElement
  if (active instanceof HTMLElement && active.matches('input, textarea, select, [contenteditable="true"]')) active.blur()
}

function capture(event: PointerEvent) {
  if (!svg.value) return null
  const matrix = svg.value.getScreenCTM()?.inverse()
  if (!matrix) return null
  lockedFrame.value = { ...frame.value }
  lockedWidth.value = displayWidth.value
  svg.value.setPointerCapture(event.pointerId)
  return matrix
}

function begin(event: PointerEvent, id?: string) {
  if (event.button !== 0 || gesture) return
  blurInspector()
  const start = point(event)
  if (!start || !svg.value) return
  event.preventDefault()
  const adding = additive(event)
  if (id) {
    const alreadySelected = selection.value.has(id)
    const element = (event.target as Element).closest<SVGGElement>('[data-key-id]')
    element?.focus({ preventScroll: true })
    if (adding || !alreadySelected) emit('select', id, adding)
    // A modifier click on a selected key deselects it without starting a drag.
    if (adding && alreadySelected) return
    movingIds.value = alreadySelected ? [...selectedIds] : adding ? [...selectedIds, id] : [id]
  }
  const matrix = capture(event)
  if (!matrix) return
  gesture = { pointerId: event.pointerId, kind: id ? 'move' : 'marquee', start, clientX: event.clientX, clientY: event.clientY, additive: adding, moved: false, matrix }
}

function beginResize(event: PointerEvent, id: string, edge: ResizeEdge) {
  if (event.button !== 0 || gesture) return
  blurInspector()
  const original = layout.keys.find(key => key.id === id)
  const start = point(event)
  if (!original || !start || !svg.value) return
  event.preventDefault()
  Array.from(svg.value.querySelectorAll<SVGGElement>('[data-key-id]')).find(element => element.dataset.keyId === id)?.focus({ preventScroll: true })
  const matrix = capture(event)
  if (!matrix) return
  gesture = { pointerId: event.pointerId, kind: 'resize', start, clientX: event.clientX, clientY: event.clientY, additive: false, moved: false, matrix, original: structuredClone(original), edge }
}

function update(event: PointerEvent) {
  if (!gesture || gesture.pointerId !== event.pointerId) return
  const current = point(event)
  if (!current) return
  gesture.moved ||= Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) >= 3
  if (!gesture.moved) return
  if (gesture.kind === 'move') {
    preview.value = { dx: Math.round((current.x - gesture.start.x) / UNIT * 4) / 4, dy: Math.round((current.y - gesture.start.y) / UNIT * 4) / 4 }
  } else if (gesture.kind === 'resize' && gesture.original && gesture.edge) {
    resizing.value = { id: gesture.original.id, geometry: resizeKeyGeometry(gesture.original, gesture.edge, (current.x - gesture.start.x) / UNIT, (current.y - gesture.start.y) / UNIT) }
  } else {
    marquee.value = { x: Math.min(gesture.start.x, current.x), y: Math.min(gesture.start.y, current.y), width: Math.abs(current.x - gesture.start.x), height: Math.abs(current.y - gesture.start.y) }
  }
}

function resetGesture() {
  const pointerId = gesture?.pointerId
  gesture = null
  preview.value = { dx: 0, dy: 0 }
  movingIds.value = []
  resizing.value = null
  marquee.value = null
  lockedFrame.value = null
  lockedWidth.value = null
  if (pointerId !== undefined && svg.value?.hasPointerCapture(pointerId)) svg.value.releasePointerCapture(pointerId)
}

function cancelWithEscape(event: KeyboardEvent) {
  if (!gesture) return
  event.preventDefault()
  event.stopPropagation()
  resetGesture()
}

function finish(event: PointerEvent) {
  if (!gesture || gesture.pointerId !== event.pointerId) return
  update(event)
  if (gesture.kind === 'move') {
    const { dx, dy } = preview.value
    if (dx || dy) emit('move', dx, dy)
  } else if (gesture.kind === 'resize') {
    if (resizing.value) emit('resize', resizing.value.id, resizing.value.geometry)
  } else if (marquee.value) {
    const box = marquee.value
    const ids = layout.keys.filter(key => keyIntersectsRect(key, box)).map(key => key.id)
    emit('marquee', ids, gesture.additive)
  } else if (!gesture.additive) emit('clear')
  resetGesture()
}

function resizeHandles(key: Key) {
  const box = keyResizeBounds(key)
  const left = box.x * UNIT, right = (box.x + box.width) * UNIT
  const top = box.y * UNIT, bottom = (box.y + box.height) * UNIT
  const centerX = (left + right) / 2, centerY = (top + bottom) / 2
  const hitSize = Math.min(6, box.width * UNIT / 5, box.height * UNIT / 5)
  const hitStrokeWidth = Math.min(10, Math.min(box.width, box.height) * UNIT * displayWidth.value / frame.value.width / 3)
  const handles = [
    { edge: 'left', x1: left, y1: top, x2: left, y2: bottom, x: left, y: centerY },
    { edge: 'right', x1: right, y1: top, x2: right, y2: bottom, x: right, y: centerY },
    { edge: 'top', x1: left, y1: top, x2: right, y2: top, x: centerX, y: top },
    { edge: 'bottom', x1: left, y1: bottom, x2: right, y2: bottom, x: centerX, y: bottom },
    { edge: 'top-left', x1: left, y1: top, x2: left, y2: top, x: left, y: top },
    { edge: 'top-right', x1: right, y1: top, x2: right, y2: top, x: right, y: top },
    { edge: 'bottom-left', x1: left, y1: bottom, x2: left, y2: bottom, x: left, y: bottom },
    { edge: 'bottom-right', x1: right, y1: bottom, x2: right, y2: bottom, x: right, y: bottom },
  ] satisfies { edge: ResizeEdge; x1: number; y1: number; x2: number; y2: number; x: number; y: number }[]
  return handles.map(handle => ({ ...handle, hitSize, hitStrokeWidth }))
}

function keyLabel(key: Layout['keys'][number]) {
  return `${key.labels.filter(Boolean).join(', ') || 'Blank key'}, ${key.width} by ${key.height} units`
}

function keyboardSelect(event: KeyboardEvent, id: string) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  emit('select', id, additive(event))
}

watch(() => selectedIds, ids => {
  if (gesture?.kind === 'move' && (ids.length !== movingIds.value.length || ids.some(id => !movingIds.value.includes(id)))) resetGesture()
  if (gesture?.kind === 'resize') resetGesture()
})
watch(() => layout, () => { if (gesture) resetGesture() })
watch(() => zoom, () => { if (gesture) resetGesture() })
onMounted(() => {
  if (!viewport.value) return
  viewportWidth.value = viewport.value.clientWidth
  observer = new ResizeObserver(entries => { viewportWidth.value = entries[0]?.contentRect.width || 0 })
  observer.observe(viewport.value)
})
onBeforeUnmount(() => { resetGesture(); observer?.disconnect() })
</script>

<template>
  <div ref="viewport" class="keyboard-canvas relative min-h-80 overflow-auto rounded-xl border border-zinc-200" :style="{ backgroundColor: safeColor(layout.meta.backcolor, '#f4f4f5') }">
    <svg
      ref="canvas"
      :viewBox="viewBox"
      :width="displayWidth"
      :height="frame.height * displayWidth / frame.width"
      :font-family="SYSTEM_FONT"
      role="group"
      aria-label="Keyboard layout. Select a key, drag its center to move, or drag its edges to resize. Shift or Control selects multiple keys. Use the inspector to change dimensions with the keyboard."
      tabindex="0"
      class="block outline-none"
      style="height: auto; touch-action: none; user-select: none"
      @pointerdown="begin($event)"
      @pointermove="update"
      @pointerup="finish"
      @pointercancel="resetGesture"
      @lostpointercapture="resetGesture"
      @keydown.esc="cancelWithEscape"
    >
      <rect :x="frame.x" :y="frame.y" :width="frame.width" :height="frame.height" :fill="safeColor(layout.meta.backcolor, '#f4f4f5')" />
      <g
        v-for="({ key, shape }, index) in keys"
        :key="key.id"
        :data-key-id="key.id"
        :transform="movingIds.includes(key.id) ? `translate(${preview.dx * UNIT} ${preview.dy * UNIT})` : undefined"
        :aria-label="keyLabel(key)"
        :aria-pressed="selection.has(key.id)"
        tabindex="0"
        role="button"
        class="keycap cursor-grab outline-none active:cursor-grabbing"
        @pointerdown.stop="begin($event, key.id)"
        @keydown="keyboardSelect($event, key.id)"
      >
        <g :transform="shape.transform">
          <defs>
            <clipPath :id="`${prefix}-legend-${index}`"><path :d="shape.hit" /></clipPath>
          </defs>
          <path :d="shape.hit" fill="transparent" />
          <g :opacity="key.ghost ? 0.45 : 1" pointer-events="none">
            <path v-if="!key.decal" :d="shape.outer" :fill="shape.color" stroke="#52525b" stroke-width="1" :stroke-dasharray="key.ghost ? '3 3' : undefined" />
            <path v-if="!key.decal && !key.ghost" :d="shape.inner" :fill="shape.topColor" stroke="#00000020" stroke-width="0.8" />
            <g :clip-path="`url(#${prefix}-legend-${index})`">
              <text v-for="label in shape.labels" :key="label.slot" :x="label.x" :y="label.y" :text-anchor="label.anchor" :font-size="label.size" :fill="label.color">
                <tspan v-for="(line, lineIndex) in label.lines" :key="lineIndex" :x="label.x" :dy="lineIndex ? label.size : 0">{{ line }}</tspan>
              </text>
              <line v-if="key.nub && !key.ghost && !key.decal" :x1="shape.nub.x1" :x2="shape.nub.x2" :y1="shape.nub.y" :y2="shape.nub.y" stroke="#00000040" stroke-width="2" stroke-linecap="round" />
            </g>
          </g>
          <path :d="shape.outer" fill="none" :stroke="selection.has(key.id) ? '#2563eb' : 'transparent'" stroke-width="2.5" pointer-events="none" class="selection-outline" />
        </g>
      </g>
      <g v-for="{ key, shape, handles } in keys.filter(item => selection.has(item.key.id))" :key="`resize-${key.id}`" :transform="`${movingIds.includes(key.id) ? `translate(${preview.dx * UNIT} ${preview.dy * UNIT}) ` : ''}${shape.transform}`" :data-resize-key-id="key.id" aria-hidden="true">
        <g
          v-for="handle in handles"
          :key="handle.edge"
          :data-resize-edge="handle.edge"
          :style="{ cursor: resizeCursor(handle.edge, key.rotation_angle) }"
          @pointerdown.stop="beginResize($event, key.id, handle.edge)"
        >
          <line :x1="handle.x1" :y1="handle.y1" :x2="handle.x2" :y2="handle.y2" stroke="transparent" :stroke-width="handle.hitStrokeWidth" vector-effect="non-scaling-stroke" />
          <rect :x="handle.x - handle.hitSize" :y="handle.y - handle.hitSize" :width="handle.hitSize * 2" :height="handle.hitSize * 2" fill="transparent" />
          <rect :x="handle.x - 2.5" :y="handle.y - 2.5" width="5" height="5" rx="1" fill="white" stroke="#2563eb" stroke-width="1.5" pointer-events="none" vector-effect="non-scaling-stroke" />
        </g>
      </g>
      <rect v-if="marquee" :x="marquee.x" :y="marquee.y" :width="marquee.width" :height="marquee.height" fill="#2563eb1a" stroke="#2563eb" stroke-dasharray="4 3" pointer-events="none" />
    </svg>
    <p v-if="!layout.keys.length" class="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm text-zinc-500">Add a key to start your layout.</p>
  </div>
</template>

<style scoped>
.keycap:focus-visible .selection-outline { stroke: #2563eb; stroke-dasharray: 4 2; }
</style>
