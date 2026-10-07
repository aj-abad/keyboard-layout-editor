import assert from 'node:assert/strict'
import test from 'node:test'
import { DRAFT_STORAGE_KEY, useEditor } from '../app/composables/useEditor'
import { createKey, deserialize, stringifyLayout } from '../app/utils/layout'
import { resizeKeyGeometry } from '../app/utils/resize'

function blankEditor(historyLimit = 100) {
  return useEditor({ initialLayout: deserialize([]), storage: null, historyLimit })
}

test('edits, deletion, and undo restore both layout and selection', () => {
  const editor = blankEditor()
  editor.addKey()
  const id = editor.selectedIds.value[0]!
  editor.updateLegend(4, 'A')
  editor.updateKeys({ width: 2, height: 1.5 })
  assert.equal(editor.layout.value.keys[0]!.width2, 2)
  assert.equal(editor.layout.value.keys[0]!.height2, 1.5)
  editor.deleteSelected()
  assert.equal(editor.layout.value.keys.length, 0)
  editor.undo()
  assert.deepEqual(editor.selectedIds.value, [id])
  assert.equal(editor.selectedKeys.value[0]!.labels[4], 'A')
  editor.redo()
  assert.equal(editor.layout.value.keys.length, 0)
  editor.undo()
  editor.moveSelected(1, 0)
  assert.equal(editor.canRedo.value, false)
})

test('history is bounded and no-op edits do not add undo entries', () => {
  const editor = blankEditor(2)
  editor.addKey()
  editor.updateLegend(4, 'A')
  editor.updateLegend(4, 'B')
  editor.updateLegend(4, 'B')
  editor.undo()
  assert.equal(editor.selectedKeys.value[0]!.labels[4], 'A')
  editor.undo()
  assert.equal(editor.selectedKeys.value[0]!.labels[4] || '', '')
  assert.equal(editor.canUndo.value, false)
})

test('a legend edited in place changes that key alone, as one undo step', () => {
  const editor = blankEditor()
  editor.addKey()
  const first = editor.selectedIds.value[0]!
  editor.addKey()
  const second = editor.selectedIds.value[0]!
  editor.selectIds([first, second])
  const labels = (id: string) => editor.layout.value.keys.find(key => key.id === id)!.labels
  editor.updateKeyLegend(second, 7, 'Fn')
  assert.equal(labels(second)[7], 'Fn')
  assert.equal(labels(first)[7] || '', '')
  assert.ok(Array.from(labels(second)).every(label => typeof label === 'string'), 'no holes before the slot')
  assert.deepEqual(editor.selectedIds.value, [first, second])
  // The same text, a slot KLE doesn't have, and a missing key change nothing.
  editor.updateKeyLegend(second, 7, 'Fn')
  editor.updateKeyLegend(second, 12, 'X')
  editor.updateKeyLegend(second, 1.5, 'X')
  editor.updateKeyLegend('missing', 0, 'X')
  editor.undo()
  assert.equal(labels(second)[7] || '', '')
  editor.undo()
  editor.undo()
  assert.equal(editor.canUndo.value, false)
})

test('selection toggles, marquee adds, and copies get new ids', () => {
  const editor = blankEditor()
  editor.addKey()
  const first = editor.selectedIds.value[0]!
  editor.addKey()
  const second = editor.selectedIds.value[0]!
  editor.selectKey(first, true)
  assert.equal(editor.selectedIds.value.length, 2)
  editor.selectKey(first, true)
  assert.deepEqual(editor.selectedIds.value, [second])
  editor.selectIds([first, first, 'missing'], true)
  assert.deepEqual(editor.selectedIds.value, [second, first])
  editor.copy()
  editor.paste()
  assert.equal(editor.layout.value.keys.length, 4)
  assert.equal(new Set(editor.layout.value.keys.map(key => key.id)).size, 4)
  editor.cut()
  assert.equal(editor.layout.value.keys.length, 2)
  editor.paste()
  assert.equal(editor.layout.value.keys.length, 4)
})

test('canvas movement is converted into local coordinates for rotated keys', () => {
  const initial = deserialize([])
  initial.keys = [createKey({ x: 2, y: 3, rotation_angle: 90, rotation_x: 1, rotation_y: 1 })]
  const editor = useEditor({ initialLayout: initial, storage: null })
  editor.selectAll()
  editor.moveSelected(1, 0)
  const key = editor.selectedKeys.value[0]!
  assert.equal(key.x, 2)
  assert.equal(key.y, 2)
  assert.equal(key.rotation_x, 1)
  assert.equal(key.rotation_y, 1)
  editor.duplicateSelected()
  const duplicate = editor.selectedKeys.value[0]!
  assert.equal(duplicate.x, 2.25)
  assert.equal(duplicate.y, 1.75)
})

