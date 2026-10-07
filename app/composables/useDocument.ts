import { computed, getCurrentScope, onScopeDispose, shallowRef, watch } from 'vue'
import { useEditor } from './useEditor'
import { writeDocument, type DocumentStorage, type OpenedDocument } from '../utils/documents'
import type { Layout } from '../utils/layout'
import type { Zoom } from '../utils/zoom'

/**
 * The tab's one layout: its editor, its unapplied JSON and its zoom, written
 * to this browser under the tab's id on every change. Unexported changes are
 * measured against a portable JSON baseline, apart from that autosave.
 */
export function useDocument(opened: OpenedDocument, storage: DocumentStorage | null) {
  const { id, record } = opened
  const editor = useEditor({ initialLayout: record.layout, storage: null, baseline: record.baseline })
  const raw = shallowRef(record.raw)
  const zoom = shallowRef<Zoom>(record.zoom)
  const storageError = shallowRef(storage ? '' : 'This browser isn’t keeping layouts. Export JSON to keep a copy.')
  let origin = record.origin
  let edited = record.edited
  const dirty = computed(() => editor.isDirty.value || raw.value !== null)
  /** Untouched since it was made new, so a file can take its place. */
  const pristine = () => origin === 'new' && !edited

  function save() {
    if (!storage) return
    try {
      writeDocument(storage, id, {
        layout: editor.layout.value, baseline: editor.baseline.value, raw: raw.value, zoom: zoom.value,
        created: record.created, updated: Date.now(), origin, edited,
      })
      storageError.value = ''
    } catch { storageError.value = 'Couldn’t autosave in this browser. Export JSON to keep a copy.' }
  }
  watch([editor.layout, raw], () => { edited = true; save() }, { flush: 'sync' })
  watch([editor.baseline, zoom], save, { flush: 'sync' })
  // Leaving the tab makes this the layout last in use, the one a bare visit reopens.
  if (typeof window !== 'undefined') {
    const leave = () => { if (window.document.visibilityState === 'hidden') save() }
    window.document.addEventListener('visibilitychange', leave)
    window.addEventListener('pagehide', save)
    if (getCurrentScope()) {
      onScopeDispose(() => {
        window.document.removeEventListener('visibilitychange', leave)
        window.removeEventListener('pagehide', save)
      })
    }
  }

  /** Open a file in the layout's place, as a tab the system opened for that file does. */
  function replace(layout: Layout) {
    origin = 'file'
    raw.value = null
    editor.replaceLayout(layout)
  }

  return { id, editor, raw, zoom, dirty, storageError, pristine, replace }
}

export type LayoutDocument = ReturnType<typeof useDocument>
