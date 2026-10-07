import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { DRAFT_STORAGE_KEY, useEditor } from '../app/composables/useEditor'
import { useDocument } from '../app/composables/useDocument'
import {
  documentKey, FIRST_LAYOUT, listDocuments, newRecord, readDocument, resolveDocument, WORKSPACES_STORAGE_KEY, writeDocument,
  type DocumentRecord,
} from '../app/utils/documents'
import { deserialize, stringifyLayout } from '../app/utils/layout'

const layout = (name: string) => deserialize([{ name }, ['A']])

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
}
/** Locks as other tabs hold them: `open` names the layouts already open elsewhere. */
function tabLocks(...open: string[]) {
  const held = new Set(open.map(documentKey))
  return {
    held: async () => new Set(held),
    hold: async (name: string) => {
      if (held.has(name)) return false
      held.add(name)
      return true
    },
  }
}
function ids() {
  let next = 0
  return () => `id-${++next}`
}
function keep(storage: ReturnType<typeof memoryStorage>, id: string, name: string, changes: Partial<DocumentRecord> = {}) {
  writeDocument(storage, id, { ...newRecord(layout(name), 'file', 1000), ...changes })
}

test('dirty baseline follows undo and JSON export, independently of autosave', () => {
  const editor = useEditor({ initialLayout: layout('A'), storage: null })
  assert.equal(editor.isDirty.value, false)
  editor.addKey()
  assert.equal(editor.isDirty.value, true)
  editor.undo()
  assert.equal(editor.isDirty.value, false)
  editor.redo()
  editor.markClean()
  assert.equal(editor.isDirty.value, false)
  editor.undo()
  assert.equal(editor.isDirty.value, true)
})

test('a first visit opens the first layout, kept under the id the address will carry', async () => {
  const storage = memoryStorage()
  const opened = await resolveDocument({ storage, locks: tabLocks(), search: '', now: 5000, uuid: ids() })
  assert.equal(opened.id, 'id-1')
  assert.equal(opened.record.layout.meta.name, FIRST_LAYOUT)
  assert.ok(opened.record.layout.keys.length > 40)
  assert.equal(opened.notice, undefined)
  assert.deepEqual(readDocument(storage, 'id-1'), JSON.parse(JSON.stringify(opened.record)))
})

test('a bare visit reopens the most recent layout, unless another tab has it', async () => {
  const storage = memoryStorage()
  keep(storage, 'older', 'Older', { updated: 1000 })
  keep(storage, 'latest', 'Latest', { updated: 2000 })
  const back = await resolveDocument({ storage, locks: tabLocks(), search: '', now: 3000, uuid: ids() })
  assert.equal(back.id, 'latest')
  assert.equal(back.record.updated, 3000)
  const fresh = await resolveDocument({ storage, locks: tabLocks('latest'), search: '', now: 4000, uuid: ids() })
  assert.equal(fresh.id, 'id-1')
  assert.equal(fresh.record.layout.keys.length, 0, 'a new layout is blank once there is work to come back to')
  assert.equal(fresh.record.origin, 'new')
})

test('a layout open in another tab opens here as a copy, leaving the original alone', async () => {
  const storage = memoryStorage()
  keep(storage, 'shared', 'Shared', { edited: true })
  const before = storage.values.get(documentKey('shared'))
  const opened = await resolveDocument({ storage, locks: tabLocks('shared'), search: '?layout=shared', now: 9000, uuid: ids() })
  assert.equal(opened.id, 'id-1')
  assert.equal(opened.notice, 'copy')
  assert.equal(opened.record.origin, 'copy')
  assert.equal(opened.record.layout.meta.name, 'Shared')
  assert.equal(storage.values.get(documentKey('shared')), before)
  const own = await resolveDocument({ storage, locks: tabLocks(), search: '?layout=shared&json', now: 9000, uuid: ids() })
  assert.equal(own.id, 'shared')
  assert.equal(own.notice, undefined)
  assert.equal(own.json, true)
})

test('an address this browser has no layout for starts a new one there', async () => {
  const storage = memoryStorage()
  const opened = await resolveDocument({ storage, locks: tabLocks(), search: '?layout=gone', uuid: ids() })
  assert.equal(opened.id, 'gone')
  assert.equal(opened.notice, 'missing')
  assert.equal(opened.record.layout.keys.length, 0)
})

test('new layouts start blank or from the template named', async () => {
  const storage = memoryStorage()
  const blank = await resolveDocument({ storage, locks: tabLocks(), search: '?new', uuid: ids() })
  assert.equal(blank.record.layout.keys.length, 0)
  const template = await resolveDocument({ storage, locks: tabLocks(), search: `?new=${encodeURIComponent(FIRST_LAYOUT)}`, uuid: ids() })
  assert.equal(template.record.layout.meta.name, FIRST_LAYOUT)
  assert.ok(template.record.layout.keys.length > 0)
  const unknown = await resolveDocument({ storage, locks: tabLocks(), search: '?new=Nothing%20like%20it', uuid: ids() })
  assert.equal(unknown.record.layout.keys.length, 0)
})

test('untouched new layouts are let go once no tab has them, and kept while one does', async () => {
  const storage = memoryStorage()
  writeDocument(storage, 'abandoned', newRecord(layout('Abandoned'), 'new', 1000))
  writeDocument(storage, 'open', newRecord(layout('Open'), 'new', 1000))
  writeDocument(storage, 'reloading', newRecord(layout('Reloading'), 'new', 1000))
  keep(storage, 'work', 'Work')
  await resolveDocument({ storage, locks: tabLocks('open'), search: '?layout=reloading', uuid: ids() })
  assert.equal(readDocument(storage, 'abandoned'), null)
  assert.ok(readDocument(storage, 'open'))
  assert.ok(readDocument(storage, 'reloading'), 'the layout the address asks for survives its own reload')
  assert.ok(readDocument(storage, 'work'))
})

