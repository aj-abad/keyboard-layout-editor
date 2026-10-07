import { computed, inject, provide, ref, shallowRef, watch, type InjectionKey } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { toast } from '#layers/sine/app/composables/useToast'
import { useShellTools } from '#layers/sine/app/composables/useShellTools'
import { useDocument } from './useDocument'
import { useLayoutParser } from './useLayoutParser'
import {
  browserLocks, documentKey, documentUrl, isPristine, listDocuments, newDocumentUrl, newRecord, resolveDocument, writeDocument,
  type DocumentLocks, type DocumentRecord, type DocumentStorage, type OpenedDocument, type Template,
} from '../utils/documents'
import { deserialize, stringifyLayout, type Key, type Layout } from '../utils/layout'
import { MAX_LAYOUT_BYTES } from '../utils/layout-parser'
import { layoutToSvg } from '../utils/svg'

/** The window's own layout, kept between visits: the inspector and the pinned tools. */
const PREFERENCES_KEY = 'kle-window-v1'
export const JSON_TOOL = 'json'

export type ExportFormat = 'json' | 'svg' | 'png'

/** A document's name, as the title bar, the browser tab and Open recent all show it. */
export const nameOf = (layout: Layout) => layout.meta.name.trim() || 'Untitled layout'

/** A file's name without the extensions a layout comes in. */
const nameOfFile = (file: File) => file.name.replace(/\.(json5?|txt)$/i, '')

/** Commit a field's pending `change` while the selection it belongs to is still current. */
export function flushField() {
  const element = document.activeElement
  if (element instanceof HTMLElement && element.matches('input, textarea, [contenteditable="true"]')) element.blur()
}

function fileName(name: string, extension: string) {
  return `${name.replace(/[^a-z\d _-]/gi, '').trim() || 'keyboard-layout'}.${extension}`
}

