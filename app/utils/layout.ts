import JSON5 from 'json5'

export interface Key {
  id: string
  x: number
  y: number
  x2: number
  y2: number
  width: number
  height: number
  width2: number
  height2: number
  rotation_angle: number
  rotation_x: number
  rotation_y: number
  /** Normalized slots: top, middle, bottom and front; left, center, right. */
  labels: string[]
  textColor: (string | undefined)[]
  textSize: (number | undefined)[]
  default: { textColor: string; textSize: number }
  color: string
  profile: string
  nub: boolean
  ghost: boolean
  stepped: boolean
  decal: boolean
  sm?: string
  sb?: string
  st?: string
}

export interface LayoutMetadata {
  name: string
  author: string
  notes: string
  backcolor: string
  background?: unknown
  radii?: string
  switchMount?: string
  switchBrand?: string
  switchType?: string
  [property: string]: unknown
}

export interface Layout { meta: LayoutMetadata; keys: Key[] }
export type RawProperties = Record<string, unknown>
export type RawLayout = (RawProperties | (RawProperties | string)[])[]
export interface Bounds { x: number; y: number; width: number; height: number }

const metadataDefaults: LayoutMetadata = {
  name: '', author: '', notes: '', backcolor: '#eeeeee',
  radii: '', switchMount: '', switchBrand: '', switchType: '',
}
const labelMap = [
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1],
]
let sequence = 0

export function createKey(patch: Partial<Key> = {}): Key {
  return {
    x: 0, y: 0, x2: 0, y2: 0, width: 1, height: 1,
    width2: patch.width ?? 1, height2: patch.height ?? 1,
    rotation_angle: 0, rotation_x: 0, rotation_y: 0,
    color: '#cccccc', profile: '', nub: false, ghost: false, stepped: false, decal: false,
    sm: '', sb: '', st: '', ...patch,
    id: patch.id || globalThis.crypto?.randomUUID?.() || `key-${Date.now()}-${++sequence}`,
    labels: [...(patch.labels ?? [])], textColor: [...(patch.textColor ?? [])], textSize: [...(patch.textSize ?? [])],
    default: { textColor: '#000000', textSize: 3, ...patch.default },
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function number(value: unknown, property: string, positive = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive && value <= 0)) {
    throw new Error(`KLE property '${property}' must be a finite${positive ? ' positive' : ''} number.`)
  }
  return value
}

function string(value: unknown, property: string): string {
  if (typeof value !== 'string') throw new Error(`KLE property '${property}' must be text.`)
  return value
}

function boolean(value: unknown, property: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`KLE property '${property}' must be true or false.`)
  return value
}

function normalize<T>(values: T[], align: number): T[] {
  const result: T[] = []
  values.slice(0, 12).forEach((value, index) => {
    const slot = labelMap[align]![index]!
    if (slot >= 0) result[slot] = value
  })
  return result
}

