import { computed, shallowRef } from 'vue'
import presets from '../data/layouts.json'
import { createKey, deserialize, layoutBounds, parseLayout, stringifyLayout } from '../utils/layout'
import type { Key, Layout, LayoutMetadata } from '../utils/layout'
import type { KeyGeometryPatch } from '../utils/resize'

export const DRAFT_STORAGE_KEY = 'kle-personal-draft-v1'

type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>
interface EditorOptions {
  initialLayout?: Layout
  storage?: DraftStorage | null
  historyLimit?: number
  baseline?: string
}
interface Snapshot { layout: Layout; selectedIds: string[] }

const clone = <T>(value: T): T => structuredClone(value)
const round = (value: number) => Math.round(value * 1e6) / 1e6

/** Where the copied keys are kept as KLE JSON, so every tab of this browser can paste them. */
export const CLIPBOARD_STORAGE_KEY = 'kle-clipboard-v1'

function storedClipboard(): Key[] {
  try {
    const text = typeof window === 'undefined' ? null : window.localStorage.getItem(CLIPBOARD_STORAGE_KEY)
    return text ? parseLayout(text).keys : []
  } catch { return [] }
}

/**
 * One clipboard for every open layout, as a native app has: keys copied in one
 * layout's tab paste into another's. Each paste steps a quarter unit further along.
 */
const sharedClipboard = { keys: shallowRef<Key[]>(storedClipboard()), pastes: 0 }
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== CLIPBOARD_STORAGE_KEY) return
    sharedClipboard.keys.value = storedClipboard()
    sharedClipboard.pastes = 0
  })
}

