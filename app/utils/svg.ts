import type { Layout } from './layout'

type Key = Layout['keys'][number]
export const UNIT = 54
export const SYSTEM_FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
/** The keycap artwork's own strokes, shared by the editor and every export. */
export const KEYCAP_EDGE = '#52525b'
export const KEYCAP_TOP_EDGE = '#00000020'
export const KEYCAP_NUB = '#00000040'
export const PLATE_FALLBACK = '#f4f4f5'
type Point = { x: number; y: number }
type Rect = Point & { width: number; height: number }

export function escapeXml(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\ud800-\udfff]/gu, '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

export function safeColor(value: unknown, fallback = '#e5e7eb'): string {
  return typeof value === 'string' && /^(#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|[a-z]+)$/i.test(value.trim()) ? value.trim() : fallback
}

function lighten(color: string): string {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)
  if (!match) return color
  const hex = match[1]!.length === 3 ? [...match[1]!].map(value => value + value).join('') : match[1]!
  return '#' + [0, 2, 4].map(offset => Math.round(parseInt(hex.slice(offset, offset + 2), 16) * 0.88 + 255 * 0.12).toString(16).padStart(2, '0')).join('')
}

export function keyRects(key: Key): Rect[] {
  const primary = { x: key.x * UNIT, y: key.y * UNIT, width: key.width * UNIT, height: key.height * UNIT }
  if (key.x2 || key.y2 || key.width !== key.width2 || key.height !== key.height2) {
    return [primary, { x: (key.x + key.x2) * UNIT, y: (key.y + key.y2) * UNIT, width: key.width2 * UNIT, height: key.height2 * UNIT }]
  }
  return [primary]
}

function inset(rect: Rect, amount: number, offset = 0): Rect {
  return { x: rect.x + amount, y: rect.y + amount - offset, width: Math.max(1, rect.width - amount * 2), height: Math.max(1, rect.height - amount * 2) }
}

// Trace the union, so ISO and stepped caps have an outline without overlapping seams.
function outline(rects: Rect[], radius: number): string {
  const xs = [...new Set(rects.flatMap(rect => [rect.x, rect.x + rect.width]))].sort((a, b) => a - b)
  const ys = [...new Set(rects.flatMap(rect => [rect.y, rect.y + rect.height]))].sort((a, b) => a - b)
  const occupied = (x: number, y: number) => x >= 0 && y >= 0 && x < xs.length - 1 && y < ys.length - 1 && rects.some(rect => xs[x]! >= rect.x && xs[x + 1]! <= rect.x + rect.width && ys[y]! >= rect.y && ys[y + 1]! <= rect.y + rect.height)
  const edges: [Point, Point][] = []
  for (let y = 0; y < ys.length - 1; y++) {
    for (let x = 0; x < xs.length - 1; x++) {
      if (!occupied(x, y)) continue
      const left = xs[x]!, right = xs[x + 1]!, top = ys[y]!, bottom = ys[y + 1]!
      if (!occupied(x, y - 1)) edges.push([{ x: left, y: top }, { x: right, y: top }])
      if (!occupied(x + 1, y)) edges.push([{ x: right, y: top }, { x: right, y: bottom }])
      if (!occupied(x, y + 1)) edges.push([{ x: right, y: bottom }, { x: left, y: bottom }])
      if (!occupied(x - 1, y)) edges.push([{ x: left, y: bottom }, { x: left, y: top }])
    }
  }
  let path = ''
  while (edges.length) {
    const first = edges.shift()!
    const points = [first[0]]
    let end = first[1]
    while (end.x !== points[0]!.x || end.y !== points[0]!.y) {
      points.push(end)
      const index = edges.findIndex(edge => edge[0].x === end.x && edge[0].y === end.y)
      if (index < 0) break
      end = edges.splice(index, 1)[0]![1]
    }
    const corners = points.filter((point, index) => {
      const previous = points[(index + points.length - 1) % points.length]!, next = points[(index + 1) % points.length]!
      return (point.x - previous.x) * (next.y - point.y) !== (point.y - previous.y) * (next.x - point.x)
    })
    corners.forEach((point, index) => {
      const previous = corners[(index + corners.length - 1) % corners.length]!, next = corners[(index + 1) % corners.length]!
      const incoming = Math.hypot(point.x - previous.x, point.y - previous.y), outgoing = Math.hypot(next.x - point.x, next.y - point.y)
      const convex = (point.x - previous.x) * (next.y - point.y) - (point.y - previous.y) * (next.x - point.x) > 0
      const rounding = convex ? Math.min(radius, incoming / 2, outgoing / 2) : 0
      const before = { x: point.x - (point.x - previous.x) / incoming * rounding, y: point.y - (point.y - previous.y) / incoming * rounding }
      const after = { x: point.x + (next.x - point.x) / outgoing * rounding, y: point.y + (next.y - point.y) / outgoing * rounding }
      path += `${index ? 'L' : 'M'}${before.x},${before.y}Q${point.x},${point.y} ${after.x},${after.y}`
    })
    path += 'Z'
  }
  return path
}

