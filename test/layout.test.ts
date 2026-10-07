import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createKey, deserialize, keyBounds, layoutBounds, parseLayout, serialize, stringifyLayout, stringifyRows } from '../app/utils/layout'
import type { Key, Layout } from '../app/utils/layout'

const maps = [
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1],
]

function appearance(key: Key) {
  const { id: _id, labels: _labels, textColor: _colors, textSize: _sizes, default: _default, ...geometry } = key
  return {
    // KLE offsets are decimal; equivalent row grouping can change float tails.
    ...Object.fromEntries(Object.entries(geometry).map(([property, value]) => [property, typeof value === 'number' ? Math.round(value * 1e8) / 1e8 : value])),
    legends: Array.from({ length: 12 }, (_, slot) => key.labels[slot] ? {
      text: key.labels[slot], color: key.textColor[slot] || key.default.textColor, size: key.textSize[slot] || key.default.textSize,
    } : null),
  }
}

function assertRoundtrip(layout: Layout) {
  const beforeIds = layout.keys.map(key => key.id)
  const after = parseLayout(stringifyLayout(layout))
  assert.deepEqual(after.meta, layout.meta)
  const sort = (keys: Key[]) => keys.map(appearance).sort((a, b) => a.rotation_angle - b.rotation_angle || a.rotation_x - b.rotation_x || a.rotation_y - b.rotation_y || a.y - b.y || a.x - b.x)
  assert.deepEqual(sort(after.keys), sort(layout.keys))
  assert.deepEqual(layout.keys.map(key => key.id), beforeIds, 'export must not reorder editor keys')
  return after
}

test('every retained preset imports and roundtrips without geometry or legend loss', () => {
  const presets = JSON.parse(readFileSync(new URL('../app/data/layouts.json', import.meta.url), 'utf8')).presets as { name: string; data: unknown }[]
  assert.ok(presets.length > 5)
  for (const preset of presets) {
    const layout = deserialize(preset.data)
    try { assertRoundtrip(layout) }
    catch (reason) { throw new Error(`Preset ${preset.name}: ${reason instanceof Error ? reason.message : reason}`) }
    assert.equal(new Set(layout.keys.map(key => key.id)).size, layout.keys.length)
  }
})

test('the JSON tool’s one-row-a-line text reads back as the same layout', () => {
  const presets = JSON.parse(readFileSync(new URL('../app/data/layouts.json', import.meta.url), 'utf8')).presets as { name: string; data: unknown }[]
  for (const preset of presets) {
    const layout = deserialize(preset.data)
    const text = stringifyRows(layout)
    const rows = serialize(layout).length
    assert.equal(text.split('\n').length, rows ? rows + 2 : 1, `${preset.name}: one line a row`)
    assert.equal(stringifyLayout(parseLayout(text)), stringifyLayout(layout), preset.name)
  }
  assert.equal(stringifyRows(deserialize([])), '[]')
})

test('all eight KLE alignments normalize legend positions, font sizes, and individual colors', () => {
  for (let align = 0; align < 8; align++) {
    const labels = maps[align]!.map((slot, index) => slot >= 0 ? `label-${index}` : '')
    const colors = Array.from({ length: 12 }, (_, index) => `#${(index + 1).toString(16).repeat(6)}`)
    const layout = deserialize([[{ a: align, f: 20, fa: Array.from({ length: 12 }, (_, index) => index + 1), t: colors.join('\n') }, labels.join('\n')]])
    const key = layout.keys[0]!
    maps[align]!.forEach((slot, index) => {
      if (slot < 0) return
      assert.equal(key.labels[slot], `label-${index}`)
      assert.equal(key.textSize[slot] || key.default.textSize, index + 1)
      assert.equal(key.textColor[slot] || key.default.textColor, colors[index])
    })
    assertRoundtrip(layout)
  }
})

test('inherited styles, f2, fa zero/default entries and f resets survive consecutive keys', () => {
  const layout = deserialize([[
    { a: 5, f: 7, f2: 5, c: '#333333', t: '#fafafa\n#ff0000', p: 'SA R1', sm: 'MX', sb: 'Cherry', st: 'Blue' }, '!\n1',
    { f: 9, f2: 7 }, '"\n2',
    { f: 3 }, '#\n3',
    { a: 0, fa: [0, 2, null, 4, 0, 6] }, 'A\nB\nC\nD\nE\nF',
    { p: '', sm: '', sb: '', st: '', t: '#000000', g: true }, 'G',
    { g: false, f: 3 }, 'H',
  ]])
  assert.equal(layout.keys[0]!.textSize[1] || layout.keys[0]!.default.textSize, 7)
  assert.equal(layout.keys[0]!.textSize[7] || layout.keys[0]!.default.textSize, 5)
  assert.equal(layout.keys[2]!.textSize[7] || layout.keys[2]!.default.textSize, 3)
  assert.equal(layout.keys[3]!.textSize[2], undefined)
  assert.equal(layout.keys[4]!.profile, '')
  assert.equal(layout.keys[4]!.ghost, true)
  assert.equal(layout.keys[5]!.ghost, false)
  assertRoundtrip(layout)
})

test('rotation clusters reset x/y on rx and ry while r alone keeps row placement', () => {
  const layout = deserialize([
    [{ r: 15, rx: 4, ry: 2, x: .25, y: .5 }, 'A', 'B'],
    ['C'],
    [{ r: -30, rx: 8 }, 'D'],
    [{ ry: 5, x: -.5 }, 'E'],
    [{ r: 0 }, 'F'],
    [{ rx: 0, ry: 0 }, 'G'],
  ])
  assert.deepEqual(layout.keys.map(key => [key.x, key.y, key.rotation_angle, key.rotation_x, key.rotation_y]), [
    [4.25, 2.5, 15, 4, 2], [5.25, 2.5, 15, 4, 2], [4, 3.5, 15, 4, 2],
    [8, 2, -30, 8, 2], [7.5, 5, -30, 8, 5], [8, 6, 0, 8, 5], [0, 0, 0, 0, 0],
  ])
  assertRoundtrip(layout)
})