/** Decode the stateful KLE row format into independent editable keys. */
export function deserialize(rows: unknown): Layout {
  if (!Array.isArray(rows)) throw new Error('A KLE layout must be an array of rows.')
  const current = createKey()
  const meta = { ...metadataDefaults }
  const keys: Key[] = []
  let clusterX = 0, clusterY = 0, align = 4
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row: unknown = rows[rowIndex]
    if (!Array.isArray(row)) {
      if (rowIndex !== 0 || !object(row)) throw new Error('Keyboard metadata must be an object before the first row.')
      for (const [property, value] of Object.entries(row)) {
        if (['name', 'author', 'notes', 'backcolor'].includes(property)) string(value, property)
        // defineProperty also treats an imported __proto__ as data, never as a setter.
        Object.defineProperty(meta, property, { value: structuredClone(value), writable: true, enumerable: true, configurable: true })
      }
      continue
    }
    for (let index = 0; index < row.length; index++) {
      const item: unknown = row[index]
      if (typeof item === 'string') {
        const labels = item.split('\n')
        if (labels.slice(12).some(Boolean)) throw new Error('A key can have at most 12 KLE legend positions.')
        const key = createKey({ ...current, id: undefined, width2: current.width2 || current.width, height2: current.height2 || current.height })
        key.labels = normalize(labels, align)
        key.textSize = normalize(current.textSize, align)
        for (let slot = 0; slot < 12; slot++) {
          if (!key.labels[slot] || !key.textSize[slot] || key.textSize[slot] === key.default.textSize) key.textSize[slot] = undefined
          if (!key.labels[slot] || !key.textColor[slot] || key.textColor[slot] === key.default.textColor) key.textColor[slot] = undefined
        }
        keys.push(key)
        current.x += current.width
        current.width = current.height = 1
        current.x2 = current.y2 = current.width2 = current.height2 = 0
        current.nub = current.stepped = current.decal = false
        continue
      }
      if (!object(item)) throw new Error(`Row ${rowIndex + 1} contains an invalid key or property object.`)
      for (const [raw, target] of [['r', 'rotation_angle'], ['rx', 'rotation_x'], ['ry', 'rotation_y']] as const) {
        if (item[raw] == null) continue
        if (index !== 0) throw new Error(`KLE '${raw}' can only appear at the beginning of a row.`)
        current[target] = number(item[raw], raw)
        if (raw === 'rx' || raw === 'ry') {
          if (raw === 'rx') clusterX = current.rotation_x
          else clusterY = current.rotation_y
          current.x = clusterX
          current.y = clusterY
        }
      }
      if (item.a != null) {
        align = number(item.a, 'a')
        if (!Number.isInteger(align) || align < 0 || align > 7) throw new Error("KLE alignment 'a' must be an integer from 0 to 7.")
      }
      if (item.f != null) { current.default.textSize = number(item.f, 'f', true); current.textSize = [] }
      if (item.f2 != null) {
        const size = number(item.f2, 'f2')
        if (size < 0) throw new Error("KLE property 'f2' cannot be negative.")
        for (let slot = 1; slot < 12; slot++) current.textSize[slot] = size
      }
      if (item.fa != null) {
        if (!Array.isArray(item.fa) || item.fa.length > 12) throw new Error("KLE property 'fa' must be an array of up to 12 font sizes.")
        current.textSize = item.fa.map((value, slot) => value == null ? undefined : number(value, `fa[${slot}]`))
        if (current.textSize.some(value => value !== undefined && value < 0)) throw new Error("KLE property 'fa' cannot contain negative sizes.")
      }
      for (const [raw, target] of [['p', 'profile'], ['c', 'color'], ['sm', 'sm'], ['sb', 'sb'], ['st', 'st']] as const) {
        if (item[raw] != null) current[target] = string(item[raw], raw)
      }
      if (item.t != null) {
        const colors = string(item.t, 't').split('\n')
        current.default.textColor = colors[0] || '#000000'
        current.textColor = normalize(colors, align)
      }
      for (const property of ['x', 'y'] as const) if (item[property] != null) current[property] += number(item[property], property)
      for (const [raw, target, secondary] of [['w', 'width', 'width2'], ['h', 'height', 'height2']] as const) {
        if (item[raw] != null) current[target] = current[secondary] = number(item[raw], raw, true)
      }
      for (const [raw, target] of [['x2', 'x2'], ['y2', 'y2'], ['w2', 'width2'], ['h2', 'height2']] as const) {
        if (item[raw] != null) current[target] = number(item[raw], raw, raw === 'w2' || raw === 'h2')
      }
      for (const [raw, target] of [['n', 'nub'], ['l', 'stepped'], ['d', 'decal'], ['g', 'ghost']] as const) {
        if (item[raw] != null) current[target] = boolean(item[raw], raw)
      }
    }
    current.y++
    current.x = current.rotation_x
  }
  return { meta, keys }
}

const rounded = (value: number) => Math.round(value * 1e8) / 1e8
const trimNewlines = (value: string) => value.replace(/\n+$/, '')

function orderedLabels(key: Key, currentSizes: (number | undefined)[]) {
  const align = [7, 5, 6, 4, 3, 1, 2, 0].find(candidate => key.labels.every((label, slot) => !label || labelMap[candidate]!.includes(slot))) ?? 0
  const labels = labelMap[align]!.map(slot => slot < 0 ? '' : key.labels[slot] || '')
  const colors = labelMap[align]!.map(slot => slot < 0 ? '' : key.textColor[slot] || '')
  const sizes = labelMap[align]!.map((slot, index) => {
    const size = labels[index] ? key.textSize[slot] : currentSizes[index]
    return !size || size === key.default.textSize ? 0 : size
  })
  // The first serialized color is also KLE's default. Preserve the appearance
  // of other legends if that first legend has an explicit color override.
  const firstColor = colors[0] || key.default.textColor
  colors[0] = firstColor
  for (let index = 1; index < 12; index++) {
    if (labels[index] && !colors[index] && firstColor !== key.default.textColor) colors[index] = key.default.textColor
  }
  return { align, labels, colors, sizes }
}

