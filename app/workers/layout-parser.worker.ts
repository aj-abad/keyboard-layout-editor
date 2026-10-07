import { parseLayout } from '../utils/layout'
import { MAX_LAYOUT_BYTES } from '../utils/layout-parser'
import type { LayoutParserRequest, LayoutParserResponse } from '../utils/layout-parser'

const scope = globalThis as unknown as {
  addEventListener: (type: 'message', listener: (event: MessageEvent<LayoutParserRequest>) => void) => void
  postMessage: (response: LayoutParserResponse) => void
}

scope.addEventListener('message', async ({ data: { id, input } }) => {
  try {
    const size = typeof input === 'string' ? new Blob([input]).size : input.size
    if (size > MAX_LAYOUT_BYTES) throw new Error('Layout JSON must be 5 MB or smaller.')
    const text = typeof input === 'string' ? input : await input.text()
    // This validates the complete KLE structure, including dimensions and legends.
    scope.postMessage({ id, ok: true, layout: parseLayout(text) })
  } catch (reason) {
    scope.postMessage({ id, ok: false, error: reason instanceof Error ? reason.message : String(reason) })
  }
})