test('secondary shape and one-key flags reset while ghost and profile persist', () => {
  const layout = deserialize([[
    { w: 1.25, h: 2, x2: -.25, w2: 1.5, h2: 1, n: true, l: true, d: true, g: true, p: 'DCS' }, 'Enter', 'Next',
  ]])
  const [first, next] = layout.keys
  assert.deepEqual([first!.width, first!.height, first!.x2, first!.width2, first!.height2], [1.25, 2, -.25, 1.5, 1])
  assert.deepEqual([next!.width, next!.height, next!.x2, next!.width2, next!.height2], [1, 1, 0, 1, 1])
  assert.equal(next!.nub || next!.stepped || next!.decal, false)
  assert.equal(next!.ghost, true)
  assert.equal(next!.profile, 'DCS')
  assertRoundtrip(layout)
})

test('JSON5 imports comments, unquoted properties, trailing commas and raw rows safely', () => {
  const full = parseLayout(`[
    {name:'Personal', notes:'Keep me', custom:{version:1},},
    // Raw KLE syntax is data, not code.
    [{w:1.5}, 'Tab', 'Q',],
    ['A', 'S'],
  ]`)
  assert.equal(full.meta.name, 'Personal')
  assert.deepEqual(full.meta.custom, { version: 1 })
  assert.deepEqual(parseLayout(`{name:'Personal', notes:'Keep me', custom:{version:1}}, [{w:1.5}, 'Tab','Q'], ['A','S'],`).keys.map(appearance), full.keys.map(appearance))
  assert.equal(parseLayout(`[{w:2}, 'One row',]`).keys[0]!.width, 2)
  assert.equal(parseLayout('[]').keys.length, 0)
  assert.throws(() => parseLayout('[[(()=>{globalThis.__kleExecuted=true})()]]'))
  assert.equal((globalThis as Record<string, unknown>).__kleExecuted, undefined)
})

test('metadata remains portable and prototype-shaped keys cannot mutate object prototypes', () => {
  const layout = parseLayout('[{"name":"Imported","background":{"name":"linen","style":"url(a)"},"css":"body{}","__proto__":{"polluted":true}},["A"]]')
  assert.deepEqual(layout.meta.background, { name: 'linen', style: 'url(a)' })
  assert.equal(layout.meta.css, 'body{}')
  assert.equal(Object.getPrototypeOf(layout.meta), Object.prototype)
  assert.equal(({} as Record<string, unknown>).polluted, undefined)
  assertRoundtrip(layout)
})

test('export preserves whitespace, strips editor IDs and does not mutate key order', () => {
  const layout = deserialize([['A', 'B']])
  layout.keys[0]!.labels[0] = '  padded  '
  layout.keys.reverse()
  const ids = layout.keys.map(key => key.id)
  const text = stringifyLayout(layout)
  assert.ok(!text.includes('"id"'))
  assert.deepEqual(layout.keys.map(key => key.id), ids)
  assert.equal(parseLayout(text).keys[0]!.labels[0], '  padded  ')
  assertRoundtrip(layout)
})

test('explicit color on the first legend preserves the other legends default appearance', () => {
  const layout = deserialize([[{ a: 0 }, 'A\nB\nC\nD\nE\nF\nG\nH\nI\nJ\nK\nL']])
  layout.keys[0]!.textColor[0] = '#ff0000'
  assertRoundtrip(layout)
})

test('invalid dimensions, alignment, rows and rotation positions fail with useful errors', () => {
  for (const input of ['[[{w:0},"A"]]', '[[{h:-1},"A"]]', '[[{x:Infinity},"A"]]', '[[{a:8},"A"]]', '[[null]]', '[[],{}]', '[["A",{r:15},"B"]]', '[[{fa:"large"},"A"]]']) {
    assert.throws(() => parseLayout(input))
  }
  assert.throws(() => parseLayout(''), /Paste or open/)
  assert.throws(() => deserialize({ keys: [] }), /array of rows/)
})

test('bounds include secondary rectangles, rotation origins and negative coordinates', () => {
  const key = createKey({ x: 1, y: 2, x2: -.25, width2: 1.5, rotation_angle: 90 })
  const box = keyBounds(key)
  for (const [property, expected] of Object.entries({ x: -3, y: .75, width: 1, height: 1.5 })) assert.ok(Math.abs(box[property as keyof typeof box] - expected) < 1e-8)
  assert.deepEqual(layoutBounds(deserialize([])), { x: 0, y: 0, width: 0, height: 0 })
  const layout = deserialize([])
  layout.keys = [key, createKey({ x: 4, y: 5 })]
  const bounds = layoutBounds(layout)
  assert.ok(Math.abs(bounds.x + 3) < 1e-8)
  assert.ok(Math.abs(bounds.width - 8) < 1e-8)
  assert.ok(Math.abs(bounds.height - 5.25) < 1e-8)
})

test('new keys clone arrays/defaults, fit dimensions and generate independent IDs', () => {
  const source = createKey({ width: 2, height: 1.5, labels: ['A'] })
  const copy = createKey({ ...source, id: undefined })
  assert.equal(source.width2, 2)
  assert.equal(source.height2, 1.5)
  assert.notEqual(source.id, copy.id)
  copy.labels[0] = 'B'
  copy.default.textSize = 5
  assert.equal(source.labels[0], 'A')
  assert.equal(source.default.textSize, 3)
  assert.deepEqual(serialize(deserialize([])), [])
})