function download(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function renderPng(layout: Layout) {
  const url = URL.createObjectURL(new Blob([layoutToSvg(layout)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    const scale = Math.min(2, 8192 / Math.max(image.width, image.height))
    canvas.width = Math.ceil(image.width * scale)
    canvas.height = Math.ceil(image.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser can’t draw images.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image couldn’t be encoded.')), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null')
    return saved && typeof saved === 'object' ? saved as Record<string, unknown> : {}
  } catch { return {} }
}

export interface TabDocument { opened: OpenedDocument; storage: DocumentStorage | null; locks: DocumentLocks | null }

/** Settle which layout this tab has, and put its address in the location bar, where a reload finds it. */
export async function openTabDocument(): Promise<TabDocument> {
  let storage: DocumentStorage | null = null
  try { storage = window.localStorage } catch { /* Storage blocked: the layout lives only in the tab. */ }
  const locks = browserLocks()
  const opened = await resolveDocument({ storage, locks, search: location.search })
  history.replaceState(history.state, '', documentUrl(opened.id))
  // A tab opened from another works on its own, and has no use for the way back to it.
  if (window.opener) window.opener = null
  return { opened, storage, locks }
}

/**
 * The editor as one application: the tab's layout and what can be done to it,
 * and the window around it. Created once by the shell and provided to every
 * surface, so the title bar, the canvas, the menus and the command palette
 * all act through the same calls. Every other layout is a browser tab of its
 * own: a new one, a template or a file opens in one.
 */
export function createLayoutApp({ opened, storage, locks }: TabDocument) {
  const doc = useDocument(opened, storage)
  const parser = useLayoutParser()

  const editor = computed(() => doc.editor)
  const layout = computed(() => doc.editor.layout.value)
  const dirty = doc.dirty

  // The window. From `xl` the JSON tool pins into the dock; narrower, its
  // popover is its only shape, so the narrow window keeps a state of its own
  // and the wide one's pin waits (Sine: Patterns › Shell › The dock).
  const pinnable = useMediaQuery('(min-width: 1280px)')
  const preferences = readPreferences()
  const inspectorHidden = ref(preferences.inspectorHidden === true)
  const wideTools = useShellTools()
  const narrowTools = useShellTools()
  wideTools.restore(preferences.tools as Parameters<typeof wideTools.restore>[0], [JSON_TOOL])
  const tools = computed(() => pinnable.value ? wideTools : narrowTools)
  // A popover open at one width never comes back unasked at the other.
  watch(pinnable, () => { wideTools.closePopover(); narrowTools.closePopover() })
  watch([inspectorHidden, wideTools.state], () => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ inspectorHidden: inspectorHidden.value, tools: wideTools.remember() }))
    } catch { /* A preference that can't be kept is only a preference. */ }
  })
  const jsonPlace = computed(() => tools.value.placeOf(JSON_TOOL))
  const jsonShowing = computed(() => tools.value.showing(JSON_TOOL))
  const dockUp = computed(() => tools.value.dockUp.value)

  /** The one file input, behind Open… and the window-wide drop zone. */
  const filePicker = shallowRef<{ open: () => void } | null>(null)
  const pickFiles = () => filePicker.value?.open()
  const draggingFiles = ref(false)

  /** The scale the stage draws at, fitted or chosen: what the zoom commands step from. */
  const stageScale = ref(1)
  const paletteOpen = ref(false)
  const helpOpen = ref(false)
  /** The layout being renamed in the title bar. */
  const renaming = ref(false)
  let importQueue = Promise.resolve()
  let disposed = false

  // -- Other layouts, each in a tab of its own ------------------------------------

  /**
   * Open an address in a new browser tab. A browser lets the click, the key or
   * the drop that asked for it open one tab; false when it blocked this one.
   */
  function openTab(url: string) {
    return window.open(url, '_blank') !== null
  }
  /** A layout waiting in a toast for the click that opens its tab. */
  function offerTab(url: string, name: string, altText: string) {
    toast.info(`“${name}” is ready to open`, {
      duration: null,
      action: { label: 'Open', altText, onSelect: () => openTab(url) },
    })
  }
  /** Open it, or, where the browser blocks the tab, offer it instead. */
  function openOrOffer(url: string, name: string, altText: string) {
    if (!openTab(url)) offerTab(url, name, altText)
  }
  /** Keep a layout in this browser for the tab that will open it. */
  function keep(record: DocumentRecord) {
    if (!storage) return null
    const id = crypto.randomUUID()
    try {
      writeDocument(storage, id, record)
      return id
    } catch { return null }
  }
  function cantKeep(name: string) {
    toast.error(`Couldn’t open “${name}” in a new tab`, {
      action: { label: 'Export', altText: 'Export JSON from the Export menu to make room', onSelect: () => exportAs('json') },
    })
  }

  function newLayout() {
    flushField()
    openOrOffer(newDocumentUrl(), 'Untitled layout', 'Choose New layout again from the New menu')
  }

  function openTemplate(template: Template) {
    flushField()
    openOrOffer(newDocumentUrl(template.name), template.name, 'Choose the template again from the New menu')
  }

  /** The tab's layout again, in a tab of its own. */
  function duplicateLayout() {
    flushField()
    const copy = structuredClone(layout.value)
    copy.meta.name = `${nameOf(layout.value)} copy`
    const id = keep(newRecord(copy, 'copy', Date.now()))
    if (!id) return cantKeep(nameOf(copy))
    openOrOffer(documentUrl(id), nameOf(copy), 'Open it from Open recent in the New menu')
  }

  /**
   * Each file in a tab of its own, in the order it was chosen. The drop or the
   * choice opens the first; a browser lets one gesture open one tab, so the
   * rest wait in toasts for a click apiece.
   */
  function openFiles(files: File[]) {
    if (!files.length) return
    importQueue = importQueue.then(async () => {
      let first = true
      for (const file of files) {
        try {
          const parsed = await parser.parse(file)
          if (disposed) return
          if (!parsed.meta.name) parsed.meta.name = nameOfFile(file)
          const id = keep(newRecord(parsed, 'file', Date.now()))
          if (!id) {
            cantKeep(nameOf(parsed))
            continue
          }
          const url = documentUrl(id)
          if (!first || !openTab(url)) offerTab(url, nameOf(parsed), 'Open it from Open recent in the New menu')
          first = false
        } catch {
          if (disposed) return
          toast.error(`Couldn’t open “${file.name}”`, {
            action: {
              label: 'Show',
              altText: 'Paste the file’s text into the JSON tool to see what’s wrong with it',
              onSelect: () => inspectFile(file),
            },
          })
        }
      }
    })
  }

  /**
   * Files the system opened the installed app with. A window launched for a
   * file has a new layout waiting for it, which the first file takes the place
   * of; any others open as they would from a drop.
   */
  async function openLaunched(files: File[]) {
    const [first, ...rest] = files
    if (!first) return
    if (!doc.pristine()) return openFiles(files)
    try {
      const parsed = await parser.parse(first)
      if (!parsed.meta.name) parsed.meta.name = nameOfFile(first)
      doc.replace(parsed)
    } catch {
      toast.error(`Couldn’t open “${first.name}”`, {
        action: { label: 'Show', altText: 'Paste the file’s text into the JSON tool to see what’s wrong with it', onSelect: () => inspectFile(first) },
      })
    }
    openFiles(rest)
  }

  /** A file that failed to open, as text in a new tab's JSON tool, where its error is shown. */
  async function inspectFile(file: File) {
    if (file.size > MAX_LAYOUT_BYTES) {
      toast.error(`“${file.name}” is over 5 MB`)
      return
    }
    const text = await file.text()
    const blank = deserialize([])
    blank.meta.name = nameOfFile(file)
    const id = keep({ ...newRecord(blank, 'file', Date.now()), raw: text })
    if (!id) return cantKeep(nameOf(blank))
    openOrOffer(`${documentUrl(id)}&json`, nameOf(blank), 'Open it from Open recent in the New menu')
  }

  /** The layouts this browser keeps that no tab has open, the most recent first. */
  const recent = shallowRef<{ id: string; record: DocumentRecord }[]>([])
  async function refreshRecent() {
    if (!storage) return
    const held = (await locks?.held()) ?? new Set<string>()
    recent.value = listDocuments(storage)
      .filter(({ id, record }) => id !== doc.id && !isPristine(record) && !held.has(documentKey(id)))
      .slice(0, 10)
  }
  function openRecent(id: string) {
    const item = recent.value.find(entry => entry.id === id)
    openOrOffer(documentUrl(id), item ? nameOf(item.record.layout) : 'Untitled layout', 'Open it from Open recent in the New menu')
  }

  function rename(name: string) {
    const next = name.trim()
    if (next !== layout.value.meta.name) doc.editor.updateMeta({ name: next })
  }

  async function exportAs(format: ExportFormat) {
    flushField()
    const current = layout.value
    const name = nameOf(current)
    if (format === 'json') {
      download(stringifyLayout(current), fileName(current.meta.name, 'json'), 'application/json')
      doc.editor.markClean()
      toast.success(doc.raw.value === null ? 'JSON exported' : 'JSON exported without the unapplied edits')
    } else if (format === 'svg') {
      download(layoutToSvg(current), fileName(current.meta.name, 'svg'), 'image/svg+xml')
      toast.success('SVG exported')
    } else {
      try {
        download(await renderPng(current), fileName(current.meta.name, 'png'), 'image/png')
        toast.success('PNG exported')
      } catch {
        toast.error(`Couldn’t export “${name}” as a PNG`, {
          action: { label: 'Retry', altText: 'Export it again from the Export menu', onSelect: () => exportAs('png') },
        })
      }
    }
  }

  // -- The JSON tool -----------------------------------------------------------

  /** The tool's button: show it, or shut its popover. Focus stays on the button. */
  function pressJson() { tools.value.press(JSON_TOOL) }
  /** The palette's and the chord's way in: open it, and put the caret in it. */
  const jsonFocus = shallowRef(false)
  function showJson() {
    tools.value.show(JSON_TOOL)
    jsonFocus.value = true
  }

  // -- Keys ---------------------------------------------------------------------

  /** Copy, and leave the keys on the system clipboard as KLE JSON as well. */
  function copyKeys(cut = false) {
    const keys: Key[] = doc.editor.selectedKeys.value
    if (!keys.length) return
    if (cut) doc.editor.cut()
    else doc.editor.copy()
    const text = stringifyLayout({ meta: deserialize([]).meta, keys })
    navigator.clipboard?.writeText(text).catch(() => { /* The in-app clipboard still has them. */ })
  }

  // -- What the tab says as it opens -------------------------------------------

  if (opened.notice === 'copy') toast.info(`“${nameOf(layout.value)}” is open in another tab, so this tab has a copy of it`)
  else if (opened.notice === 'missing') toast.info('This browser doesn’t have that layout, so this is a new one')
  else if (opened.notice === 'migration') toast.error('Couldn’t bring over the layouts this browser kept before')
  if (opened.json) showJson()

  function dispose() { disposed = true }

  return {
    document: doc, parser, editor, layout, dirty,
    inspectorHidden, stageScale, paletteOpen, helpOpen, renaming, filePicker, draggingFiles, recent,
    tools, pinnable, jsonPlace, jsonShowing, dockUp, jsonFocus,
    newLayout, openTemplate, duplicateLayout, openFiles, openLaunched, pickFiles, refreshRecent, openRecent,
    rename, exportAs, pressJson, showJson, copyKeys, dispose,
  }
}

export type LayoutApp = ReturnType<typeof createLayoutApp>
const LAYOUT_APP: InjectionKey<LayoutApp> = Symbol('layout-app')

export function provideLayoutApp(tab: TabDocument) {
  const app = createLayoutApp(tab)
  provide(LAYOUT_APP, app)
  return app
}

export function useLayoutApp() {
  const app = inject(LAYOUT_APP)
  if (!app) throw new Error('useLayoutApp() needs the shell’s provideLayoutApp() above it.')
  return app
}
