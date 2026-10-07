import presets from '../data/layouts.json'
import { DRAFT_STORAGE_KEY } from '../composables/useEditor'
import { deserialize, parseLayout, stringifyLayout } from './layout'
import type { Layout } from './layout'
import { isZoom, type Zoom } from './zoom'

/**
 * One layout to a browser tab. A tab names its layout in its address
 * (`?layout=<id>`), and this browser keeps each layout under that id, so a
 * reload, a restored tab or a bookmark opens it again, and tabs never write
 * over each other. A tab holds a lock on its layout while it is open: a
 * second tab that asks for the same layout, as Duplicate tab does, takes a
 * copy of it instead.
 */

export const DOCUMENT_PREFIX = 'kle-layout:'
/**
 * The single snapshot of every open layout that the editor kept while it had
 * tabs of its own. The one draft it kept before that is `DRAFT_STORAGE_KEY`.
 */
export const WORKSPACES_STORAGE_KEY = 'kle-personal-workspaces-v1'

export type DocumentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
export type DocumentOrigin = 'new' | 'file' | 'copy' | 'migrated'
export interface DocumentRecord {
  layout: Layout
  /** The layout as it was last exported or opened from a file, which the unexported-changes dot compares against. */
  baseline: string
  /** An edit to the layout's JSON that hasn't been applied. */
  raw: string | null
  zoom: Zoom
  created: number
  /** When it was last open or changed: the most recent is the one a bare visit reopens. */
  updated: number
  origin: DocumentOrigin
  /** Changed since it was made. A new layout nobody touched isn't kept once its tab has gone. */
  edited: boolean
}

export interface Template { name: string; data: unknown }
/** The layouts a new one can start from. A blank layout is its own command, so the empty preset isn't one. */
export const TEMPLATES: readonly Template[] = presets.presets.filter(preset => Array.isArray(preset.data) && preset.data.length > 0)
/** What the editor shows the first time it opens, before there is any work to come back to. */
export const FIRST_LAYOUT = 'Default 60%'

export const documentKey = (id: string) => `${DOCUMENT_PREFIX}${id}`
/** The address of a layout, relative to the editor's own page. */
export const documentUrl = (id: string) => `?layout=${encodeURIComponent(id)}`
/** The address of a new layout: blank, or from the template named. */
export const newDocumentUrl = (template?: string) => template ? `?new=${encodeURIComponent(template)}` : '?new'

/** A layout to start from: the template named, or a blank one. */
export function starterLayout(template?: string | null): Layout {
  const preset = template ? TEMPLATES.find(item => item.name === template) : undefined
  const layout = deserialize(preset?.data ?? [])
  if (preset && !layout.meta.name) layout.meta.name = preset.name
  return layout
}

export function newRecord(layout: Layout, origin: DocumentOrigin, now: number): DocumentRecord {
  return { layout, baseline: stringifyLayout(layout, 0), raw: null, zoom: 'fit', created: now, updated: now, origin, edited: false }
}

/** Nobody has touched it: a new layout as it was made. */
export const isPristine = (record: DocumentRecord) => record.origin === 'new' && !record.edited

const ORIGINS = new Set<DocumentOrigin>(['new', 'file', 'copy', 'migrated'])
function isRecord(value: unknown): value is DocumentRecord {
  const record = value as DocumentRecord | null
  return !!record && typeof record === 'object'
    && Array.isArray(record.layout?.keys) && !!record.layout?.meta && typeof record.layout.meta === 'object'
    && typeof record.baseline === 'string' && (record.raw === null || typeof record.raw === 'string') && isZoom(record.zoom)
    && Number.isFinite(record.created) && Number.isFinite(record.updated)
    && ORIGINS.has(record.origin) && typeof record.edited === 'boolean'
}

export function readDocument(storage: DocumentStorage, id: string): DocumentRecord | null {
  try {
    const record = JSON.parse(storage.getItem(documentKey(id)) ?? 'null')
    return isRecord(record) ? record : null
  } catch { return null }
}

/** Throws when the browser won't keep it, as when its storage is full. */
export function writeDocument(storage: DocumentStorage, id: string, record: DocumentRecord) {
  storage.setItem(documentKey(id), JSON.stringify(record))
}

export function removeDocument(storage: DocumentStorage, id: string) {
  storage.removeItem(documentKey(id))
}

/** Every layout this browser keeps, the most recently open first. */
export function listDocuments(storage: DocumentStorage) {
  const ids: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith(DOCUMENT_PREFIX)) ids.push(key.slice(DOCUMENT_PREFIX.length))
  }
  return ids
    .flatMap(id => {
      const record = readDocument(storage, id)
      return record ? [{ id, record }] : []
    })
    .sort((a, b) => b.record.updated - a.record.updated)
}

/**
 * Move what earlier versions kept into a layout apiece: the open layouts of
 * the in-app tabs, in their order with the one that was open as the most
 * recent, or else the single draft from before those, which is kept as
 * unexported. A snapshot that can't be read is left as it is.
 */
