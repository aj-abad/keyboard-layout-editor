import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { useLayoutParser } from '../app/composables/useLayoutParser'
import { createLayoutParser } from '../app/utils/layout-parser'
import type { LayoutParserRequest, LayoutParserResponse } from '../app/utils/layout-parser'
import { MAX_LAYOUT_BYTES } from '../app/utils/layout-parser'
import { deserialize } from '../app/utils/layout'

class FakeWorker extends EventTarget {
  requests: LayoutParserRequest[] = []
  terminated = false
  postMessage(message: LayoutParserRequest) { this.requests.push(message) }
  terminate() { this.terminated = true }
  reply(data: LayoutParserResponse) { this.dispatchEvent(new MessageEvent('message', { data })) }
  crash(message = '') {
    const event = new Event('error', { cancelable: true })
    Object.assign(event, { message })
    this.dispatchEvent(event)
  }
  asWorker() { return this as unknown as Worker }
}

test('background requests remain pending until their own worker response arrives', async () => {
  const worker = new FakeWorker()
  const parser = createLayoutParser(() => worker.asWorker())
  let firstResolved = false
  const first = parser.parse('[["A"]]').then(layout => { firstResolved = true; return layout })
  const second = parser.parse('[["B"]]')
  await Promise.resolve()
  assert.equal(firstResolved, false, 'parse must not synchronously evaluate the input')
  const a = deserialize([['A']]), b = deserialize([['B']])
  worker.reply({ id: worker.requests[1]!.id, ok: true, layout: b })
  assert.equal(await second, b)
  assert.equal(firstResolved, false)
  worker.reply({ id: worker.requests[0]!.id, ok: true, layout: a })
  assert.equal(await first, a)
  worker.reply({ id: worker.requests[0]!.id, ok: true, layout: b })
  assert.equal((await first).keys[0]!.labels[0], 'A', 'duplicate responses cannot change a completed request')
  parser.dispose()
})

test('a validation error rejects only its matching request and keeps the worker usable', async () => {
  const worker = new FakeWorker()
  const parser = createLayoutParser(() => worker.asWorker())
  const invalid = parser.parse('[[{w:0},"A"]]')
  const valid = parser.parse('[["B"]]')
  const rejected = assert.rejects(invalid, /positive number/)
  worker.reply({ id: worker.requests[0]!.id, ok: false, error: "KLE property 'w' must be a finite positive number." })
  worker.reply({ id: worker.requests[1]!.id, ok: true, layout: deserialize([['B']]) })
  await rejected
  assert.equal((await valid).keys[0]!.labels[0], 'B')
  assert.equal(worker.terminated, false)
  parser.dispose()
})

test('worker failure rejects every pending request, ignores stale responses and permits a retry', async () => {
  const workers: FakeWorker[] = []
  const parser = createLayoutParser(() => {
    const worker = new FakeWorker()
    workers.push(worker)
    return worker.asWorker()
  })
  const first = parser.parse('[["A"]]'), second = parser.parse('[["B"]]')
  const rejected = Promise.all([assert.rejects(first, /stopped/), assert.rejects(second, /stopped/)])
  workers[0]!.crash()
  await rejected
  assert.equal(workers[0]!.terminated, true)
  const retry = parser.parse('[["C"]]')
  const layout = deserialize([['C']])
  workers[0]!.reply({ id: workers[0]!.requests[0]!.id, ok: true, layout: deserialize([['Stale']]) })
  workers[1]!.reply({ id: workers[1]!.requests[0]!.id, ok: true, layout })
  assert.equal(await retry, layout)
  parser.dispose()
})

test('message decoding failures and disposal cannot leave promises pending', async () => {
  const worker = new FakeWorker()
  const parser = createLayoutParser(() => worker.asWorker())
  const pending = parser.parse('[["A"]]')
  const rejected = assert.rejects(pending, /parser’s response/)
  worker.dispatchEvent(new Event('messageerror'))
  await rejected
  parser.dispose()
  await assert.rejects(parser.parse('[["A"]]'), /closed/)

  const another = new FakeWorker()
  const scoped = createLayoutParser(() => another.asWorker())
  const cancelled = assert.rejects(scoped.parse('[["B"]]'), /canceled/)
  scoped.dispose()
  await cancelled
  assert.equal(another.terminated, true)
})

