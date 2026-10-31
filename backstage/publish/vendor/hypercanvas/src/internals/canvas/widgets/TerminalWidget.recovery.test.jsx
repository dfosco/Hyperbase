import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import widgetDefinitions from '../../../../widgets.config.json'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const terminals = vi.hoisted(() => [])
vi.mock('../../../core/index.js', () => ({
  getTerminalConfig: () => ({}),
  getTerminalDimensions: (_agent, dimensions) => dimensions,
}))
vi.mock('../../hooks/useOverride.js', () => ({ useOverride: () => [null, vi.fn(), vi.fn()] }))
vi.mock('./ExpandedPane.jsx', () => ({ default: () => null }))
vi.mock('./FrozenTerminalOverlay.jsx', () => ({ default: () => null }))
vi.mock('../../Icon.jsx', () => ({ default: () => null }))
vi.mock('../../storyboard-ws.js', () => ({ storyboardWs: { on: vi.fn(), off: vi.fn() } }))
vi.mock('ghostty-web', () => ({
  init: vi.fn(),
  Terminal: class {
    renderer = { charWidth: 8, charHeight: 17 }
    write = vi.fn()
    resize = vi.fn()
    dispose = vi.fn()
    open(element) { this.element = element; element.contentEditable = 'true' }
    focus() { this.element.focus() }
    attachCustomWheelEventHandler(handler) { this.wheel = handler }
    onData(handler) { this.input = handler }
    constructor() { terminals.push(this) }
  },
}))
import TerminalWidget from './TerminalWidget.jsx'

class Socket {
  static OPEN = 1
  static all = []
  readyState = 0
  send = vi.fn()
  constructor(url) { this.url = url; Socket.all.push(this) }
  open() { this.readyState = 1; this.onopen?.() }
  message(message) { this.onmessage?.({ data: JSON.stringify(message) }) }
  close(code = 1006) { this.readyState = 3; this.onclose?.({ code }) }
}
const flush = async () => { await act(async () => { await Promise.resolve() }) }
const advance = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
function widget({ ref, props = {}, onUpdate } = {}) { return render(<TerminalWidget ref={ref} id="agent-test" props={{ agentId: 'codex', width: 700, height: 500, ...props }} onUpdate={onUpdate} />) }
function handshake(socket = Socket.all.at(-1), contextState = { phase: 'ready', delivery: 'acknowledged' }) {
  socket.open()
  socket.message({ type: 'session-info', contextState })
}