export function migrateStorage(storage: DocumentStorage, now: number, uuid: () => string) {
  const snapshot = storage.getItem(WORKSPACES_STORAGE_KEY)
  if (snapshot) {
    const written: string[] = []
    try {
      const saved = JSON.parse(snapshot)
      if (!Array.isArray(saved?.documents)) throw new Error('Invalid workspace snapshot')
      const documents = saved.documents as { id: string; layout: Layout; baseline: string; raw: string | null; zoom: Zoom }[]
      const order = [...documents].sort((a, b) => Number(b.id === saved.activeId) - Number(a.id === saved.activeId))
      order.forEach((item, index) => {
        const record: DocumentRecord = {
          layout: item.layout, baseline: item.baseline, raw: item.raw, zoom: item.zoom,
          created: now, updated: now - index, origin: 'migrated', edited: true,
        }
        if (typeof item.id !== 'string' || !isRecord(record)) throw new Error('Invalid workspace snapshot')
        writeDocument(storage, item.id, record)
        written.push(item.id)
      })
      storage.removeItem(WORKSPACES_STORAGE_KEY)
      // The tabs took in the old draft when they first opened, and never wrote to it again.
      storage.removeItem(DRAFT_STORAGE_KEY)
      return true
    } catch {
      // Leave the snapshot to be read again, and nothing half-moved beside it.
      for (const id of written) removeDocument(storage, id)
      return false
    }
  }
  const draft = storage.getItem(DRAFT_STORAGE_KEY)
  if (draft) {
    try {
      writeDocument(storage, uuid(), { ...newRecord(parseLayout(draft), 'migrated', now), baseline: '', edited: true })
      storage.removeItem(DRAFT_STORAGE_KEY)
    } catch { return false }
  }
  return true
}

export interface DocumentLocks {
  /** Hold the named lock for the rest of the page's life; false when another tab holds it. */
  hold(name: string): Promise<boolean>
  /** The locks any tab holds now. */
  held(): Promise<Set<string>>
}

/** The browser's Web Locks, where it has them: one lock per open layout. */
export function browserLocks(): DocumentLocks | null {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  if (!locks) return null
  return {
    hold: name => new Promise(resolve => {
      locks.request(name, { ifAvailable: true }, lock => {
        resolve(lock !== null)
        // Never settles, so the lock stays held until the tab closes or leaves.
        return lock ? new Promise<void>(() => {}) : undefined
      }).catch(() => resolve(true))
    }),
    held: async () => {
      try {
        const { held = [] } = await locks.query()
        return new Set(held.flatMap(lock => lock.name ? [lock.name] : []))
      } catch { return new Set<string>() }
    },
  }
}

export interface OpenedDocument {
  id: string
  record: DocumentRecord
  /** What the tab says when it opens: it took a copy, the layout it asked for isn't here, or old work couldn't be moved. */
  notice?: 'copy' | 'missing' | 'migration'
  /** The address asked for the JSON tool open. */
  json: boolean
}

/**
 * Which layout this tab opens, from its address:
 *
 * - `?layout=<id>`, that layout, or a copy of it when another tab has it open;
 * - `?new`, or `?new=<template>`, a new layout;
 * - `?launch`, a new blank layout for the files the system opened the app with;
 * - nothing, the layout open most recently, unless another tab has it, when a
 *   new one starts: blank, or the first layout on a first visit.
 *
 * On the way, older storage is moved into layouts of their own, and new
 * layouts nobody touched are let go once no tab has them open.
 */
export async function resolveDocument(options: {
  storage: DocumentStorage | null
  locks: DocumentLocks | null
  search: string
  now?: number
  uuid?: () => string
}): Promise<OpenedDocument> {
  const { storage, locks, search, now = Date.now(), uuid = () => crypto.randomUUID() } = options
  const params = new URLSearchParams(search)
  const asked = params.get('layout')
  let notice: OpenedDocument['notice']
  if (storage && !migrateStorage(storage, now, uuid)) notice = 'migration'
  const held = (await locks?.held()) ?? new Set<string>()
  const kept = storage ? listDocuments(storage) : []
  if (storage) {
    for (const { id, record } of kept) {
      if (isPristine(record) && id !== asked && !held.has(documentKey(id))) removeDocument(storage, id)
    }
  }

  let id: string
  let record: DocumentRecord | null = null
  if (asked) {
    id = asked
    record = storage ? readDocument(storage, asked) : null
    if (!record) {
      record = newRecord(starterLayout(), 'new', now)
      notice ??= 'missing'
    }
  } else if (params.has('new') || params.has('launch')) {
    id = uuid()
    record = newRecord(starterLayout(params.get('new')), 'new', now)
  } else {
    const latest = kept.find(item => !isPristine(item.record))
    if (latest && !held.has(documentKey(latest.id))) {
      id = latest.id
      record = latest.record
    } else {
      id = uuid()
      record = newRecord(starterLayout(latest ? null : FIRST_LAYOUT), 'new', now)
    }
  }

  if (locks && !(await locks.hold(documentKey(id)))) {
    // Another tab has it: this one works on a copy, so neither writes over the other.
    id = uuid()
    record = { ...structuredClone(record), created: now, origin: isPristine(record) ? 'new' : 'copy' }
    notice = 'copy'
    await locks.hold(documentKey(id))
  }
  record = { ...record, updated: now }
  if (storage) {
    try { writeDocument(storage, id, record) } catch { /* The tab reports it when it next tries to save. */ }
  }
  return { id, record, notice, json: params.has('json') }
}