test('the in-app tabs of before move into layouts of their own, the open one most recent', async () => {
  const first = layout('First'), second = layout('Second')
  const storage = memoryStorage({
    [WORKSPACES_STORAGE_KEY]: JSON.stringify({
      activeId: 'b',
      documents: [
        { id: 'a', layout: first, baseline: stringifyLayout(first, 0), raw: null, zoom: 'fit' },
        { id: 'b', layout: second, baseline: '', raw: '[unfinished', zoom: 2 },
      ],
    }),
    [DRAFT_STORAGE_KEY]: stringifyLayout(layout('Stale draft')),
  })
  const opened = await resolveDocument({ storage, locks: tabLocks(), search: '', now: 7000, uuid: ids() })
  assert.equal(opened.id, 'b')
  assert.equal(opened.record.raw, '[unfinished')
  assert.equal(opened.record.zoom, 2)
  assert.equal(readDocument(storage, 'a')?.layout.meta.name, 'First')
  assert.equal(storage.values.has(WORKSPACES_STORAGE_KEY), false)
  assert.equal(storage.values.has(DRAFT_STORAGE_KEY), false, 'the tabs had already taken in the old draft')
  assert.deepEqual(listDocuments(storage).map(item => item.id), ['b', 'a'])
})

test('an unreadable snapshot is left as it was, and only the draft from before it moves alone', async () => {
  const broken = memoryStorage({ [WORKSPACES_STORAGE_KEY]: '{"documents":[{"id":"a"}]}' })
  const opened = await resolveDocument({ storage: broken, locks: tabLocks(), search: '', uuid: ids() })
  assert.equal(opened.notice, 'migration')
  assert.equal(broken.values.get(WORKSPACES_STORAGE_KEY), '{"documents":[{"id":"a"}]}')
  assert.equal(readDocument(broken, 'a'), null)

  const legacy = memoryStorage({ [DRAFT_STORAGE_KEY]: stringifyLayout(layout('Legacy')) })
  const restored = await resolveDocument({ storage: legacy, locks: tabLocks(), search: '', uuid: ids() })
  assert.equal(restored.record.layout.meta.name, 'Legacy')
  assert.equal(restored.record.baseline, '', 'kept as unexported')
  assert.equal(legacy.values.has(DRAFT_STORAGE_KEY), false)
})

test('without storage or locks a tab still opens a layout of its own', async () => {
  const opened = await resolveDocument({ storage: null, locks: null, search: '?layout=anything', uuid: ids() })
  assert.equal(opened.id, 'anything')
  assert.equal(opened.notice, 'missing')
})

test('the tab writes its layout on every change, and only a change to the layout counts as an edit', () => {
  const storage = memoryStorage()
  const scope = effectScope()
  scope.run(() => {
    const document = useDocument({ id: 'tab', record: newRecord(layout('Tab'), 'new', 1000), json: false }, storage)
    assert.equal(document.pristine(), true)
    document.zoom.value = 2
    assert.equal(readDocument(storage, 'tab')?.zoom, 2)
    assert.equal(readDocument(storage, 'tab')?.edited, false)
    document.editor.addKey()
    assert.equal(readDocument(storage, 'tab')?.edited, true)
    assert.equal(document.pristine(), false)
    assert.equal(document.dirty.value, true)
    document.editor.markClean()
    document.raw.value = '[draft'
    assert.equal(document.dirty.value, true, 'unapplied JSON is a change too')
    assert.equal(readDocument(storage, 'tab')?.raw, '[draft')
  })
  scope.stop()
})

test('a file the system opens takes a new layout’s place, clean and as a file', () => {
  const storage = memoryStorage()
  const scope = effectScope()
  scope.run(() => {
    const document = useDocument({ id: 'launch', record: newRecord(deserialize([]), 'new', 1000), json: false }, storage)
    document.replace(layout('From disk'))
    assert.equal(document.editor.layout.value.meta.name, 'From disk')
    assert.equal(document.dirty.value, false)
    assert.equal(readDocument(storage, 'launch')?.origin, 'file')
  })
  scope.stop()
})

test('a browser that won’t keep the layout says so and keeps working', () => {
  const full = { ...memoryStorage(), setItem: () => { throw new Error('QuotaExceededError') } }
  const scope = effectScope()
  scope.run(() => {
    const document = useDocument({ id: 'tab', record: newRecord(layout('Tab'), 'new', 1000), json: false }, full)
    document.editor.addKey()
    assert.match(document.storageError.value, /Couldn’t autosave/)
    assert.equal(document.editor.layout.value.keys.length, 2)
    const unkept = useDocument({ id: 'tab', record: newRecord(layout('Tab'), 'new', 1000), json: false }, null)
    assert.match(unkept.storageError.value, /isn’t keeping layouts/)
  })
  scope.stop()
})

test('listing skips what isn’t a layout and puts the most recent first', () => {
  const storage = memoryStorage({ 'kle-window-v1': '{}', [documentKey('bad')]: '{"layout":1}' })
  keep(storage, 'one', 'One', { updated: 1 })
  keep(storage, 'two', 'Two', { updated: 2 })
  assert.deepEqual(listDocuments(storage).map(item => item.id), ['two', 'one'])
})
