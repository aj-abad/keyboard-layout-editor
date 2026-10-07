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
}
interface Snapshot { layout: Layout; selectedIds: string[] }

const clone = <T>(value: T): T => structuredClone(value)
const round = (value: number) => Math.round(value * 1e6) / 1e6

/** One local editor instance. Every edit stores a complete, bounded undo snapshot. */
export function useEditor(options: EditorOptions = {}) {
  const preset = presets.presets.find(item => item.name === 'Default 60%') ?? presets.presets[1]!
  const initial = options.initialLayout ? clone(options.initialLayout) : deserialize(preset.data)
  if (!options.initialLayout && !initial.meta.name) initial.meta.name = preset.name
  const currentLayout = shallowRef<Layout>(initial)
  const currentSelection = shallowRef<string[]>([])
  const past = shallowRef<Snapshot[]>([])
  const future = shallowRef<Snapshot[]>([])
  const clipboard = shallowRef<Key[]>([])
  let pasteCount = 0
  const storageError = shallowRef('')
  const historyLimit = Math.max(1, Math.floor(options.historyLimit ?? 100))
  let storage: DraftStorage | null = null

  const layout = computed(() => currentLayout.value)
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
    storageError.value = 'The browser draft could not be restored. Export JSON to keep a copy.'
  }

  function saveDraft() {
    if (!storage) return
    try {
      storage.setItem(DRAFT_STORAGE_KEY, stringifyLayout(currentLayout.value))
      storageError.value = ''
    } catch {
      storageError.value = 'Browser autosave is unavailable. Export JSON to keep a copy.'
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
  function copy() {
    if (!selectedKeys.value.length) return
    clipboard.value = clone(selectedKeys.value)
    pasteCount = 0
  }
  function cut() { copy(); deleteSelected() }
  function paste() {
    if (!clipboard.value.length) return
    pasteCount++
    insertCopies(clipboard.value, .25 * pasteCount, .25 * pasteCount)
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
  function updateLegend(index: number, text: string) {
    if (!Number.isInteger(index) || index < 0 || index > 11) return
    editSelection(key => { key.labels[index] = text })
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
    layout, selectedIds, selectedKeys, canUndo, canRedo, canPaste, storageError,
    loadPreset, importLayout, undo, redo, selectKey, selectIds, clearSelection, selectAll,
    addKey, deleteSelected, duplicateSelected, copy, cut, paste, moveSelected,
    updateKeys, updateLegend, setTextColor, setTextSize, resizeSelected, resizeKey, rotateSelected, updateMeta,
  }
}
