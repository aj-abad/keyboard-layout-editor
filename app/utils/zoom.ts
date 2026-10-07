/** A stage's zoom: fitted to the stage, or a scale where 1 draws a unit at 54px. */
export type Zoom = number | 'fit'

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4
/** Fitting never enlarges a small layout past this. */
export const FIT_MAX = 2
/** The scales the zoom buttons and chords step through. */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const

export const clampScale = (scale: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale))

export function isZoom(value: unknown): value is Zoom {
  return value === 'fit' || (typeof value === 'number' && Number.isFinite(value) && value >= ZOOM_MIN && value <= ZOOM_MAX)
}

/** The next step up or down from the scale on screen, which may sit between steps. */
export function stepZoom(scale: number, direction: 1 | -1): number {
  const epsilon = 0.001
  const next = direction > 0
    ? ZOOM_STEPS.find(step => step > scale + epsilon)
    : [...ZOOM_STEPS].reverse().find(step => step < scale - epsilon)
  return next ?? (direction > 0 ? ZOOM_MAX : ZOOM_MIN)
}

/** The scale that fits a frame inside a box, inset on every side. */
export function fitScale(frame: { width: number; height: number }, box: { width: number; height: number }, inset: number) {
  const width = Math.max(1, box.width - inset * 2), height = Math.max(1, box.height - inset * 2)
  return Math.max(0.1, Math.min(FIT_MAX, width / frame.width, height / frame.height))
}

/** The scale as people read it: “75%”. */
export const formatScale = (scale: number) => `${Math.round(scale * 100)}%`
