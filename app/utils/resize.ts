import type { Key } from './layout'

export type ResizeEdge = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type KeyGeometryPatch = Pick<Key, 'x' | 'y' | 'x2' | 'y2' | 'width' | 'height' | 'width2' | 'height2'>

const round = (value: number) => Math.round(value * 1e6) / 1e6
const snap = (value: number) => Math.round(value * 4) / 4

/** The union's bounds in the key's unrotated layout coordinates, in units. */
export function keyResizeBounds(key: Key) {
  const x = key.x + Math.min(0, key.x2)
  const y = key.y + Math.min(0, key.y2)
  return {
    x, y,
    width: Math.max(key.width, key.x2 + key.width2) - Math.min(0, key.x2),
    height: Math.max(key.height, key.y2 + key.height2) - Math.min(0, key.y2),
  }
}

/** Resize from the original key and a canvas-space drag. Preview never accumulates rounding. */
export function resizeKeyGeometry(key: Key, edge: ResizeEdge, dx: number, dy: number): KeyGeometryPatch {
  const unchanged = { x: key.x, y: key.y, x2: key.x2, y2: key.y2, width: key.width, height: key.height, width2: key.width2, height2: key.height2 }
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return unchanged
  const angle = key.rotation_angle * Math.PI / 180
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle)
  const localY = -dx * Math.sin(angle) + dy * Math.cos(angle)
  const bounds = keyResizeBounds(key)
  const left = edge.includes('left'), right = edge.includes('right')
  const top = edge.includes('top'), bottom = edge.includes('bottom')
  const dw = left ? snap(-localX) : right ? snap(localX) : 0
  const dh = top ? snap(-localY) : bottom ? snap(localY) : 0
  if (!dw && !dh) return unchanged
  // Scale both rectangles together: steps and ISO cutouts retain their proportions.
  // The minimum keeps even the narrower secondary rectangle at least a quarter unit.
  const minWidth = bounds.width * .25 / Math.min(key.width, key.width2)
  const minHeight = bounds.height * .25 / Math.min(key.height, key.height2)
  const width = dw ? Math.max(minWidth, round(bounds.width + dw)) : bounds.width
  const height = dh ? Math.max(minHeight, round(bounds.height + dh)) : bounds.height
  if (width === bounds.width && height === bounds.height) return unchanged
  const scaleX = width / bounds.width, scaleY = height / bounds.height
  const x = bounds.x + (left ? bounds.width - width : 0)
  const y = bounds.y + (top ? bounds.height - height : 0)
  return {
    x: scaleX === 1 ? key.x : round(x + (key.x - bounds.x) * scaleX),
    y: scaleY === 1 ? key.y : round(y + (key.y - bounds.y) * scaleY),
    x2: scaleX === 1 ? key.x2 : round(key.x2 * scaleX), y2: scaleY === 1 ? key.y2 : round(key.y2 * scaleY),
    width: scaleX === 1 ? key.width : round(key.width * scaleX), height: scaleY === 1 ? key.height : round(key.height * scaleY),
    width2: scaleX === 1 ? key.width2 : round(key.width2 * scaleX), height2: scaleY === 1 ? key.height2 : round(key.height2 * scaleY),
  }
}

/** Match the pointer cursor to the handle's screen orientation, including rotated caps. */
export function resizeCursor(edge: ResizeEdge, angle: number) {
  const direction = edge === 'left' || edge === 'right' ? 0
    : edge === 'top' || edge === 'bottom' ? 90
      : edge === 'top-left' || edge === 'bottom-right' ? 45 : 135
  const index = ((Math.round((angle + direction) / 45) % 4) + 4) % 4
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][index]!
}
