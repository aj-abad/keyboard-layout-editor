import assert from 'node:assert/strict'
import test from 'node:test'
import type { Layout } from '../app/utils/layout'
import { canvasFrame, escapeXml, keyGeometry, keyIntersectsRect, keyRects, layoutToSvg, legendSlotAt, legendSlots, pixelKeyBounds, UNIT } from '../app/utils/svg'

function key(overrides: Partial<Layout['keys'][number]> = {}): Layout['keys'][number] {
  return { id: 'test-key', x: 0, y: 0, x2: 0, y2: 0, width: 1, height: 1, width2: 1, height2: 1, rotation_angle: 0, rotation_x: 0, rotation_y: 0, labels: ['A'], textColor: [], textSize: [], default: { textColor: '#111111', textSize: 3 }, color: '#cccccc', profile: '', nub: false, ghost: false, stepped: false, decal: false, ...overrides }
}

function layout(...keys: Layout['keys'][number][]): Layout {
  return { meta: { name: 'Test', author: '', notes: '', backcolor: '#f4f4f5' }, keys } as Layout
}

test('SVG renders legend content as escaped text with system fonts and no external assets', () => {
  const output = layoutToSvg(layout(key({ labels: ['<script>alert("x")</script> & <img src="https://example.com/a.png">'] })))
  assert.ok(output.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;img'))
  assert.ok(output.includes('system-ui'))
  assert.ok(!/<script|<image|<img|@font-face|href=/.test(output))
  assert.equal(escapeXml('A\u0000\u000b\ud800😀<&'), 'A😀&lt;&amp;')
})

test('SVG does not allow injected fill attributes or background URLs', () => {
  const value = layout(key({ color: '"><image href="https://example.com/a"/>', textColor: ['url(https://example.com/b)'] }))
  value.meta.backcolor = 'url(https://example.com/c)'
  const output = layoutToSvg(value)
  assert.ok(!output.includes('example.com'))
  assert.ok(output.includes('fill="#e5e7eb"'))
  assert.ok(output.includes('fill="#f4f4f5"'))
})

test('secondary rectangles and rotation both contribute to visible bounds', () => {
  const cap = key({ x: 1, y: 2, x2: -0.25, width2: 1.5, rotation_angle: 90 })
  assert.deepEqual(keyRects(cap), [{ x: 54, y: 108, width: 54, height: 54 }, { x: 40.5, y: 108, width: 81, height: 54 }])
  const bounds = pixelKeyBounds(cap)
  assert.ok(Math.abs(bounds.minX + 162) < 1e-8)
  assert.ok(Math.abs(bounds.maxX + 108) < 1e-8)
  assert.ok(Math.abs(bounds.minY - 40.5) < 1e-8)
  assert.ok(Math.abs(bounds.maxY - 121.5) < 1e-8)
  const frame = canvasFrame(layout(cap))
  assert.ok(frame.x < bounds.minX && frame.y < bounds.minY)
  assert.ok(frame.x + frame.width > bounds.maxX && frame.y + frame.height > bounds.maxY)
  assert.ok(layoutToSvg(layout(cap)).includes('transform="rotate(90 0 0)"'))
})

test('marquee selection uses the rotated cap footprint instead of its bounding-box corners', () => {
  const cap = key({ rotation_angle: 45 })
  assert.equal(keyIntersectsRect(cap, { x: 30, y: 2, width: 4, height: 4 }), false)
  assert.equal(keyIntersectsRect(cap, { x: -3, y: 35, width: 6, height: 6 }), true)
  const iso = key({ width: 1.25, height: 2, x2: -0.25, width2: 1.5 })
  assert.equal(keyIntersectsRect(iso, { x: -12, y: 12, width: 4, height: 4 }), true)
  assert.equal(keyIntersectsRect(iso, { x: -12, y: 75, width: 4, height: 4 }), false)
})

test('all 12 KLE legend slots keep their normalized positions and colors', () => {
  const shape = keyGeometry(key({ labels: Array.from({ length: 12 }, (_, index) => `slot-${index}`), textColor: Array(12).fill('#123456'), textSize: Array(12).fill(2) }))
  assert.equal(shape.labels.length, 12)
  assert.deepEqual(shape.labels.map(label => label.anchor), ['start', 'middle', 'end', 'start', 'middle', 'end', 'start', 'middle', 'end', 'start', 'middle', 'end'])
  assert.ok(shape.labels[0]!.y < shape.labels[3]!.y)
  assert.ok(shape.labels[3]!.y < shape.labels[6]!.y)
  assert.ok(shape.labels[6]!.y < shape.labels[9]!.y)
  assert.equal(shape.labels[0]!.size, 10)
  assert.equal(shape.labels[9]!.size, 10)
  assert.ok(shape.labels.every(label => label.color === '#123456'))
})

test('stepped caps retain their full footprint while ghost keys hide legends', () => {
  const regular = key({ width: 1.25, height: 2, x2: -0.25, width2: 1.5 })
  const stepped = key({ ...regular, stepped: true })
  assert.equal(keyGeometry(regular).outer, keyGeometry(stepped).outer)
  assert.notEqual(keyGeometry(regular).inner, keyGeometry(stepped).inner)
  assert.deepEqual(keyGeometry(key({ ghost: true })).labels, [])
  assert.ok(layoutToSvg(layout(key({ decal: true, labels: ['DECAL'] }))).includes('DECAL'))
  const empty = canvasFrame(layout())
  assert.ok(empty.width >= UNIT && empty.height >= UNIT)
})

test('every legend slot has a place to find it, written or blank', () => {
  const blank = key({ labels: [], width: 2 })
  const slots = legendSlots(blank)
  assert.equal(slots.length, 12)
  const third = (slots[2]!.x - slots[0]!.x) / 3
  for (const slot of slots) {
    assert.ok(slot.area.width >= third && slot.area.height > 0, `slot ${slot.slot} has room`)
    assert.ok(slot.area.x <= slot.x && slot.x <= slot.area.x + slot.area.width, `slot ${slot.slot} holds its anchor`)
  }
  // Left, center and right areas in a row don't overlap.
  assert.ok(slots[0]!.area.x + slots[0]!.area.width <= slots[1]!.area.x + 0.001)
  assert.ok(slots[1]!.area.x + slots[1]!.area.width <= slots[2]!.area.x + 0.001)
  // A written legend is drawn where its slot says.
  const mid = key({ labels: ['', '', '', '', 'Mid'] })
  const written = keyGeometry(mid).labels[0]!
  assert.deepEqual([written.x, written.y], [legendSlots(mid)[4]!.x, legendSlots(mid)[4]!.y])
  assert.equal(legendSlots(key({ profile: 'FLAT' })).length, 9)
})

test('a point on a cap names the legend under it, or the nearest slot', () => {
  const cap = key({ labels: [], width: 2 })
  const slots = legendSlots(cap)
  const center = (slot: number) => {
    const { area } = slots[slot]!
    return { x: area.x + area.width / 2, y: area.y + area.height / 2 }
  }
  // Every blank slot answers at its own center.
  for (const { slot } of slots) assert.equal(legendSlotAt(cap, center(slot)), slot)
  // The cap's corner, outside every area, names the nearest one.
  assert.equal(legendSlotAt(cap, { x: 1, y: 1 }), 0)
  assert.equal(legendSlotAt(cap, { x: 107, y: 53 }), 11)
  // A long legend's text takes the point from the blank slot it runs over.
  const long = key({ labels: ['Backspace'], width: 2 })
  const text = { x: slots[0]!.x, y: slots[0]!.area.y, width: 70, height: slots[0]!.area.height }
  assert.equal(legendSlotAt(long, center(1), { 0: text }), 0)
  assert.equal(legendSlotAt(long, center(1)), 1)
  // Text drawn for a slot that is blank (a stale measure) is not a legend.
  assert.equal(legendSlotAt(cap, center(1), { 0: text }), 1)
})
