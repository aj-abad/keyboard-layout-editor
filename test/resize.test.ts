import assert from 'node:assert/strict'
import test from 'node:test'
import { createKey } from '../app/utils/layout'
import { keyResizeBounds, resizeCursor, resizeKeyGeometry } from '../app/utils/resize'
import type { ResizeEdge } from '../app/utils/resize'

test('all edges and corners snap to quarter units and anchor their opposite edges', () => {
  const key = createKey({ x: 2, y: 3, width: 1.5, height: 2 })
  const cases: [ResizeEdge, number, number, number, number, number, number][] = [
    ['right', .38, 5, 2, 3, 2, 2],
    ['left', -.38, 5, 1.5, 3, 2, 2],
    ['bottom', 5, .38, 2, 3, 1.5, 2.5],
    ['top', 5, -.38, 2, 2.5, 1.5, 2.5],
    ['top-left', -.38, -.38, 1.5, 2.5, 2, 2.5],
    ['top-right', .38, -.38, 2, 2.5, 2, 2.5],
    ['bottom-left', -.38, .38, 1.5, 3, 2, 2.5],
    ['bottom-right', .38, .38, 2, 3, 2, 2.5],
  ]
  for (const [edge, dx, dy, x, y, width, height] of cases) {
    const actual = resizeKeyGeometry(key, edge, dx, dy)
    assert.deepEqual(actual, { x, y, x2: 0, y2: 0, width, height, width2: width, height2: height })
  }
  assert.equal(key.width, 1.5)
  assert.equal(key.height, 2)
})

test('shrinking cannot invert the cap and left/top keep the original opposite corner', () => {
  const key = createKey({ x: 2, y: 3, width: 1.5, height: 2 })
  const actual = resizeKeyGeometry(key, 'top-left', 10, 10)
  assert.deepEqual(actual, { x: 3.25, y: 4.75, x2: 0, y2: 0, width: .25, height: .25, width2: .25, height2: .25 })
  assert.equal(actual.x + actual.width, key.x + key.width)
  assert.equal(actual.y + actual.height, key.y + key.height)
})

test('rotated keys convert the screen drag into their local resize axis', () => {
  const key = createKey({ x: 2, y: 3, rotation_angle: 90, rotation_x: 1, rotation_y: 1 })
  const right = resizeKeyGeometry(key, 'right', 0, .5)
  assert.equal(right.width, 1.5)
  assert.equal(right.height, 1)
  const top = resizeKeyGeometry(key, 'top', .5, 0)
  assert.equal(top.height, 1.5)
  assert.equal(top.y, 2.5)
  assert.equal(key.rotation_x, 1)
  assert.equal(key.rotation_y, 1)
  assert.equal(resizeCursor('right', 90), 'ns-resize')
  assert.equal(resizeCursor('top-left', -90), 'nesw-resize')
})

test('ISO and stepped union rectangles scale together without flattening their cutouts', () => {
  const key = createKey({ x: 2, y: 3, width: 1.25, height: 2, x2: -.25, y2: 0, width2: 1.5, height2: 1, stepped: true })
  const originalBounds = keyResizeBounds(key)
  const actual = resizeKeyGeometry(key, 'top-left', -.5, -.5)
  const nextBounds = keyResizeBounds({ ...key, ...actual })
  assert.equal(nextBounds.x + nextBounds.width, originalBounds.x + originalBounds.width)
  assert.equal(nextBounds.y + nextBounds.height, originalBounds.y + originalBounds.height)
  assert.equal(nextBounds.width, 2)
  assert.equal(nextBounds.height, 2.5)
  assert.equal(actual.x2, -.333333)
  assert.equal(actual.width2, 2)
  assert.equal(actual.height2, 1.25)
  assert.notEqual(actual.width, actual.width2)
  assert.notEqual(actual.height, actual.height2)
  const smallest = resizeKeyGeometry(key, 'bottom-right', -10, -10)
  assert.ok(Math.min(smallest.width, smallest.width2, smallest.height, smallest.height2) >= .25)
})

test('no-op drags retain exact imported geometry and invalid deltas do not resize', () => {
  const key = createKey({ width: 1, x2: .95, width2: .25, height: .333333333, height2: .333333333 })
  const geometry = { x: key.x, y: key.y, x2: key.x2, y2: key.y2, width: key.width, height: key.height, width2: key.width2, height2: key.height2 }
  assert.deepEqual(resizeKeyGeometry(key, 'right', 0, 1), geometry)
  assert.deepEqual(resizeKeyGeometry(key, 'right', .05, 1), geometry)
  assert.deepEqual(resizeKeyGeometry(key, 'right', Number.NaN, 0), geometry)
  const precise = createKey({ x: 1.111111111, width: 1.23456789, width2: 1.23456789 })
  const expected = { x: precise.x, y: precise.y, x2: precise.x2, y2: precise.y2, width: precise.width, height: precise.height, width2: precise.width2, height2: precise.height2 }
  assert.deepEqual(resizeKeyGeometry(precise, 'right', 0, 1), expected)
  assert.deepEqual(resizeKeyGeometry(precise, 'bottom', 0, .5), { ...expected, height: 1.5, height2: 1.5 })
})
