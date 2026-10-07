import assert from 'node:assert/strict'
import test from 'node:test'
import { useEditor } from '../app/composables/useEditor'
import { createKey, deserialize } from '../app/utils/layout'

test('drag duplication leaves originals intact and commits the copied group in one undo step', () => {
  const initial = deserialize([])
  initial.keys = [
    createKey({ x: 2, y: 3, rotation_angle: 90, rotation_x: 1, rotation_y: 1, width: 1.25, height: 2, x2: -.25, width2: 1.5, height2: 1, labels: ['Enter'], stepped: true }),
    createKey({ x: 5, y: 3, labels: ['A'], color: '#ffcc00' }),
    createKey({ x: 8, y: 2, labels: ['Unselected'] }),
  ]
  let writes = 0
  const editor = useEditor({ initialLayout: initial, storage: { getItem: () => null, setItem: () => { writes++ } } })
  const ids = initial.keys.slice(0, 2).map(key => key.id)
  editor.selectIds(ids)
  editor.copy()
  editor.duplicateDragged([...ids, ids[0]!, 'missing'], 1, .5)
  assert.equal(writes, 1)
  assert.equal(editor.layout.value.keys.length, 5)
  assert.deepEqual(editor.layout.value.keys.slice(0, 3), initial.keys)
  const copies = editor.layout.value.keys.slice(3)
  assert.deepEqual(editor.selectedIds.value, copies.map(key => key.id))
  assert.equal(new Set(editor.layout.value.keys.map(key => key.id)).size, 5)
  assert.deepEqual(copies[0], { ...initial.keys[0], id: copies[0]!.id, x: 2.5, y: 2 })
  assert.deepEqual(copies[1], { ...initial.keys[1], id: copies[1]!.id, x: 6, y: 3.5 })
  assert.equal(editor.canPaste.value, true)
  editor.undo()
  assert.deepEqual(editor.layout.value, initial)
  assert.deepEqual(editor.selectedIds.value, ids)
  assert.equal(editor.canUndo.value, false)
  editor.redo()
  assert.deepEqual(editor.layout.value.keys.slice(3), copies)
  assert.deepEqual(editor.selectedIds.value, copies.map(key => key.id))
  editor.updateLegend(0, 'Copied')
  assert.deepEqual(editor.layout.value.keys.slice(0, 3), initial.keys)
})

test('drag duplication ignores empty, zero displacement, and invalid drops', () => {
  const initial = deserialize([['A', 'B']])
  let writes = 0
  const editor = useEditor({ initialLayout: initial, storage: { getItem: () => null, setItem: () => { writes++ } } })
  editor.selectAll()
  const beforeSelection = [...editor.selectedIds.value]
  editor.duplicateDragged(beforeSelection, 0, 0)
  editor.duplicateDragged(beforeSelection, Number.NaN, 1)
  editor.duplicateDragged(beforeSelection, 1, Number.POSITIVE_INFINITY)
  editor.duplicateDragged([], 1, 1)
  editor.duplicateDragged(['missing'], 1, 1)
  assert.deepEqual(editor.layout.value, initial)
  assert.deepEqual(editor.selectedIds.value, beforeSelection)
  assert.equal(editor.canUndo.value, false)
  assert.equal(writes, 0)
  // An explicit clicked-key source duplicates only that key, regardless of other selection.
  editor.duplicateDragged([initial.keys[1]!.id], -.25, .5)
  assert.equal(editor.layout.value.keys.length, 3)
  const copy = editor.layout.value.keys[2]!
  assert.deepEqual(copy, { ...initial.keys[1], id: copy.id, x: .75, y: .5 })
  assert.deepEqual(editor.layout.value.keys.slice(0, 2), initial.keys)
})
