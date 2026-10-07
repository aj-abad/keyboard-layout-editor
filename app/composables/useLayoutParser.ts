import { getCurrentScope, onScopeDispose } from 'vue'
import { createLayoutParser } from '../utils/layout-parser'

/** Read and validate layouts outside the UI thread, without a synchronous fallback. */
export function useLayoutParser() {
  const parser = createLayoutParser(() => {
    if (typeof Worker === 'undefined') {
      throw new Error('This browser cannot parse layout JSON in the background. Use a browser with Web Worker support.')
    }
    return new Worker(new URL('../workers/layout-parser.worker.ts', import.meta.url), { type: 'module' })
  })
  if (getCurrentScope()) onScopeDispose(parser.dispose)
  return parser
}
