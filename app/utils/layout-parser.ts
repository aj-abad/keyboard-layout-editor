import type { Layout } from './layout'

export const MAX_LAYOUT_BYTES = 5 * 1024 * 1024
export type LayoutParserInput = string | File
export interface LayoutParserRequest { id: number; input: LayoutParserInput }
export type LayoutParserResponse =
  | { id: number; ok: true; layout: Layout }
  | { id: number; ok: false; error: string }

interface PendingRequest {
  resolve: (layout: Layout) => void
  reject: (error: Error) => void
}

/** Match concurrent worker responses to their callers and settle every request on cleanup. */
export function createLayoutParser(createWorker: () => Worker) {
  const pending = new Map<number, PendingRequest>()
  let worker: Worker | undefined
  let sequence = 0
  let disposed = false

  function detach() {
    if (!worker) return
    worker.removeEventListener('message', onMessage)
    worker.removeEventListener('error', onError)
    worker.removeEventListener('messageerror', onMessageError)
    worker.terminate()
    worker = undefined
  }

  function fail(error: Error) {
    detach()
    for (const request of pending.values()) request.reject(error)
    pending.clear()
  }

  function onMessage(event: MessageEvent<LayoutParserResponse>) {
    const response = event.data
    const request = pending.get(response.id)
    if (!request) return
    pending.delete(response.id)
    if (response.ok === true) request.resolve(response.layout)
    else request.reject(new Error(response.error))
  }

  function onError(event: ErrorEvent) {
    event.preventDefault()
    fail(new Error(event.message || 'The JSON parser stopped unexpectedly. Try importing the layout again.'))
  }

  function onMessageError() {
    fail(new Error('Couldn’t read the JSON parser’s response. Open the layout again.'))
  }

  function parse(input: LayoutParserInput): Promise<Layout> {
    if (disposed) return Promise.reject(new Error('The JSON parser has been closed.'))
    return new Promise((resolve, reject) => {
      try {
        if (!worker) {
          worker = createWorker()
          worker.addEventListener('message', onMessage)
          worker.addEventListener('error', onError)
          worker.addEventListener('messageerror', onMessageError)
        }
        const id = ++sequence
        pending.set(id, { resolve, reject })
        try { worker.postMessage({ id, input } satisfies LayoutParserRequest) }
        catch (reason) {
          pending.delete(id)
          reject(reason instanceof Error ? reason : new Error(String(reason)))
        }
      } catch (reason) {
        detach()
        reject(reason instanceof Error ? reason : new Error(String(reason)))
      }
    })
  }

  function dispose() {
    disposed = true
    fail(new Error('JSON parsing was canceled because the editor closed.'))
  }

  return { parse, dispose }
}