test('unsupported workers reject without parsing and Vue scope cleanup cancels in-flight parsing', async () => {
  const originalWorker = globalThis.Worker
  try {
    const unsupported = useLayoutParser()
    await assert.rejects(unsupported.parse('[["A"]]'), /Web Worker support/)
    unsupported.dispose()

    const worker = new FakeWorker()
    globalThis.Worker = class { constructor() { return worker.asWorker() } } as unknown as typeof Worker
    const scope = effectScope()
    const parser = scope.run(() => useLayoutParser())!
    const cancelled = assert.rejects(parser.parse('[["A"]]'), /canceled/)
    scope.stop()
    await cancelled
    assert.equal(worker.terminated, true)
  } finally { globalThis.Worker = originalWorker }
})

test('files are passed intact to the worker and posting failures reject without stranding later requests', async () => {
  const worker = new FakeWorker()
  const parser = createLayoutParser(() => worker.asWorker())
  const file = new File(['[["A"]]'], 'layout.json')
  let reads = 0
  file.text = async () => { reads++; return '[["A"]]' }
  const parsed = parser.parse(file)
  assert.equal(worker.requests[0]!.input, file)
  assert.equal(reads, 0, 'the main thread must not read or parse file contents')
  worker.reply({ id: worker.requests[0]!.id, ok: true, layout: deserialize([['A']]) })
  await parsed

  const post = worker.postMessage.bind(worker)
  worker.postMessage = () => { throw new Error('Cannot clone input') }
  await assert.rejects(parser.parse(file), /Cannot clone/)
  worker.postMessage = post
  const retry = parser.parse('[["B"]]')
  worker.reply({ id: worker.requests.at(-1)!.id, ok: true, layout: deserialize([['B']]) })
  assert.equal((await retry).keys[0]!.labels[0], 'B')
  parser.dispose()
})

test('the worker reads files, keeps JSON5/raw-row support and validates complete KLE layouts', async () => {
  const scope = globalThis as unknown as {
    addEventListener?: (type: string, listener: (event: MessageEvent<LayoutParserRequest>) => Promise<void>) => void
    postMessage?: (response: LayoutParserResponse) => void
  }
  const originalAddListener = scope.addEventListener, originalPostMessage = scope.postMessage
  const responses: LayoutParserResponse[] = []
  let onRequest: (event: MessageEvent<LayoutParserRequest>) => Promise<void>
  scope.addEventListener = (_type, listener) => { onRequest = listener }
  scope.postMessage = response => { responses.push(response) }
  try {
    await import('../app/workers/layout-parser.worker')
    async function request(id: number, input: string | File) {
      await onRequest!(new MessageEvent('message', { data: { id, input } }))
      return responses.at(-1)!
    }
    const file = new File(["{name:'Imported'}, [{w:1.5}, 'Tab', 'Q'], ['A'],"], 'keyboard.json')
    let reads = 0
    const read = file.text.bind(file)
    file.text = async () => { reads++; return read() }
    const valid = await request(1, file)
    assert.equal(reads, 1)
    assert.equal(valid.id, 1)
    assert.equal(valid.ok, true)
    if (valid.ok) {
      assert.equal(valid.layout.meta.name, 'Imported')
      assert.equal(valid.layout.keys[0]!.width, 1.5)
      assert.equal(valid.layout.keys.length, 3)
    }
    const invalid = await request(2, '[[{w:0},"A"]]')
    assert.equal(invalid.ok, false, 'syntactically valid JSON with invalid KLE geometry must fail')
    if (!invalid.ok) assert.match(invalid.error, /positive number/)
    const tooLarge = new File([' '.repeat(MAX_LAYOUT_BYTES + 1)], 'large.json')
    tooLarge.text = async () => { throw new Error('Oversized files must not be read') }
    const rejected = await request(3, tooLarge)
    assert.equal(rejected.ok, false)
    if (!rejected.ok) assert.match(rejected.error, /5 MB/)
  } finally {
    if (originalAddListener) scope.addEventListener = originalAddListener
    else delete scope.addEventListener
    if (originalPostMessage) scope.postMessage = originalPostMessage
    else delete scope.postMessage
  }
})