/** Produce portable KLE JSON; identities and editor state stay out of the file. */
export function serialize(layout: Layout): RawLayout {
  const rows: RawLayout = []
  const meta = Object.fromEntries(Object.entries(layout.meta).filter(([property, value]) => value !== undefined && value !== metadataDefaults[property]))
  if (Object.keys(meta).length) rows.push(structuredClone(meta))
  let row: (RawProperties | string)[] = []
  let x = 0, y = -1, newRow = true
  let rotation = 0, rotationX = 0, rotationY = 0
  let color = '#cccccc', textColor = '#000000', profile = '', sm = '', sb = '', st = '', ghost = false, align = 4, font = 3
  let sizes: (number | undefined)[] = []
  const sorted = [...layout.keys].sort((a, b) => ((a.rotation_angle % 360 + 360) % 360 - (b.rotation_angle % 360 + 360) % 360) || a.rotation_x - b.rotation_x || a.rotation_y - b.rotation_y || a.y - b.y || a.x - b.x)
  for (const key of sorted) {
    const props: RawProperties = {}
    const set = <T>(property: string, value: T, previous: T): T => { if (value !== previous) props[property] = value; return value }
    const clusterChanged = key.rotation_angle !== rotation || key.rotation_x !== rotationX || key.rotation_y !== rotationY
    if (row.length && (key.y !== y || clusterChanged)) { rows.push(row); row = []; newRow = true }
    if (newRow) {
      y++
      if (key.rotation_x !== rotationX || key.rotation_y !== rotationY) y = key.rotation_y
      x = key.rotation_x
      newRow = false
    }
    rotation = set('r', key.rotation_angle, rotation)
    rotationX = set('rx', key.rotation_x, rotationX)
    rotationY = set('ry', key.rotation_y, rotationY)
    set('y', rounded(key.y - y), 0)
    set('x', rounded(key.x - x), 0)
    y = key.y
    x = key.x + key.width
    const ordered = orderedLabels(key, sizes)
    color = set('c', key.color, color)
    textColor = set('t', trimNewlines(ordered.colors.join('\n')), textColor)
    ghost = set('g', key.ghost, ghost)
    profile = set('p', key.profile, profile)
    sm = set('sm', key.sm || '', sm)
    sb = set('sb', key.sb || '', sb)
    st = set('st', key.st || '', st)
    align = set('a', ordered.align, align)
    font = set('f', key.default.textSize, font)
    if (props.f !== undefined) sizes = []
    if (!ordered.labels.every((label, index) => !label || (sizes[index] || 0) === (ordered.sizes[index] || 0))) {
      if (!ordered.sizes.some(Boolean)) { props.f = font; sizes = [] }
      else if (!ordered.sizes[0] && ordered.sizes.slice(2).every(size => size === ordered.sizes[1])) {
        props.f2 = ordered.sizes[1]
        sizes = [0, ...Array<number>(11).fill(ordered.sizes[1]!)]
      } else {
        props.fa = [...ordered.sizes]
        sizes = [...ordered.sizes]
      }
    }
    set('w', key.width, 1)
    set('h', key.height, 1)
    set('w2', key.width2, key.width)
    set('h2', key.height2, key.height)
    set('x2', key.x2, 0)
    set('y2', key.y2, 0)
    set('n', key.nub, false)
    set('l', key.stepped, false)
    set('d', key.decal, false)
    if (Object.keys(props).length) row.push(props)
    row.push(trimNewlines(ordered.labels.join('\n')))
  }
  if (row.length) rows.push(row)
  return rows
}

/** Accept both a complete JSON document and the outer-bracket-free KLE editor format. */
export function parseLayout(text: string): Layout {
  const source = text.trim()
  if (!source) throw new Error('Paste or open a KLE JSON layout first.')
  let rows: unknown
  try { rows = JSON5.parse(source) }
  catch {
    try { rows = JSON5.parse(`[${source}]`) }
    catch (reason) { throw new Error(`Couldn’t read the JSON: ${(reason instanceof Error ? reason.message : String(reason)).replace(/^JSON5: /, '')}`) }
  }
  if (Array.isArray(rows) && rows.some(value => typeof value === 'string')) rows = [rows]
  return deserialize(rows)
}

export function stringifyLayout(layout: Layout, space = 2): string {
  return JSON.stringify(serialize(layout), null, space)
}

/** KLE's raw data as KLE's own editor shows it: the metadata, then one row of keys a line. */
export function stringifyRows(layout: Layout): string {
  const rows = serialize(layout)
  return rows.length ? `[\n${rows.map(row => `  ${JSON.stringify(row)}`).join(',\n')}\n]` : '[]'
}

export function keyBounds(key: Key): Bounds {
  const radians = key.rotation_angle * Math.PI / 180
  const cosine = Math.cos(radians), sine = Math.sin(radians)
  const rects = [
    { x: key.x, y: key.y, width: key.width, height: key.height },
    { x: key.x + key.x2, y: key.y + key.y2, width: key.width2, height: key.height2 },
  ]
  const corners = rects.flatMap(rect => [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x, rect.y + rect.height], [rect.x + rect.width, rect.y + rect.height]])
    .map(([x, y]) => ({ x: key.rotation_x + (x! - key.rotation_x) * cosine - (y! - key.rotation_y) * sine, y: key.rotation_y + (x! - key.rotation_x) * sine + (y! - key.rotation_y) * cosine }))
  const x = Math.min(...corners.map(point => point.x)), y = Math.min(...corners.map(point => point.y))
  return { x, y, width: Math.max(...corners.map(point => point.x)) - x, height: Math.max(...corners.map(point => point.y)) - y }
}

export function layoutBounds(layout: Layout): Bounds {
  if (!layout.keys.length) return { x: 0, y: 0, width: 0, height: 0 }
  const bounds = layout.keys.map(keyBounds)
  const x = Math.min(...bounds.map(box => box.x)), y = Math.min(...bounds.map(box => box.y))
  return { x, y, width: Math.max(...bounds.map(box => box.x + box.width)) - x, height: Math.max(...bounds.map(box => box.y + box.height)) - y }
}