export function rotatedPoint(key: Key, point: Point): Point {
  const radians = key.rotation_angle * Math.PI / 180
  const x = point.x - key.rotation_x * UNIT, y = point.y - key.rotation_y * UNIT
  return { x: key.rotation_x * UNIT + x * Math.cos(radians) - y * Math.sin(radians), y: key.rotation_y * UNIT + x * Math.sin(radians) + y * Math.cos(radians) }
}

export function pixelKeyBounds(key: Key) {
  const corners = keyRects(key).flatMap(rect => [
    rotatedPoint(key, rect), rotatedPoint(key, { x: rect.x + rect.width, y: rect.y }),
    rotatedPoint(key, { x: rect.x, y: rect.y + rect.height }), rotatedPoint(key, { x: rect.x + rect.width, y: rect.y + rect.height }),
  ])
  return { minX: Math.min(...corners.map(point => point.x)), minY: Math.min(...corners.map(point => point.y)), maxX: Math.max(...corners.map(point => point.x)), maxY: Math.max(...corners.map(point => point.y)) }
}

export function keyIntersectsRect(key: Key, box: Rect): boolean {
  const selection = [box, { x: box.x + box.width, y: box.y }, { x: box.x, y: box.y + box.height }, { x: box.x + box.width, y: box.y + box.height }]
  const angle = key.rotation_angle * Math.PI / 180
  const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: Math.cos(angle), y: Math.sin(angle) }, { x: -Math.sin(angle), y: Math.cos(angle) }]
  return keyRects(key).some(rect => {
    const corners = [rect, { x: rect.x + rect.width, y: rect.y }, { x: rect.x, y: rect.y + rect.height }, { x: rect.x + rect.width, y: rect.y + rect.height }].map(point => rotatedPoint(key, point))
    return axes.every(axis => {
      const cap = corners.map(point => point.x * axis.x + point.y * axis.y)
      const area = selection.map(point => point.x * axis.x + point.y * axis.y)
      return Math.max(...cap) >= Math.min(...area) && Math.max(...area) >= Math.min(...cap)
    })
  })
}

export function canvasFrame(layout: Layout, padding = 24) {
  const bounds = layout.keys.map(pixelKeyBounds)
  const x = Math.min(0, ...bounds.map(bound => bound.minX)) - padding
  const y = Math.min(0, ...bounds.map(bound => bound.minY)) - padding
  const right = Math.max(layout.keys.length ? 0 : UNIT * 12, ...bounds.map(bound => bound.maxX)) + padding
  const bottom = Math.max(layout.keys.length ? 0 : UNIT * 4, ...bounds.map(bound => bound.maxY)) + padding
  return { x, y, width: Math.max(UNIT + padding * 2, right - x), height: Math.max(UNIT + padding * 2, bottom - y) }
}

const profileOf = (key: Key) => /\b(SA|DSA|DCS|OEM|CHICKLET|FLAT)\b/i.exec(key.profile)?.[1]?.toUpperCase() ?? 'DCS'
const spacingOf = (profile: string) => profile === 'CHICKLET' ? 3 : 1

/** The cap's outline moved `distance` px outward: where a focus ring is drawn around it. */
export function keyRing(key: Key, distance: number): string {
  const spacing = spacingOf(profileOf(key))
  return outline(keyRects(key).map(rect => inset(rect, spacing - distance)), 4 + distance)
}

/** The cap's surfaces in its own coordinates: the outer outline, the top face, and the face's text area. */
function capFaces(key: Key) {
  const profile = profileOf(key)
  const spacing = spacingOf(profile)
  const bevel = profile === 'CHICKLET' || profile === 'FLAT' ? 1 : 5
  const offset = profile === 'DSA' ? 0 : profile === 'SA' ? 2 : profile === 'FLAT' || profile === 'CHICKLET' ? 0 : 3
  const rects = keyRects(key)
  const outer = rects.map(rect => inset(rect, spacing))
  const inner = (key.stepped ? rects.slice(0, 1) : rects).map(rect => inset(rect, spacing + bevel, offset))
  const primary = inner[0]!
  return { profile, rects, outer, inner, primary, text: inset(primary, 3) }
}

const ANCHORS = ['start', 'middle', 'end'] as const
export interface LegendSlot {
  slot: number
  /** The slot's anchor on its first line's baseline: its left, center or right. */
  x: number
  y: number
  size: number
  anchor: (typeof ANCHORS)[number]
  /**
   * Where a pointer finds the slot: a third of the face across and a line
   * high, so a blank slot, or one holding a single dot, is still a target.
   */
  area: Rect
}

/**
 * Every legend position the cap's profile draws, written or blank, in the
 * cap's own coordinates before its rotation. Flat and chiclet caps have no
 * front legends.
 */