describe('terminal attachment recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', Socket)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Context state request unavailable')))
    Socket.all = []
    terminals.length = 0
  })
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

  it('waits for the PTY handshake, then gates context input immediately until acknowledgement', async () => {
    const { container } = widget()
    await flush()
    const socket = Socket.all[0]
    act(() => { socket.open(); terminals[0].input('early') })
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'connecting')
    expect(socket.send).not.toHaveBeenCalled()
    act(() => {
      socket.message({ type: 'session-info', contextState: { phase: 'starting', delivery: 'pending' } })
      terminals[0].input('blocked')
    })
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'preparing')
    expect(socket.send).toHaveBeenCalledTimes(1) // resize only
    act(() => {
      socket.message({ type: 'context-state', state: { phase: 'ready', delivery: 'acknowledged' } })
      terminals[0].input('draft')
    })
    expect(socket.send).toHaveBeenLastCalledWith('draft')
    // A connector/context update cannot inject text or submit the user's draft.
    act(() => socket.message({ type: 'context-state', state: { phase: 'ready', delivery: 'available' } }))
    expect(socket.send).toHaveBeenCalledTimes(2)
  })

  it('automatically reconnects retryable runtime errors while permanent errors remain actionable', async () => {
    widget(); await flush()
    act(() => {
      handshake()
      Socket.all[0].message({ type: 'error', retryable: true, message: 'Paseo temporarily unavailable' })
      terminals[0].input('not connected')
      Socket.all[0].close(1012)
    })
    expect(Socket.all[0].send).not.toHaveBeenCalledWith('not connected')
    expect(screen.queryByRole('alert')).toBeNull()
    await advance(500)
    act(() => { handshake(); terminals[0].input('recovered') })
    expect(Socket.all[1].send).toHaveBeenLastCalledWith('recovered')
    expect(terminals).toHaveLength(1)
  })

  it('does not claim agent readiness for an attached prelaunch or unverified session', async () => {
    const { container } = widget(); await flush()
    act(() => handshake(Socket.all[0], null))
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'attached')
    act(() => Socket.all[0].message({ type: 'context-state', state: { phase: 'unverified', delivery: 'available' } }))
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'attached')
  })

  it('retries a missing handshake automatically and retains the emulator and output on transport loss', async () => {
    widget(); await flush()
    act(() => Socket.all[0].open())
    await advance(15000)
    await advance(500)
    expect(Socket.all).toHaveLength(2)
    act(() => { handshake(); Socket.all[1].onmessage({ data: 'saved output' }); Socket.all[1].close() })
    await advance(1000)
    expect(Socket.all).toHaveLength(3)
    expect(terminals).toHaveLength(1)
    expect(terminals[0].dispose).not.toHaveBeenCalled()
    expect(terminals[0].write).toHaveBeenCalledWith('saved output')
    expect(new URL(Socket.all[2].url).pathname).toBe(new URL(Socket.all[1].url).pathname)
    expect(new URL(Socket.all[2].url).searchParams.get('viewId')).toBe(new URL(Socket.all[1].url).searchParams.get('viewId'))
    expect(new URL(Socket.all[2].url).searchParams.get('retained')).toBe('1')
    expect(new URL(Socket.all[0].url).searchParams.has('retained')).toBe(false)
    act(() => { handshake(); terminals[0].input('after recovery') })
    expect(Socket.all[2].send).toHaveBeenLastCalledWith('after recovery')
    // An obsolete attachment cannot alter the replacement's readiness.
    act(() => Socket.all[1].message({ type: 'error', message: 'stale failure' }))
    expect(screen.queryByText(/stale failure/)).toBeNull()
  })

  it('stops after a bounded retry budget instead of looping on short-lived sockets', async () => {
    widget(); await flush()
    for (const delay of [500, 1000, 2000, 4000, 5000]) {
      act(() => { handshake(); Socket.all.at(-1).close() })
      await advance(delay)
    }
    act(() => { handshake(); Socket.all.at(-1).close() })
    await advance(60000)
    expect(Socket.all).toHaveLength(6)
    expect(screen.getByRole('alert')).toHaveTextContent('automatic recovery attempts')
  })

  it.each([
    { type: 'detached', message: 'Owned by another view' },
    { type: 'error', message: 'Authentication required' },
    { type: 'session-ended' },
  ])('does not auto-reclaim or relaunch after $type', async (message) => {
    widget(); await flush()
    act(() => { handshake(); Socket.all[0].message(message); Socket.all[0].close() })
    await advance(60000)
    expect(Socket.all).toHaveLength(1)
    act(() => terminals[0].input('must not send'))
    expect(Socket.all[0].send).not.toHaveBeenCalledWith('must not send')
  })

  it('waits for a busy owner, reuses its view identity, and recovers without takeover', async () => {
    widget(); await flush()
    const first = Socket.all[0]
    const identity = new URL(first.url).searchParams.get('viewId')
    expect(identity).toBeTruthy()
    act(() => {
      first.open()
      first.message({ type: 'attachment-busy', message: 'Another view owns this terminal' })
      first.close(4001)
    })
    await advance(500)
    expect(Socket.all).toHaveLength(2)
    expect(new URL(Socket.all[1].url).searchParams.get('viewId')).toBe(identity)
    act(() => { handshake(); terminals[0].input('owner released') })
    expect(Socket.all[1].send).toHaveBeenLastCalledWith('owner released')
  })

  it('automatically exposes unacknowledged provider output and input without claiming ready', async () => {
    const { container } = widget(); await flush()
    const state = { phase: 'starting', delivery: 'pending', launchId: 'first' }
    act(() => handshake(Socket.all[0], state))
    await advance(30000)
    expect(screen.getByText(/Startup context has not been acknowledged/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Interact anyway' })).toBeNull()
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'attention')
    act(() => {
      // Repeated context notifications must not re-lock the released launch.
      Socket.all[0].message({ type: 'context-state', state })
      terminals[0].input('\x1b[B')
      terminals[0].input('\t')
      terminals[0].input('consent text\r')
    })
    expect(Socket.all[0].send).toHaveBeenLastCalledWith('consent text\r')
    act(() => Socket.all[0].message({ type: 'context-state', state: { ...state, phase: 'ready', delivery: 'acknowledged' } }))
    expect(screen.queryByText(/Startup context has not been acknowledged/)).toBeNull()
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'connected')
    // A genuinely new launch gets its own bounded bootstrap gate.
    act(() => {
      Socket.all[0].message({ type: 'context-state', state: { ...state, launchId: 'second' } })
      terminals[0].input('new launch blocked')
    })
    expect(Socket.all[0].send).not.toHaveBeenCalledWith('new launch blocked')
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'preparing')
  })

  it('keeps the confirmed owner registered when a duplicate widget waits and unmounts', async () => {
    const owner = widget(); await flush()
    act(() => handshake(Socket.all[0]))
    const ownerEntry = window.__storyboardTerminalRegistry.get('agent-test')
    const duplicate = widget(); await flush()
    expect(window.__storyboardTerminalRegistry.get('agent-test')).toBe(ownerEntry)
    act(() => {
      Socket.all[1].open()
      Socket.all[1].message({ type: 'attachment-busy' })
      Socket.all[1].close(4001)
    })
    duplicate.unmount()
    expect(window.__storyboardTerminalRegistry.get('agent-test')).toBe(ownerEntry)
    owner.unmount()
    expect(window.__storyboardTerminalRegistry.has('agent-test')).toBe(false)
  })

  it('recovers a missed context acknowledgement from the matching server launch and stops polling', async () => {
    const { container } = widget(); await flush()
    const state = { launchId: 'current', phase: 'starting', delivery: 'pending' }
    fetch.mockResolvedValue({ ok: true, json: async () => ({ state: { ...state, phase: 'ready', delivery: 'acknowledged' } }) })
    act(() => handshake(Socket.all[0], state))
    await advance(1000)
    expect(fetch).toHaveBeenCalledOnce()
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ widgetId: 'agent-test', action: 'state' })
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'connected')
    act(() => terminals[0].input('after recovered acknowledgement'))
    expect(Socket.all[0].send).toHaveBeenLastCalledWith('after recovered acknowledgement')
    await advance(60000)
    expect(fetch).toHaveBeenCalledOnce()
    expect(Socket.all).toHaveLength(1)
  })

  it('does not let a delayed state read override a newer live context update', async () => {
    const { container } = widget(); await flush()
    let respond
    fetch.mockImplementation(() => new Promise(resolve => { respond = resolve }))
    const state = { launchId: 'current', phase: 'starting', delivery: 'pending', revision: 'old' }
    act(() => handshake(Socket.all[0], state))
    await advance(1000)
    act(() => Socket.all[0].message({ type: 'context-state', state: { ...state, revision: 'new' } }))
    await act(async () => respond({ ok: true, json: async () => ({ state: { ...state, phase: 'ready' } }) }))
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'preparing')
    act(() => terminals[0].input('still gated'))
    expect(Socket.all[0].send).not.toHaveBeenCalledWith('still gated')
  })

  it('does not accept state from another launch, then recovers when the current launch is confirmed', async () => {
    const { container } = widget(); await flush()
    const state = { launchId: 'current', phase: 'starting', delivery: 'pending' }
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ state: { ...state, launchId: 'older', phase: 'ready' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ state: { ...state, phase: 'ready', delivery: 'acknowledged' } }) })
    act(() => handshake(Socket.all[0], state))
    await advance(1000)
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'preparing')
    await advance(2000)
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'connected')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('cancels an old launch state request instead of applying it to a newer launch', async () => {
    const { container } = widget(); await flush()
    let respond
    fetch.mockImplementation(() => new Promise(resolve => { respond = resolve }))
    const state = { launchId: 'old', phase: 'starting', delivery: 'pending' }
    act(() => handshake(Socket.all[0], state))
    await advance(1000)
    const signal = fetch.mock.calls[0][1].signal
    act(() => Socket.all[0].message({ type: 'context-state', state: { ...state, launchId: 'new' } }))
    expect(signal.aborted).toBe(true)
    await act(async () => respond({ ok: true, json: async () => ({ state: { ...state, phase: 'ready' } }) }))
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'preparing')
  })

  it('bounds failed state reads and preserves truthful attention without input injection or relaunch', async () => {
    const { container } = widget(); await flush()
    act(() => handshake(Socket.all[0], { launchId: 'pending', phase: 'starting', delivery: 'pending' }))
    await advance(60000)
    expect(fetch).toHaveBeenCalledTimes(5)
    expect(container.querySelector('[data-terminal-state]')).toHaveAttribute('data-terminal-state', 'attention')
    expect(container.querySelector('[data-terminal-context-phase]')).toHaveAttribute('data-terminal-context-phase', 'starting')
    expect(screen.getByText(/Could not verify startup context/)).toBeInTheDocument()
    expect(Socket.all).toHaveLength(1)
    expect(Socket.all[0].send).toHaveBeenCalledTimes(1) // resize only
  })

  it('stops state reconciliation for permanent errors and aborts a read on unmount', async () => {
    const first = widget(); await flush()
    fetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'Context access denied' }) })
    act(() => handshake(Socket.all[0], { launchId: 'denied', phase: 'starting', delivery: 'pending' }))
    await advance(60000)
    expect(fetch).toHaveBeenCalledOnce()
    expect(screen.getByText(/Context access denied/)).toBeInTheDocument()
    first.unmount()
    fetch.mockClear()
    fetch.mockImplementation(() => new Promise(() => {}))
    const second = widget(); await flush()
    act(() => handshake(Socket.all[1], { launchId: 'unmount', phase: 'starting', delivery: 'pending' }))
    await advance(1000)
    const signal = fetch.mock.calls[0][1].signal
    second.unmount()
    expect(signal.aborted).toBe(true)
    await advance(60000)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('exposes Refresh terminal through the canonical agent and terminal menus', () => {
    for (const type of ['terminal', 'agent']) {
      expect(widgetDefinitions.widgets[type].features).toContainEqual(expect.objectContaining({
        id: 'refresh-terminal', action: 'refresh-terminal', label: 'Refresh terminal', menu: true, prod: true,
      }))
    }
  })

  it('refreshes the existing attachment and latest context without replacing the emulator or resending startup', async () => {
    const ref = createRef()
    const onUpdate = vi.fn()
    widget({ ref, onUpdate, props: { startupCommand: 'custom startup' } }); await flush()
    const oldSocket = Socket.all[0]
    const initialContext = { launchId: 'same-launch', phase: 'starting', delivery: 'pending' }
    act(() => {
      handshake(oldSocket, initialContext)
      oldSocket.onmessage({ data: 'earlier output' })
      expect(ref.current.handleAction('refresh-terminal')).toBe(true)
    })
    const refreshed = Socket.all[1]
    const oldUrl = new URL(oldSocket.url)
    const refreshedUrl = new URL(refreshed.url)
    expect(refreshedUrl.pathname).toBe(oldUrl.pathname)
    expect(refreshedUrl.searchParams.get('viewId')).toBe(oldUrl.searchParams.get('viewId'))
    expect(refreshedUrl.searchParams.get('refresh')).toBe('1')
    expect(refreshedUrl.searchParams.get('retained')).toBe('1')
    expect(refreshedUrl.searchParams.has('startupCommand')).toBe(false)
    expect(terminals).toHaveLength(1)
    expect(terminals[0].dispose).not.toHaveBeenCalled()
    act(() => {
      handshake(refreshed, { ...initialContext, phase: 'ready', delivery: 'acknowledged' })
      refreshed.message({ type: 'terminal-restore', hardReset: false, data: '\x1b[H\x1b[2Jrestored remote screen' })
      // Obsolete callbacks cannot restore a stale preparation gate.
      oldSocket.message({ type: 'context-state', state: initialContext })
      terminals[0].input('draft after refresh')
    })
    expect(terminals[0].write).toHaveBeenCalledWith('earlier output')
    expect(terminals[0].write).toHaveBeenLastCalledWith('\x1b[H\x1b[2Jrestored remote screen')
    expect(refreshed.send).toHaveBeenLastCalledWith('draft after refresh')
    expect(onUpdate).not.toHaveBeenCalled()
    await advance(1000)
    expect(Socket.all).toHaveLength(2)
  })

  it('cancels a queued retry when refreshing, and keeps all refresh retries existing-only', async () => {
    const ref = createRef()
    widget({ ref, props: { startupCommand: 'initial only' } }); await flush()
    act(() => { handshake(); Socket.all[0].close(); ref.current.handleAction('refresh-terminal') })
    await advance(500)
    expect(Socket.all).toHaveLength(2)
    act(() => Socket.all[1].close(1012))
    await advance(500)
    expect(Socket.all).toHaveLength(3)
    expect(new URL(Socket.all[2].url).searchParams.get('refresh')).toBe('1')
    expect(new URL(Socket.all[2].url).searchParams.has('startupCommand')).toBe(false)
    expect(terminals).toHaveLength(1)
  })

  it('keeps a missing-session Refresh failure actionable without relaunching', async () => {
    const ref = createRef()
    widget({ ref }); await flush()
    act(() => { handshake(); ref.current.handleAction('refresh-terminal') })
    act(() => {
      Socket.all[1].open()
      Socket.all[1].message({ type: 'error', message: 'Existing terminal session is no longer running' })
      Socket.all[1].close(1008)
    })
    await advance(60000)
    expect(Socket.all).toHaveLength(2)
    expect(screen.getByRole('alert')).toHaveTextContent('no longer running')
    fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }))
    expect(Socket.all).toHaveLength(3)
    expect(new URL(Socket.all[2].url).searchParams.get('refresh')).toBe('1')
    expect(terminals).toHaveLength(1)
  })

  it('cancels a pending recovery when the widget unmounts', async () => {
    const view = widget(); await flush()
    act(() => { handshake(); Socket.all[0].close() })
    view.unmount()
    await advance(60000)
    expect(Socket.all).toHaveLength(1)
    expect(terminals[0].dispose).toHaveBeenCalledOnce()
  })
})
