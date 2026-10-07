/** KLE's twelve legend slots in its order: the face's three rows, then the front. */
export const LEGEND_SLOTS = [
  { index: 0, name: 'Top left', align: 'text-left' },
  { index: 1, name: 'Top center', align: 'text-center' },
  { index: 2, name: 'Top right', align: 'text-right' },
  { index: 3, name: 'Center left', align: 'text-left' },
  { index: 4, name: 'Center', align: 'text-center' },
  { index: 5, name: 'Center right', align: 'text-right' },
  { index: 6, name: 'Bottom left', align: 'text-left' },
  { index: 7, name: 'Bottom center', align: 'text-center' },
  { index: 8, name: 'Bottom right', align: 'text-right' },
  { index: 9, name: 'Front left', align: 'text-left' },
  { index: 10, name: 'Front center', align: 'text-center' },
  { index: 11, name: 'Front right', align: 'text-right' },
] as const

/** A slot's accessible name, as its field in the inspector is called. */
export const legendName = (index: number) => `${LEGEND_SLOTS[index]?.name ?? 'Top left'} legend`