test('invalid geometry is ignored and ISO secondary shapes are preserved', () => {
  const initial = deserialize([])
  initial.keys = [createKey({ width: 1.25, width2: 1.5, x2: -.25 })]
  const editor = useEditor({ initialLayout: initial, storage: null })
  editor.selectAll()
  editor.updateKeys({ width: 2, height: Number.NaN, x: Number.POSITIVE_INFINITY })
  assert.equal(editor.selectedKeys.value[0]!.width, 2)
  assert.equal(editor.selectedKeys.value[0]!.width2, 1.5)
  assert.equal(editor.selectedKeys.value[0]!.height, 1)
  assert.equal(editor.selectedKeys.value[0]!.x, 0)
})

test('edge resizing commits one key once and undo restores its geometry and multi-selection', () => {
  const initial = deserialize([])
  initial.keys = [
    createKey({ x: 2, y: 3, rotation_angle: 90, rotation_x: 1, rotation_y: 1, width: 1.25, height: 2, x2: -.25, width2: 1.5, height2: 1, labels: ['Enter'], stepped: true }),
    createKey({ x: 5, y: 3, labels: ['Other'] }),
  ]
  let writes = 0
  const editor = useEditor({ initialLayout: initial, storage: { getItem: () => null, setItem: () => { writes++ } } })
  editor.selectAll()
  const original = structuredClone(editor.layout.value)
  const selection = [...editor.selectedIds.value]
  const key = original.keys[0]!
  // Many previews are computed from the original cap without changing state or autosave.
  for (let delta = .1; delta <= 1; delta += .1) resizeKeyGeometry(key, 'right', 0, delta)
  assert.equal(writes, 0)
  assert.deepEqual(editor.layout.value, original)
  const geometry = resizeKeyGeometry(key, 'right', 0, .5)
  editor.resizeKey(key.id, geometry)
  assert.equal(writes, 1)
  assert.deepEqual(editor.selectedIds.value, selection)
  assert.deepEqual(editor.layout.value.keys[0], { ...key, ...geometry })
  assert.deepEqual(editor.layout.value.keys[1], original.keys[1])
  editor.undo()
  assert.deepEqual(editor.layout.value, original)
  assert.deepEqual(editor.selectedIds.value, selection)
  assert.equal(editor.canUndo.value, false)
  editor.redo()
  assert.deepEqual(editor.layout.value.keys[0], { ...key, ...geometry })
})

test('no-op, missing-key, and invalid edge resize commits do not save or alter history', () => {
  const initial = deserialize([])
  initial.keys = [createKey()]
  let writes = 0
  const editor = useEditor({ initialLayout: initial, storage: { getItem: () => null, setItem: () => { writes++ } } })
  const key = initial.keys[0]!
  const geometry = resizeKeyGeometry(key, 'right', 0, 0)
  editor.resizeKey(key.id, geometry)
  editor.resizeKey('missing', { ...geometry, width: 2 })
  editor.resizeKey(key.id, { ...geometry, width2: .1 })
  editor.resizeKey(key.id, { ...geometry, x: Number.NaN })
  assert.deepEqual(editor.layout.value, initial)
  assert.equal(editor.canUndo.value, false)
  assert.equal(writes, 0)
})

test('failed imports preserve the working layout and successful imports are undoable', () => {
  const editor = blankEditor()
  editor.addKey()
  const before = stringifyLayout(editor.layout.value)
  assert.throws(() => editor.importLayout('{invalid'))
  assert.equal(stringifyLayout(editor.layout.value), before)
  editor.importLayout('[["Q", "W"]]')
  assert.equal(editor.layout.value.keys.length, 2)
  editor.undo()
  assert.equal(stringifyLayout(editor.layout.value), before)
})

test('draft restore validates data, autosave handles quota failure and recovery', () => {
  let draft = '[["Saved"]]'
  let fail = false
  const storage = {
    getItem(key: string) { assert.equal(key, DRAFT_STORAGE_KEY); return draft },
    setItem(key: string, value: string) {
      assert.equal(key, DRAFT_STORAGE_KEY)
      if (fail) throw new Error('quota exceeded')
      draft = value
    },
  }
  const editor = useEditor({ initialLayout: deserialize([]), storage })
  assert.ok(editor.layout.value.keys[0]!.labels.includes('Saved'))
  editor.selectAll()
  fail = true
  editor.updateLegend(4, 'Edited')
  assert.match(editor.storageError.value, /autosave/)
  assert.equal(editor.selectedKeys.value[0]!.labels[4], 'Edited')
  fail = false
  editor.updateMeta({ name: 'Saved layout' })
  assert.equal(editor.storageError.value, '')
  const restored = useEditor({ initialLayout: deserialize([]), storage })
  assert.equal(restored.layout.value.meta.name, 'Saved layout')
  assert.ok(restored.layout.value.keys[0]!.labels.includes('Edited'))
})

test('corrupt drafts show a recoverable error without overwriting browser storage', () => {
  let writes = 0
  const editor = useEditor({ initialLayout: deserialize([]), storage: {
    getItem: () => 'broken JSON',
    setItem: () => { writes++ },
  } })
  assert.equal(editor.layout.value.keys.length, 0)
  assert.match(editor.storageError.value, /restore/)
  assert.equal(writes, 0)
  editor.addKey()
  assert.equal(writes, 1)
})