export function legendSlots(key: Key): LegendSlot[] {
  const { profile, rects, text } = capFaces(key)
  const count = profile === 'FLAT' || profile === 'CHICKLET' ? 9 : 12
  return Array.from({ length: count }, (_, slot) => {
    const size = slot > 8 ? 10 : 6 + 2 * (key.textSize[slot] || key.default.textSize)
    const lines = (key.labels[slot] ?? '').split('\n').length
    const column = slot % 3, row = Math.floor(slot / 3)
    const x = column === 0 ? text.x : column === 1 ? text.x + text.width / 2 : text.x + text.width
    const y = row === 0 ? text.y + size * 0.8 : row === 1 ? text.y + text.height / 2 + size * 0.32 - (lines - 1) * size / 2 : row === 2 ? text.y + text.height - size * 0.2 - (lines - 1) * size : rects[0]!.y + rects[0]!.height - 4
    const width = Math.max(text.width / 3, size)
    const left = column === 0 ? x : column === 1 ? x - width / 2 : x - width
    return { slot, x, y, size, anchor: ANCHORS[column]!, area: { x: left, y: y - size * 0.9, width, height: size * 1.2 } }
  })
}

/**
 * The slot a point on the cap names, in the cap's own coordinates: a written
 * legend whose drawn text holds the point (`drawn`, by slot), else the slot
 * whose area is nearest, its center settling areas that overlap. Anywhere on
 * a cap names one of its legends.
 */
export function legendSlotAt(key: Key, point: Point, drawn: Partial<Record<number, Rect>> = {}): number {
  const slots = legendSlots(key)
  const holds = (rect: Rect) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
  const written = slots.find(({ slot }) => {
    const text = drawn[slot]
    return key.labels[slot] && text && holds(text)
  })
  if (written) return written.slot
  const gap = (rect: Rect) => Math.hypot(Math.max(rect.x - point.x, 0, point.x - rect.x - rect.width), Math.max(rect.y - point.y, 0, point.y - rect.y - rect.height))
  const offCenter = (rect: Rect) => Math.hypot(point.x - rect.x - rect.width / 2, point.y - rect.y - rect.height / 2)
  return slots.reduce((best, slot) => {
    const difference = gap(slot.area) - gap(best.area)
    return difference < 0 || (difference === 0 && offCenter(slot.area) < offCenter(best.area)) ? slot : best
  }).slot
}

/** A legend's color: its own, else the key's default for its legends. */
export function legendColor(key: Key, slot: number): string {
  return safeColor(key.textColor[slot] || key.default.textColor, '#111827')
}

export function keyGeometry(key: Key) {
  const { profile, rects, outer, inner, primary } = capFaces(key)
  const labels = key.ghost ? [] : legendSlots(key).flatMap(({ slot, x, y, size, anchor }) => {
    const value = key.labels[slot]
    if (!value) return []
    return [{ slot, lines: value.split('\n'), x, y, size, color: legendColor(key, slot), anchor }]
  })
  const color = safeColor(key.color)
  return { outer: outline(outer, 4), inner: outline(inner, profile === 'DSA' ? 7 : 3), hit: outline(rects, 0), color, topColor: lighten(color), labels, transform: `rotate(${key.rotation_angle} ${key.rotation_x * UNIT} ${key.rotation_y * UNIT})`, nub: { x1: primary.x + primary.width / 2 - 5, x2: primary.x + primary.width / 2 + 5, y: primary.y + primary.height - 4 } }
}

export function layoutToSvg(layout: Layout): string {
  const frame = canvasFrame(layout)
  const keys = layout.keys.map((key, index) => {
    const shape = keyGeometry(key), clipId = `legend-${index}`
    const cap = key.decal ? '' : `<path d="${shape.outer}" fill="${shape.color}" stroke="${KEYCAP_EDGE}" stroke-width="1"${key.ghost ? ' stroke-dasharray="3 3"' : ''}/>${key.ghost ? '' : `<path d="${shape.inner}" fill="${shape.topColor}" stroke="${KEYCAP_TOP_EDGE}" stroke-width="0.8"/>`}`
    const labels = shape.labels.map(label => `<text x="${label.x}" y="${label.y}" text-anchor="${label.anchor}" font-size="${label.size}" fill="${label.color}">${label.lines.map((line, lineIndex) => `<tspan x="${label.x}" dy="${lineIndex ? label.size : 0}">${escapeXml(line)}</tspan>`).join('')}</text>`).join('')
    const nub = key.nub && !key.ghost && !key.decal ? `<line x1="${shape.nub.x1}" x2="${shape.nub.x2}" y1="${shape.nub.y}" y2="${shape.nub.y}" stroke="${KEYCAP_NUB}" stroke-width="2" stroke-linecap="round"/>` : ''
    return `<g transform="${shape.transform}"${key.ghost ? ' opacity="0.45"' : ''}><defs><clipPath id="${clipId}"><path d="${shape.hit}"/></clipPath></defs>${cap}<g clip-path="url(#${clipId})">${labels}${nub}</g></g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}" font-family="${escapeXml(SYSTEM_FONT)}"><title>${escapeXml(layout.meta.name || 'Keyboard layout')}</title><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="${safeColor(layout.meta.backcolor, PLATE_FALLBACK)}"/>${keys}</svg>`
}