/** One local editor instance. Every edit stores a complete, bounded undo snapshot. */
export function useEditor(options: EditorOptions = {}) {
  const preset = presets.presets.find(item => item.name === 'Default 60%') ?? presets.presets[1]!
  const initial = options.initialLayout ? clone(options.initialLayout) : deserialize(preset.data)
  if (!options.initialLayout && !initial.meta.name) initial.meta.name = preset.name
  const currentLayout = shallowRef<Layout>(initial)
  const baseline = shallowRef(options.baseline ?? stringifyLayout(initial, 0))
  const currentSelection = shallowRef<string[]>([])
  const past = shallowRef<Snapshot[]>([])
  const future = shallowRef<Snapshot[]>([])
  const clipboard = sharedClipboard.keys
  const storageError = shallowRef('')
  const historyLimit = Math.max(1, Math.floor(options.historyLimit ?? 100))
  let storage: DraftStorage | null = null

  const layout = computed(() => currentLayout.value)
  const isDirty = computed(() => stringifyLayout(currentLayout.value, 0) !== baseline.value)
  const selectedIds = computed(() => currentSelection.value)
  const selectedKeys = computed(() => {
    const selection = new Set(currentSelection.value)
    return currentLayout.value.keys.filter(key => selection.has(key.id))
  })
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const canPaste = computed(() => clipboard.value.length > 0)

  // Storage access itself can throw in private browsing or restricted environments.
  try {
    storage = options.storage !== undefined ? options.storage : typeof window !== 'undefined' ? window.localStorage : null
    const saved = storage?.getItem(DRAFT_STORAGE_KEY)
    if (saved) currentLayout.value = parseLayout(saved)
  } catch {
    storageError.value = 'Couldn’t restore the layouts this browser saved. Export JSON to keep a copy.'
  }

  function saveDraft() {
    if (!storage) return
    try {
      storage.setItem(DRAFT_STORAGE_KEY, stringifyLayout(currentLayout.value))
      storageError.value = ''
    } catch {
      storageError.value = 'Couldn’t autosave in this browser. Export JSON to keep a copy.'
    }
  }
  function snapshot(): Snapshot {
    return { layout: clone(currentLayout.value), selectedIds: [...currentSelection.value] }
  }
  function retainSelection(ids: string[], next = currentLayout.value) {
    const valid = new Set(next.keys.map(key => key.id))
    return [...new Set(ids)].filter(id => valid.has(id))
  }
  function commit(next: Layout, selection = currentSelection.value) {
    if (JSON.stringify(next) === JSON.stringify(currentLayout.value)) return
    past.value = [...past.value, snapshot()].slice(-historyLimit)
    future.value = []
    currentLayout.value = next
    currentSelection.value = retainSelection(selection, next)
    saveDraft()
  }
  function editSelection(edit: (key: Key) => void) {
    if (!currentSelection.value.length) return
    const ids = new Set(currentSelection.value)
    const next = clone(currentLayout.value)
    next.keys.filter(key => ids.has(key.id)).forEach(edit)
    commit(next)
  }
  function undo() {
    const previous = past.value.at(-1)
    if (!previous) return
    future.value = [...future.value, snapshot()]
    past.value = past.value.slice(0, -1)
    currentLayout.value = previous.layout
    currentSelection.value = previous.selectedIds
    saveDraft()
  }
  function redo() {
    const next = future.value.at(-1)
    if (!next) return
    past.value = [...past.value, snapshot()].slice(-historyLimit)
    future.value = future.value.slice(0, -1)
    currentLayout.value = next.layout
    currentSelection.value = next.selectedIds
    saveDraft()
  }
  function loadPreset(data: unknown, name?: string) {
    const next = deserialize(data)
    if (name && !next.meta.name) next.meta.name = name
    commit(next, [])
  }
  function importLayout(text: string) { commit(parseLayout(text), []) }
  /** Apply a layout already validated by the background parser. */
  function applyLayout(next: Layout) { commit(clone(next), []) }
  function markClean() { baseline.value = stringifyLayout(currentLayout.value, 0) }
  function replaceLayout(next: Layout) { applyLayout(next); markClean() }
  function selectKey(id: string, additive = false) {
    if (!currentLayout.value.keys.some(key => key.id === id)) return
    currentSelection.value = additive
      ? currentSelection.value.includes(id) ? currentSelection.value.filter(item => item !== id) : [...currentSelection.value, id]
      : [id]
  }
  function selectIds(ids: string[], additive = false) {
    currentSelection.value = retainSelection(additive ? [...currentSelection.value, ...ids] : ids)
  }
  function clearSelection() { currentSelection.value = [] }
  function selectAll() { currentSelection.value = currentLayout.value.keys.map(key => key.id) }

  function addKey() {
    const reference = selectedKeys.value.at(-1)
    const bounds = layoutBounds(currentLayout.value)
    const key = createKey(reference ? {
      x: reference.x + Math.max(reference.width, reference.x2 + reference.width2), y: reference.y,
      color: reference.color, profile: reference.profile, default: clone(reference.default),
      rotation_angle: reference.rotation_angle, rotation_x: reference.rotation_x, rotation_y: reference.rotation_y,
    } : { x: 0, y: currentLayout.value.keys.length ? Math.ceil(bounds.y + bounds.height) : 0 })
    const next = clone(currentLayout.value)
    next.keys.push(key)
    commit(next, [key.id])
  }
  function deleteSelected() {
    const ids = new Set(currentSelection.value)
    if (!ids.size) return
    const next = clone(currentLayout.value)
    next.keys = next.keys.filter(key => !ids.has(key.id))
    commit(next, [])
  }
  /** Convert movement on the canvas to each key's local rotated coordinates. */
  function translate(key: Key, dx: number, dy: number) {
    const angle = key.rotation_angle * Math.PI / 180
    key.x = round(key.x + dx * Math.cos(angle) + dy * Math.sin(angle))
    key.y = round(key.y - dx * Math.sin(angle) + dy * Math.cos(angle))
  }
  function moveSelected(dx: number, dy: number) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return
    editSelection(key => translate(key, dx, dy))
  }
  function insertCopies(keys: Key[], dx: number, dy: number) {
    if (!keys.length) return
    const copies = keys.map(source => {
      const properties = clone(source)
      delete (properties as Partial<Key>).id
      const key = createKey(properties)
      translate(key, dx, dy)
      return key
    })
    const next = clone(currentLayout.value)
    next.keys.push(...copies)
    commit(next, copies.map(key => key.id))
  }
  function duplicateSelected() { insertCopies(selectedKeys.value, .25, .25) }
  /** Alt-drag inserts copies only on a displaced drop, keeping the originals intact. */
  function duplicateDragged(ids: string[], dx: number, dy: number) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return
    const sources = new Set(ids)
    insertCopies(currentLayout.value.keys.filter(key => sources.has(key.id)), dx, dy)
  }
  function copy() {
    if (!selectedKeys.value.length) return
    clipboard.value = clone(selectedKeys.value)
    sharedClipboard.pastes = 0
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(CLIPBOARD_STORAGE_KEY, stringifyLayout({ meta: deserialize([]).meta, keys: clipboard.value }, 0))
    } catch { /* This tab still has them; other tabs won't. */ }
  }
  function cut() { copy(); deleteSelected() }
  function paste() {
    if (!clipboard.value.length) return
    const offset = .25 * ++sharedClipboard.pastes
    insertCopies(clipboard.value, offset, offset)
  }

  function updateKeys(patch: Partial<Key>) {
    const values = clone(patch)
    delete values.id
    const dimensions = ['width', 'height', 'width2', 'height2'] as const
    for (const field of dimensions) {
      if (values[field] !== undefined && (!Number.isFinite(values[field]) || values[field]! < .25)) delete values[field]
    }
    const coordinates = ['x', 'y', 'x2', 'y2', 'rotation_angle', 'rotation_x', 'rotation_y'] as const
    for (const field of coordinates) if (values[field] !== undefined && !Number.isFinite(values[field])) delete values[field]
    editSelection(key => {
      // A rectangular key stays rectangular when its primary dimensions change.
      if (values.width !== undefined && values.width2 === undefined && key.width2 === key.width && key.x2 === 0) key.width2 = values.width
      if (values.height !== undefined && values.height2 === undefined && key.height2 === key.height && key.y2 === 0) key.height2 = values.height
      const defaults = values.default ? { ...key.default, ...values.default } : key.default
      Object.assign(key, clone(values))
      key.default = defaults
    })
  }
  const isLegendSlot = (index: number) => Number.isInteger(index) && index >= 0 && index <= 11
  /** Write one slot, filling the slots before it so the labels never have holes. */
  function writeLegend(key: Key, index: number, text: string) {
    while (key.labels.length < index) key.labels.push('')
    key.labels[index] = text
  }
  function updateLegend(index: number, text: string) {
    if (!isLegendSlot(index)) return
    editSelection(key => writeLegend(key, index, text))
  }
  /** One key's legend, as the stage's in-place editor writes it; the selection is left as it is. */
  function updateKeyLegend(id: string, index: number, text: string) {
    if (!isLegendSlot(index)) return
    const next = clone(currentLayout.value)
    const key = next.keys.find(key => key.id === id)
    if (!key || (key.labels[index] ?? '') === text) return
    writeLegend(key, index, text)
    commit(next)
  }
  function setTextColor(color: string) {
    editSelection(key => { key.default.textColor = color; key.textColor = [] })
  }
  function setTextSize(size: number) {
    if (!Number.isFinite(size) || size < 1 || size > 9) return
    editSelection(key => { key.default.textSize = size; key.textSize = [] })
  }
  function resizeSelected(dw: number, dh: number) {
    if (!Number.isFinite(dw) || !Number.isFinite(dh)) return
    editSelection(key => {
      const width = Math.max(.25, round(key.width + dw))
      const height = Math.max(.25, round(key.height + dh))
      if (key.width2 === key.width && key.x2 === 0) key.width2 = width
      if (key.height2 === key.height && key.y2 === 0) key.height2 = height
      key.width = width
      key.height = height
    })
  }
  /** Commit an edge drag once; other selected keys keep their geometry and selection. */
  function resizeKey(id: string, geometry: KeyGeometryPatch) {
    if (!currentLayout.value.keys.some(key => key.id === id)) return
    const dimensions = ['width', 'height', 'width2', 'height2'] as const
    const coordinates = ['x', 'y', 'x2', 'y2'] as const
    if (dimensions.some(field => !Number.isFinite(geometry[field]) || geometry[field] < .25)
      || coordinates.some(field => !Number.isFinite(geometry[field]))) return
    const next = clone(currentLayout.value)
    const key = next.keys.find(key => key.id === id)!
    for (const field of [...coordinates, ...dimensions]) key[field] = geometry[field]
    commit(next)
  }
  function rotateSelected(angle: number) {
    if (Number.isFinite(angle)) editSelection(key => { key.rotation_angle = round(((key.rotation_angle + angle + 180) % 360 + 360) % 360 - 180) })
  }
  function updateMeta(patch: Partial<LayoutMetadata>) {
    const next = clone(currentLayout.value)
    Object.assign(next.meta, clone(patch))
    commit(next)
  }

  return {
    layout, selectedIds, selectedKeys, canUndo, canRedo, canPaste, storageError, baseline, isDirty,
    loadPreset, importLayout, applyLayout, replaceLayout, markClean, undo, redo, selectKey, selectIds, clearSelection, selectAll,
    addKey, deleteSelected, duplicateSelected, duplicateDragged, copy, cut, paste, moveSelected,
    updateKeys, updateLegend, updateKeyLegend, setTextColor, setTextSize, resizeSelected, resizeKey, rotateSelected, updateMeta,
  }
}
