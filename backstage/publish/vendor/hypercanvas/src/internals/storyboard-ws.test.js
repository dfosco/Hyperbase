import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url) {
    this.url = url
    this.readyState = FakeWebSocket.CONNECTING
    this.handlers = new Map()
    FakeWebSocket.instances.push(this)
  }

  addEventListener(name, callback, options = {}) {
    const entries = this.handlers.get(name) || new Set()
    entries.add({ callback, once: options.once === true })
    this.handlers.set(name, entries)
  }

  dispatch(name, event = {}) {
    for (const entry of [...(this.handlers.get(name) || [])]) {
      entry.callback(event)
      if (entry.once) this.handlers.get(name).delete(entry)
    }
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.dispatch('open')
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
    this.dispatch('close')
  }

  send() {}
}

let storyboardWs

async function flushConnectionStart() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

beforeEach(async () => {
  FakeWebSocket.instances = []
  vi.useFakeTimers()
  vi.stubEnv('MODE', 'development')
  vi.stubGlobal('__HYPERCANVAS_WS_TEST_MODE__', true)
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ url: 'ws://localhost/_hypercanvas/ws' }) }))
  vi.resetModules()
  ;({ storyboardWs } = await import('./storyboard-ws.js'))
})

afterEach(() => {
  delete window.__HYPERCANVAS_BASE_PATH__
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('storyboard workspace connection lifecycle', () => {
  it('normalizes branch bases without a trailing slash for discovery and fallback', async () => {
    window.__HYPERCANVAS_BASE_PATH__ = '/branch--notebook-chrome'
    vi.mocked(fetch).mockRejectedValue(new Error('discovery unavailable'))
    const release = storyboardWs.start()
    await flushConnectionStart()
    expect(fetch).toHaveBeenCalledWith('/branch--notebook-chrome/_hypercanvas/ws-url')
    expect(FakeWebSocket.instances[0].url).toBe(`ws://${window.location.host}/branch--notebook-chrome/_hypercanvas/ws`)
    release()
  })

  it('connects without feature listeners and reconnects after a disconnect', async () => {
    const release = storyboardWs.start()
    await flushConnectionStart()
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0].url).toBe('ws://localhost/_hypercanvas/ws')

    FakeWebSocket.instances[0].open()
    expect(storyboardWs.connectionState()).toBe('connected')
    FakeWebSocket.instances[0].close()
    expect(storyboardWs.connectionState()).toBe('disconnected')

    await vi.advanceTimersByTimeAsync(499)
    expect(FakeWebSocket.instances).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeWebSocket.instances).toHaveLength(2)
    FakeWebSocket.instances[1].open()
    expect(storyboardWs.connectionState()).toBe('connected')

    release()
    expect(FakeWebSocket.instances[1].readyState).toBe(FakeWebSocket.CLOSED)
  })

  it('caps retry delays and cancels retries after the workspace releases ownership', async () => {
    const release = storyboardWs.start()
    await flushConnectionStart()
    FakeWebSocket.instances[0].close()
    await vi.advanceTimersByTimeAsync(500)
    expect(FakeWebSocket.instances).toHaveLength(2)
    FakeWebSocket.instances[1].close()
    await vi.advanceTimersByTimeAsync(999)
    expect(FakeWebSocket.instances).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeWebSocket.instances).toHaveLength(3)

    release()
    await vi.runOnlyPendingTimersAsync()
    expect(FakeWebSocket.instances).toHaveLength(3)
  })

  it('ignores queued error and message events from a retired socket', async () => {
    const release = storyboardWs.start()
    const received = vi.fn()
    storyboardWs.on('workspace:test', received)
    await flushConnectionStart()
    const retired = FakeWebSocket.instances[0]
    retired.open()

    retired.close()
    await vi.advanceTimersByTimeAsync(500)
    const active = FakeWebSocket.instances[1]
    active.open()
    expect(storyboardWs.connectionState()).toBe('connected')

    retired.dispatch('error')
    retired.dispatch('message', { data: JSON.stringify({ event: 'workspace:test', data: 'stale' }) })

    expect(storyboardWs.connectionState()).toBe('connected')
    expect(received).not.toHaveBeenCalled()
    release()
  })
})

describe('static Notebook publication WebSocket behavior', () => {
  it('does not connect or reconnect in a production static Notebook publication', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubGlobal('__HYPERCANVAS_NOTEBOOK_PUBLICATION__', true)
    vi.useFakeTimers()
    const fetchMock = vi.fn()
    const webSocketMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('WebSocket', webSocketMock)
    vi.resetModules()
    const { storyboardWs: publicationWs } = await import('./storyboard-ws.js')

    expect(import.meta.env.MODE).toBe('production')
    expect(publicationWs.connectionState()).toBe('disconnected')
    await expect(publicationWs.connect()).resolves.toBeNull()
    publicationWs.on('storyboard:refresh', () => {})
    publicationWs.send('storyboard:refresh', { source: 'test' })
    await vi.runAllTimersAsync()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(webSocketMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps production WebSocket discovery, sends, and reconnects outside static publications', async () => {
    vi.stubEnv('MODE', 'production')
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => ({ json: async () => ({ url: 'ws://localhost/_hypercanvas/ws' }) }))
    const sockets = []
    class MockWebSocket extends EventTarget {
      static OPEN = 1
      readyState = 0
      send = vi.fn()

      constructor(url) {
        super()
        this.url = url
        sockets.push(this)
        queueMicrotask(() => {
          this.readyState = MockWebSocket.OPEN
          this.dispatchEvent(new Event('open'))
        })
      }
    }
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.resetModules()
    const { storyboardWs: productionWs } = await import('./storyboard-ws.js')

    expect(import.meta.env.MODE).toBe('production')
    const listener = () => {}
    productionWs.on('storyboard:refresh', listener)
    const connected = await productionWs.connect()
    expect(connected).toBe(sockets[0])
    expect(sockets[0].url).toBe('ws://localhost/_hypercanvas/ws')

    productionWs.send('storyboard:refresh', { source: 'test' })
    await Promise.resolve()
    expect(sockets[0].send).toHaveBeenCalledWith(JSON.stringify({ event: 'storyboard:refresh', data: { source: 'test' } }))

    sockets[0].readyState = 3
    sockets[0].dispatchEvent(new Event('close'))
    await vi.advanceTimersByTimeAsync(500)
    await Promise.resolve()
    await Promise.resolve()
    expect(sockets).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    productionWs.off('storyboard:refresh', listener)
  })
})
