import { act, render, screen } from '@testing-library/react'
import { afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Component, StrictMode, Suspense, useContext, useEffect, useState } from 'react'
import { init, setFlag } from '../core/index.js'
import { initKnobs } from '../core/knobs/discovery.js'
import { SidebarNoticeContext } from './NotebookShell/SidebarNoticeContext.js'
import StoryboardProvider, { StoryboardContext } from './context.jsx'
import { storyboardWs } from './storyboard-ws.js'
import { useKnob } from './hooks/useKnob.js'
import { useObject } from './hooks/useObject.js'
import { useRecord } from './hooks/useRecord.js'

const desktopRuntimeMocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  subscribe: vi.fn(),
  confirmReady: vi.fn(),
  reconcile: vi.fn((current, incoming) => {
    if (current && incoming.sequence <= current.sequence) return current
    return incoming
  }),
}))

vi.mock('../core/notebook/browserBridge.js', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    confirmDesktopFrontendReady: desktopRuntimeMocks.confirmReady,
    getDesktopRuntimeSnapshot: desktopRuntimeMocks.getSnapshot,
    reconcileDesktopRuntimeSnapshot: desktopRuntimeMocks.reconcile,
    subscribeDesktopRuntimeState: desktopRuntimeMocks.subscribe,
  }
})

const mockUseLocation = vi.fn(() => ({ pathname: '/', search: '', hash: '' }))
const mockUseParams = vi.fn(() => ({}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: (...args) => mockUseParams(...args),
    useLocation: (...args) => mockUseLocation(...args),
  }
})

beforeEach(() => {
  desktopRuntimeMocks.getSnapshot.mockReset()
  desktopRuntimeMocks.subscribe.mockReset().mockImplementation(() => { throw new Error('MyGo is unavailable') })
  desktopRuntimeMocks.confirmReady.mockReset()
  desktopRuntimeMocks.reconcile.mockClear()
  mockUseLocation.mockReturnValue({ pathname: '/', search: '', hash: '' })
  mockUseParams.mockReturnValue({})
  initKnobs()
  init({
    flows: {
      default: { title: 'Default Scene' },
      other: { title: 'Other Scene' },
    },
    objects: {},
    records: {},
  })
})

afterEach(() => {
  localStorage.clear()
  window.sessionStorage.removeItem('__hypercanvas_reload_pending__')
  document.documentElement.removeAttribute('data-hc-desktop-shell')
  document.documentElement.removeAttribute('data-hc-route-commit-required')
  document.documentElement.removeAttribute('data-mygo-titlebar')
  delete window.__hypercanvasStartupDiagnostics
  delete window.__hypercanvasInitialLoad
  delete window.__HYPERCANVAS_SIDEBAR_RUNTIME_NOTICE__
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Mirror the shell's slot wiring without mounting its server-backed catalog. */
function SidebarNoticeHost({ children }) {
  const [slot, setSlot] = useState(null)
  return <SidebarNoticeContext.Provider value={slot}>
    <nav aria-label="Notebook pages"><div ref={setSlot} data-testid="notice-slot" /><footer>Sidebar footer</footer></nav>
    {children}
  </SidebarNoticeContext.Provider>
}

/** Helper component that reads context and renders it. */
function ContextReader({ path }) {
  const ctx = useContext(StoryboardContext)
  if (!ctx) return <span>no context</span>
  if (ctx.error) return <span>error: {ctx.error}</span>
  const value = path ? ctx.data?.[path] : JSON.stringify(ctx)
  return <span data-testid="ctx">{String(value)}</span>
}

describe('StoryboardProvider', () => {
  it.each([false, true])('waits for a managed route commit regardless of subscription order (already committed=%s)', async alreadyCommitted => {
    const snapshot = { schemaVersion: 1, sequence: alreadyCommitted ? 701 : 702, phase: 'starting', incident: null, actions: [] }
    let committed = alreadyCommitted
    let current = true
    window.__hypercanvasInitialLoad = { routeReadiness: () => ({ required: true, committed, current }) }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    desktopRuntimeMocks.confirmReady.mockResolvedValue({ accepted: true, snapshot: { ...snapshot, sequence: snapshot.sequence + 1, phase: 'ready' } })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    mockUseLocation.mockReturnValue({ pathname: '/branch--startup/canvas/current', search: '', hash: '' })
    render(<StoryboardProvider><span>managed route</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledTimes(alreadyCommitted ? 1 : 0)
    if (!alreadyCommitted) {
      // A forged event is insufficient; authority is the current document getter.
      act(() => window.dispatchEvent(new Event('hypercanvas:initial-route-ready')))
      expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()
      await act(async () => { committed = true; window.dispatchEvent(new Event('hypercanvas:initial-route-ready')); await Promise.resolve() })
      expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledExactlyOnceWith({ expectedSequence: snapshot.sequence })
    }
    current = false
  })

  it('uses the actual route marker only after suspended route content commits', async () => {
    const app = fs.readFileSync(path.resolve('src/library/_app.jsx'), 'utf8')
    const Marker = new Function('useEffect', app.match(/function InitialRouteReady\(\) \{[\s\S]*?\n\}/)[0] + '; return InitialRouteReady')(useEffect)
    let committed = false
    window.__hypercanvasInitialLoad = {
      routeReadiness: () => ({ required: true, committed, current: true }),
      markRouteReady: () => { committed = true; window.dispatchEvent(new Event('hypercanvas:initial-route-ready')) },
    }
    const snapshot = { schemaVersion: 1, sequence: 711, phase: 'starting', incident: null, actions: [] }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    desktopRuntimeMocks.confirmReady.mockResolvedValue({ accepted: true, snapshot: { ...snapshot, sequence: 712, phase: 'ready' } })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    let release
    let resolved = false
    const pending = new Promise(resolve => { release = resolve })
    function Route() { if (!resolved) throw pending; return <span>materialized route</span> }
    render(<StoryboardProvider><Suspense fallback={<span>preparing route</span>}><Route /><Marker /></Suspense></StoryboardProvider>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('preparing route')).toBeInTheDocument()
    expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()
    await act(async () => { resolved = true; release(); await pending })
    expect(screen.getByText('materialized route')).toBeInTheDocument()
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledExactlyOnceWith({ expectedSequence: 711 })
  })

  it.each(['unmount', 'pagehide', 'different-document'])('does not acknowledge a late route after %s', async retirement => {
    const snapshot = { schemaVersion: 1, sequence: 721, phase: 'starting', incident: null, actions: [] }
    let committed = false
    let current = true
    window.__hypercanvasInitialLoad = { routeReadiness: () => ({ required: true, committed, current }) }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    const view = render(<StoryboardProvider><span>retiring route</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve() })
    if (retirement === 'unmount') view.unmount()
    if (retirement === 'pagehide') window.dispatchEvent(new Event('pagehide'))
    if (retirement === 'different-document') current = false
    await act(async () => { committed = true; window.dispatchEvent(new Event('hypercanvas:initial-route-ready')); await Promise.resolve() })
    expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()
  })

  it('keeps a rejected managed route from falling back to provider-only readiness', async () => {
    const app = fs.readFileSync(path.resolve('src/library/_app.jsx'), 'utf8')
    const Marker = new Function('useEffect', app.match(/function InitialRouteReady\(\) \{[\s\S]*?\n\}/)[0] + '; return InitialRouteReady')(useEffect)
    const markRouteReady = vi.fn()
    window.__hypercanvasInitialLoad = { routeReadiness: () => ({ required: true, committed: false, current: true }), markRouteReady }
    const snapshot = { schemaVersion: 1, sequence: 741, phase: 'starting', incident: null, actions: [] }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    class RouteBoundary extends Component {
      state = { failed: false }
      static getDerivedStateFromError() { return { failed: true } }
      render() { return this.state.failed ? <span>route failed</span> : this.props.children }
    }
    function BrokenRoute() { throw new TypeError('route module rejected') }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<StoryboardProvider><RouteBoundary><Suspense fallback="preparing"><BrokenRoute /><Marker /></Suspense></RouteBoundary></StoryboardProvider>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('route failed')).toBeInTheDocument()
    expect(markRouteReady).not.toHaveBeenCalled()
    expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()
  })

  it('fails closed when a managed root cannot read its route collector', async () => {
    const snapshot = { schemaVersion: 1, sequence: 751, phase: 'starting', incident: null, actions: [] }
    document.documentElement.setAttribute('data-hc-route-commit-required', '')
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    render(<StoryboardProvider><span>managed root missing collector</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()
  })

  it('records explicit legacy readiness when a custom root has no route capability', async () => {
    const snapshot = { schemaVersion: 1, sequence: 731, phase: 'starting', incident: null, actions: [] }
    const record = vi.fn()
    window.__hypercanvasStartupDiagnostics = { record }
    window.__hypercanvasInitialLoad = { routeReadiness: () => ({ required: false, committed: false, current: true }) }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    desktopRuntimeMocks.confirmReady.mockResolvedValue({ accepted: true, snapshot: { ...snapshot, sequence: 732, phase: 'ready' } })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    render(<StoryboardProvider><span>legacy custom root</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledExactlyOnceWith({ expectedSequence: 731 })
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ code: 'legacy-route-readiness' }))
  })

  it('uses a rejected ACK snapshot to complete recovery when the runtime event was missed', async () => {
    const starting = { schemaVersion: 1, sequence: 601, phase: 'starting', incident: null, actions: [] }
    const recovering = { ...starting, sequence: 602, phase: 'recovering', incident: { incidentId: 'upstream-1' }, actions: ['reload-page'] }
    const recovered = { ...recovering, sequence: 603, phase: 'recovered', actions: [] }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(starting)
    desktopRuntimeMocks.confirmReady
      .mockResolvedValueOnce({ accepted: false, reason: 'frontend readiness snapshot is stale', snapshot: recovering })
      .mockResolvedValueOnce({ accepted: true, snapshot: recovered })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    render(<StoryboardProvider><span>healed workspace</span></StoryboardProvider>)
    await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve() })
    expect(desktopRuntimeMocks.confirmReady.mock.calls).toEqual([[{ expectedSequence: 601 }], [{ expectedSequence: 602 }]])
    expect(desktopRuntimeMocks.reconcile).toHaveBeenCalledWith(recovering, recovered)
  })

  it('refreshes authoritative runtime state on Core reconnect without needing an event', async () => {
    let current = { schemaVersion: 1, sequence: 611, phase: 'ready', incident: null, actions: [] }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockImplementation(async () => current)
    desktopRuntimeMocks.confirmReady.mockResolvedValue({ accepted: true, snapshot: { ...current, sequence: 613 } })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('disconnected')
    render(<StoryboardProvider><span>reconnected workspace</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve() })
    current = { ...current, sequence: 612, phase: 'recovering', incident: { incidentId: 'upstream-2' } }
    await act(async () => {
      window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'connected' } }))
      for (let i = 0; i < 8; i++) await Promise.resolve()
    })
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledExactlyOnceWith({ expectedSequence: 612 })
  })

  it('does not loop a rejection at the same sequence or acknowledge a newer manual failure', async () => {
    const starting = { schemaVersion: 1, sequence: 621, phase: 'starting', incident: null, actions: [] }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(starting)
    desktopRuntimeMocks.confirmReady.mockResolvedValue({ accepted: false, snapshot: starting })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    const view = render(<StoryboardProvider><span>same sequence</span></StoryboardProvider>)
    await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve() })
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledTimes(1)
    view.unmount()
    desktopRuntimeMocks.confirmReady.mockReset().mockResolvedValue({ accepted: false, snapshot: {
      ...starting, sequence: 623, phase: 'manual', incident: { incidentId: 'new-failure' },
    } })
    desktopRuntimeMocks.getSnapshot.mockResolvedValue({ ...starting, sequence: 622 })
    render(<StoryboardProvider><span>newer manual failure</span></StoryboardProvider>)
    await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve() })
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledExactlyOnceWith({ expectedSequence: 622 })
  })

  it('acknowledges a pending top-level frontend once after a real Core connection', async () => {
    const snapshot = { schemaVersion: 1, sequence: 500, phase: 'starting', incident: null, actions: [] }
    let runtimeListener
    desktopRuntimeMocks.subscribe.mockImplementation(listener => {
      runtimeListener = listener
      return vi.fn()
    })
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    desktopRuntimeMocks.confirmReady.mockResolvedValue({
      accepted: true,
      snapshot: { ...snapshot, sequence: 501, phase: 'ready' },
    })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('disconnected')
    render(<StoryboardProvider><span>mounted workspace</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve() })
    expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()

    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'connected' } })))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(runtimeListener).toBeTypeOf('function')
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledTimes(1)
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledWith({ expectedSequence: 500 })
  })

  it('records render readiness milestones without widening the existing connected/starting ACK guard', async () => {
    const diagnostics = { record: vi.fn(), snapshot: vi.fn() }
    window.__hypercanvasStartupDiagnostics = diagnostics
    const snapshot = { schemaVersion: 1, sequence: 541, phase: 'starting', incident: null, actions: [] }
    let runtimeListener
    desktopRuntimeMocks.subscribe.mockImplementation(listener => {
      runtimeListener = listener
      return vi.fn()
    })
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    desktopRuntimeMocks.confirmReady.mockResolvedValue({
      accepted: true,
      snapshot: { ...snapshot, sequence: 542, phase: 'ready' },
    })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('disconnected')
    const view = render(<StoryboardProvider><span>diagnosed workspace</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()
    expect(diagnostics.record.mock.calls.map(([event]) => [event.stage, event.outcome])).toEqual(expect.arrayContaining([
      ['provider-effect', 'entered'],
      ['runtime-subscription', 'started'],
      ['runtime-subscription', 'accepted'],
      ['runtime-snapshot', 'started'],
      ['runtime-snapshot', 'accepted'],
      ['websocket', 'disconnected'],
    ]))

    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'connected' } })))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(runtimeListener).toBeTypeOf('function')
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledTimes(1)
    expect(diagnostics.record.mock.calls.map(([event]) => [event.stage, event.outcome])).toEqual(expect.arrayContaining([
      ['websocket', 'connected'], ['frontend-ready', 'invoked'], ['frontend-ready', 'accepted'],
    ]))
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'frontend-ready', outcome: 'accepted', runtimeSequence: 542, code: 'confirm-accepted',
    }))
    const acceptedDiagnosticCount = diagnostics.record.mock.calls.length
    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'disconnected' } })))
    expect(diagnostics.record).toHaveBeenCalledTimes(acceptedDiagnosticCount)
    view.unmount()
  })

  it('records bridge failures as bounded string evidence without changing readiness authority', async () => {
    const diagnostics = { record: vi.fn(), snapshot: vi.fn() }
    window.__hypercanvasStartupDiagnostics = diagnostics
    desktopRuntimeMocks.subscribe.mockImplementation(() => { throw new Error('TrustedOrigins rejected https://localhost/?token=do-not-persist') })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    render(<StoryboardProvider><span>bridge failure workspace</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve() })

    expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'runtime-subscription',
      outcome: 'failed',
      code: 'bridge-subscribe-failed',
      message: expect.stringContaining('TrustedOrigins'),
    }))
    const message = diagnostics.record.mock.calls.find(([event]) =>
      event.stage === 'runtime-subscription' && event.outcome === 'failed')?.[0].message
    expect(message).toBeTypeOf('string')
  })

  it('records a rejected frontend-ready bridge call without changing its request or result handling', async () => {
    const diagnostics = { record: vi.fn(), snapshot: vi.fn() }
    window.__hypercanvasStartupDiagnostics = diagnostics
    const snapshot = { schemaVersion: 1, sequence: 549, phase: 'starting', incident: null, actions: [] }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    desktopRuntimeMocks.confirmReady.mockRejectedValue(new Error('Go methods denied by TrustedOrigins at https://localhost/?__hc_launch=private'))
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    render(<StoryboardProvider><span>ACK denial workspace</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })

    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledWith({ expectedSequence: 549 })
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'frontend-ready',
      outcome: 'invoked',
      runtimeSequence: 549,
    }))
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'frontend-ready',
      outcome: 'failed',
      runtimeSequence: 549,
      code: 'confirm-rpc-failed',
      message: expect.stringContaining('TrustedOrigins'),
    }))
  })

  it('does not acknowledge disconnected, isolated, or static documents', async () => {
    const snapshot = { schemaVersion: 1, sequence: 510, phase: 'starting', incident: null, actions: [] }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    desktopRuntimeMocks.confirmReady.mockResolvedValue({ accepted: true, snapshot })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('disconnected')

    const disconnected = render(<StoryboardProvider><span>disconnected host</span></StoryboardProvider>)
    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'disconnected' } })))
    await act(async () => { await Promise.resolve() })
    disconnected.unmount()
    render(<StoryboardProvider isolated><span>isolated provider</span></StoryboardProvider>)
    vi.stubGlobal('__HYPERCANVAS_NOTEBOOK_PUBLICATION__', true)
    render(<StoryboardProvider><span>static provider</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve() })

    expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('ignores an ACK result after the provider unmounts', async () => {
    const snapshot = { schemaVersion: 1, sequence: 520, phase: 'recovering', incident: { incidentId: 'i', correlationId: 'c' }, actions: [] }
    let resolveAck
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    desktopRuntimeMocks.confirmReady.mockImplementation(() => new Promise(resolve => { resolveAck = resolve }))
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    const view = render(<StoryboardProvider><span>temporary host</span></StoryboardProvider>)
    await act(async () => { await Promise.resolve() })
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledWith({ expectedSequence: 520 })
    view.unmount()
    desktopRuntimeMocks.reconcile.mockClear()
    await act(async () => {
      resolveAck({ accepted: true, snapshot: { ...snapshot, sequence: 521, phase: 'ready' } })
      await Promise.resolve()
    })

    expect(desktopRuntimeMocks.reconcile).not.toHaveBeenCalled()
  })

  it('coalesces StrictMode replay for the same pending sequence', async () => {
    const snapshot = { schemaVersion: 1, sequence: 530, phase: 'starting', incident: null, actions: [] }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    desktopRuntimeMocks.confirmReady.mockResolvedValue({ accepted: true, snapshot: { ...snapshot, sequence: 531, phase: 'ready' } })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    render(<StrictMode><StoryboardProvider><span>strict host</span></StoryboardProvider></StrictMode>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledTimes(1)
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledWith({ expectedSequence: 530 })
    expect(desktopRuntimeMocks.reconcile).toHaveBeenCalledWith(snapshot, expect.objectContaining({ sequence: 531, phase: 'ready' }))
  })

  it('owns the workspace connection even when no feature subscribes', () => {
    const release = vi.fn()
    const start = vi.spyOn(storyboardWs, 'start').mockReturnValue(release)
    const { unmount } = render(
      <StoryboardProvider>
        <span>prototype-only content</span>
      </StoryboardProvider>,
    )
    expect(screen.getByText('prototype-only content')).toBeInTheDocument()
    expect(start).toHaveBeenCalledOnce()
    unmount()
    expect(release).toHaveBeenCalledOnce()
    start.mockRestore()
  })

  it('does not own a Core connection for isolated content', () => {
    const start = vi.spyOn(storyboardWs, 'start').mockReturnValue(vi.fn())
    render(
      <StoryboardProvider isolated>
        <span>isolated content</span>
      </StoryboardProvider>,
    )
    expect(screen.getByText('isolated content')).toBeInTheDocument()
    expect(start).not.toHaveBeenCalled()
    start.mockRestore()
  })

  it('does not own a Core connection for a static publication', () => {
    vi.stubGlobal('__HYPERCANVAS_NOTEBOOK_PUBLICATION__', true)
    const start = vi.spyOn(storyboardWs, 'start').mockReturnValue(vi.fn())
    render(
      <StoryboardProvider>
        <span>published workspace</span>
      </StoryboardProvider>,
    )
    expect(screen.getByText('published workspace')).toBeInTheDocument()
    expect(start).not.toHaveBeenCalled()
    start.mockRestore()
    vi.unstubAllGlobals()
  })

  it('renders children when flow loads successfully', () => {
    render(
      <StoryboardProvider>
        <span>child content</span>
      </StoryboardProvider>,
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('starts the shared Core connection so the recovery overlay can clear on initial connect', () => {
    const connect = vi.spyOn(storyboardWs, 'connect').mockResolvedValue(undefined)

    render(
      <StoryboardProvider>
        <span>child content</span>
      </StoryboardProvider>,
    )

    expect(connect).toHaveBeenCalledOnce()
    connect.mockRestore()
  })

  it('does not open a Core connection for an isolated frame', () => {
    const connect = vi.spyOn(storyboardWs, 'connect').mockResolvedValue(undefined)

    render(
      <StoryboardProvider isolated>
        <span>isolated content</span>
      </StoryboardProvider>,
    )

    expect(connect).not.toHaveBeenCalled()
    connect.mockRestore()
  })

  it('keeps the HTML document title blank after the provider mounts', () => {
    render(
      <StoryboardProvider>
        <span>child content</span>
      </StoryboardProvider>,
    )

    expect(document.title).toBe('')
  })

  it('shows only a spinner first, then adds Refresh after a sustained Core recovery episode', () => {
    vi.useFakeTimers()
    render(
      <StoryboardProvider>
        <span>workspace content</span>
      </StoryboardProvider>,
    )
    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'disconnected' } })))
    expect(screen.getByRole('status', { name: 'Reconnecting to Core' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Reconnecting to Core' }).querySelector('.main-loading-spinner')).toBeInTheDocument()
    expect(screen.queryByText('Still reconnecting to Core')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    expect(screen.queryByText('Hypercanvas is disconnected')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_999))
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByText('Still reconnecting to Core')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('rearms the recovery timer when StrictMode replays effects during initial connection', () => {
    vi.useFakeTimers()
    render(
      <StrictMode>
        <StoryboardProvider>
          <span>workspace content</span>
        </StoryboardProvider>
      </StrictMode>,
    )

    expect(screen.getByRole('status', { name: 'Reconnecting to Core' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2_001))
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('keeps the two-second escalation timer across repeated reconnect attempts', () => {
    vi.useFakeTimers()
    render(
      <StoryboardProvider>
        <span>workspace content</span>
      </StoryboardProvider>,
    )
    const connectionEvent = state => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state } }))

    act(() => connectionEvent('disconnected'))
    act(() => vi.advanceTimersByTime(700))
    act(() => connectionEvent('connecting'))
    act(() => vi.advanceTimersByTime(600))
    act(() => connectionEvent('disconnected'))
    act(() => vi.advanceTimersByTime(700))
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('clears the spinner and escalation timer when Core recovers', () => {
    vi.useFakeTimers()
    render(
      <StoryboardProvider>
        <span>workspace content</span>
      </StoryboardProvider>,
    )

    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'disconnected' } })))
    expect(screen.getByRole('status', { name: 'Reconnecting to Core' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1_000))
    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'connected' } })))
    expect(screen.queryByRole('status', { name: 'Reconnecting to Core' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2_001))

    expect(screen.queryByRole('status', { name: 'Reconnecting to Core' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
    expect(screen.getByText('workspace content')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('keeps Notebook switching as one spinner when Core disconnects for the handoff', () => {
    vi.useFakeTimers()
    render(
      <StoryboardProvider>
        <span>workspace content</span>
      </StoryboardProvider>,
    )

    act(() => window.dispatchEvent(new CustomEvent('storyboard:notebook-switch', { detail: { state: 'started' } })))
    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'disconnected' } })))

    expect(screen.getByRole('status', { name: 'Switching Notebook' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Switching Notebook' }).querySelector('.main-loading-spinner')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Reconnecting to Core' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2_001))
    expect(screen.getByRole('status', { name: 'Switching Notebook' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Reconnecting to Core' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()

    act(() => window.dispatchEvent(new CustomEvent('storyboard:notebook-switch', { detail: { state: 'failed' } })))
    expect(screen.queryByRole('status', { name: 'Switching Notebook' })).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Reconnecting to Core' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('does not show a Core reconnect overlay in a static publication', () => {
    vi.stubGlobal('__HYPERCANVAS_NOTEBOOK_PUBLICATION__', true)
    const connect = vi.spyOn(storyboardWs, 'connect').mockResolvedValue(undefined)
    render(
      <StoryboardProvider>
        <span>published workspace content</span>
      </StoryboardProvider>,
    )
    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'disconnected' } })))
    expect(screen.getByText('published workspace content')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(connect).not.toHaveBeenCalled()
    connect.mockRestore()
    vi.unstubAllGlobals()
  })

  it('restores a pending recovery notice from session storage', () => {
    setFlag('document-reload-notice', true)
    window.sessionStorage.setItem('__hypercanvas_reload_pending__', JSON.stringify({ kind: 'recovery', reason: 'dynamic import failed' }))
    render(
      <SidebarNoticeHost><StoryboardProvider>
        <span>workspace content</span>
      </StoryboardProvider></SidebarNoticeHost>,
    )
    expect(screen.getByRole('status', { name: 'Pending document reload' })).toHaveTextContent('An automatic dependency recovery is waiting')
    expect(screen.getByRole('button', { name: 'Reload now' })).toBeInTheDocument()
  })

  it('keeps a restored recovery action from being downgraded by a routine update notice', () => {
    setFlag('document-reload-notice', true)
    window.sessionStorage.setItem('__hypercanvas_reload_pending__', JSON.stringify({ kind: 'recovery', reason: 'dynamic import failed' }))
    render(
      <SidebarNoticeHost><StoryboardProvider>
        <span>workspace content</span>
      </StoryboardProvider></SidebarNoticeHost>,
    )

    act(() => window.dispatchEvent(new CustomEvent('storyboard:reload-pending', {
      detail: { kind: 'document-update', reason: 'prototype' },
    })))

    expect(screen.getByRole('status', { name: 'Pending document reload' })).toHaveTextContent('An automatic dependency recovery is waiting')
    act(() => screen.getByRole('button', { name: 'Reload now' }).click())
    expect(screen.getByRole('status', { name: 'Pending document reload' })).toHaveTextContent('An automatic dependency recovery is waiting')
  })

  it('shows server-reported pending document updates', () => {
    setFlag('document-reload-notice', true)
    render(
      <SidebarNoticeHost><StoryboardProvider>
        <span>workspace content</span>
      </StoryboardProvider></SidebarNoticeHost>,
    )
    act(() => window.dispatchEvent(new CustomEvent('storyboard:reload-pending', { detail: { kind: 'document-update', reason: 'prototype' } })))
    expect(screen.getByRole('status', { name: 'Pending document reload' })).toHaveTextContent('A document update is ready')
    expect(screen.getByRole('button', { name: 'Reload now' })).toBeInTheDocument()
  })

  it('dismisses the pending reload notice and re-shows it for the next pending update', () => {
    setFlag('document-reload-notice', true)
    render(
      <SidebarNoticeHost><StoryboardProvider>
        <span>workspace content</span>
      </StoryboardProvider></SidebarNoticeHost>,
    )
    act(() => window.dispatchEvent(new CustomEvent('storyboard:reload-pending', { detail: { kind: 'document-update', reason: 'first' } })))
    expect(screen.getByRole('status', { name: 'Pending document reload' })).toBeInTheDocument()
    act(() => screen.getByRole('button', { name: 'Dismiss' }).click())
    expect(screen.queryByRole('status', { name: 'Pending document reload' })).not.toBeInTheDocument()
    // A new pending update is a new message and re-shows the notice.
    act(() => window.dispatchEvent(new CustomEvent('storyboard:reload-pending', { detail: { kind: 'document-update', reason: 'second' } })))
    expect(screen.getByRole('status', { name: 'Pending document reload' })).toBeInTheDocument()
  })

  it('renders runtime incidents in the sidebar notice slot with per-incident dismissal', async () => {
    const listeners = []
    desktopRuntimeMocks.subscribe.mockImplementation((listener) => {
      listeners.push(listener)
      return () => {}
    })
    desktopRuntimeMocks.getSnapshot.mockResolvedValue({ schemaVersion: 1, sequence: 10, phase: 'starting', incident: null, actions: [] })
    // The injected fallback card does not survive the sidebar taking over.
    document.body.insertAdjacentHTML('beforeend', '<aside id="hypercanvas-startup-notice">stale</aside>')
    render(<SidebarNoticeHost><StoryboardProvider>
      <span>workspace content</span>
    </StoryboardProvider></SidebarNoticeHost>)
    await act(async () => { await Promise.resolve() })

    expect(window.__HYPERCANVAS_SIDEBAR_RUNTIME_NOTICE__).toBe(true)
    expect(document.getElementById('hypercanvas-startup-notice')).toBeNull()
    expect(screen.queryByRole('status', { name: 'Runtime incident' })).not.toBeInTheDocument()

    act(() => listeners.forEach(listener => listener({
      schemaVersion: 1, sequence: 11, phase: 'recovering',
      incident: {
        incidentId: 'incident-a', code: 'CORE_UPSTREAM_UNAVAILABLE', title: 'Hypercanvas service is unavailable',
        description: 'The local service needed for this page did not respond.',
        schemaVersion: 1, recovery: { state: 'recovering', attempt: 1, limit: 3, action: 'retry-core' },
      },
      actions: [],
    })))

    const notice = screen.getByRole('status', { name: 'Runtime incident' })
    expect(notice).toHaveTextContent('Lost connection to Hypercanvas')
    expect(screen.getByTestId('notice-slot')).toContainElement(notice)

    // Dismissing the incident keeps it hidden while the incident is current.
    act(() => screen.getByRole('button', { name: 'Dismiss' }).click())
    expect(screen.queryByRole('status', { name: 'Runtime incident' })).not.toBeInTheDocument()

    // A newer sequence with a new incident re-shows the notice.
    act(() => listeners.forEach(listener => listener({
      schemaVersion: 1, sequence: 12, phase: 'manual',
      incident: {
        incidentId: 'incident-b', code: 'CORE_START_FAILED', title: 'Connecting the workspace document',
        description: 'Core is available. Waiting for the workspace document to finish loading.',
        schemaVersion: 1, recovery: { state: 'manual', attempt: 1, limit: 1, action: 'reload-page' },
      },
      actions: ['reload-page'],
    })))
    const failure = screen.getByRole('alert', { name: 'Runtime incident' })
    expect(failure).toHaveTextContent('Hypercanvas couldn’t start')
    act(() => listeners.forEach(listener => listener({
      schemaVersion: 1, sequence: 13, phase: 'ready', incident: null, actions: [],
    })))
    expect(screen.queryByRole('status', { name: 'Runtime incident' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert', { name: 'Runtime incident' })).not.toBeInTheDocument()
  })

  describe('reload notice precedence', () => {
    const incident = (id = 'incident-a') => ({
      incidentId: id, code: 'CORE_UPSTREAM_UNAVAILABLE', title: 'Hypercanvas service is unavailable',
      description: 'The local service needed for this page did not respond.',
      schemaVersion: 1, recovery: { state: 'recovering', attempt: 0, limit: 1, action: 'reload-page' },
    })
    let listeners
    const emit = snapshot => act(() => listeners.forEach(listener => listener({ schemaVersion: 1, ...snapshot })))
    const recovering = (actions = ['reload-page'], id) => ({ sequence: 11, phase: 'recovering', incident: incident(id), actions })
    const documentNotice = () => screen.queryByRole('status', { name: 'Pending document reload' })
    const runtimeNotice = () => screen.queryByRole('status', { name: 'Runtime incident' })

    async function mountWithPendingUpdate({ flag = true } = {}) {
      setFlag('document-reload-notice', flag)
      listeners = []
      desktopRuntimeMocks.subscribe.mockImplementation((listener) => { listeners.push(listener); return () => {} })
      desktopRuntimeMocks.getSnapshot.mockResolvedValue({ schemaVersion: 1, sequence: 10, phase: 'starting', incident: null, actions: [] })
      render(<SidebarNoticeHost><StoryboardProvider><span>workspace</span></StoryboardProvider></SidebarNoticeHost>)
      await act(async () => { await Promise.resolve() })
      act(() => window.dispatchEvent(new CustomEvent('storyboard:reload-pending', { detail: { kind: 'document-update', reason: 'prototype' } })))
    }

    it('shows only the runtime reload warning when both notices would be visible', async () => {
      await mountWithPendingUpdate()
      expect(documentNotice()).toHaveTextContent('A document update is ready')
      emit(recovering())
      expect(runtimeNotice()).toBeInTheDocument()
      expect(documentNotice()).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Reload' })).toHaveLength(1)
      expect(screen.queryByRole('button', { name: 'Reload now' })).not.toBeInTheDocument()
    })

    it('returns the pending document notice after the runtime warning is dismissed', async () => {
      await mountWithPendingUpdate()
      emit(recovering())
      act(() => screen.getByRole('button', { name: 'Dismiss' }).click())
      expect(runtimeNotice()).not.toBeInTheDocument()
      expect(documentNotice()).toHaveTextContent('A document update is ready')
    })

    it('returns the pending document notice when the runtime recovers', async () => {
      await mountWithPendingUpdate()
      emit(recovering())
      expect(documentNotice()).not.toBeInTheDocument()
      emit({ sequence: 12, phase: 'ready', incident: null, actions: [] })
      expect(runtimeNotice()).not.toBeInTheDocument()
      expect(documentNotice()).toHaveTextContent('A document update is ready')
    })

    it('does not suppress the document notice for a runtime notice without a reload action', async () => {
      await mountWithPendingUpdate()
      emit(recovering([]))
      expect(runtimeNotice()).toBeInTheDocument()
      expect(documentNotice()).toBeInTheDocument()
    })

    it('keeps a dismissed document notice hidden after the runtime warning clears', async () => {
      await mountWithPendingUpdate()
      act(() => screen.getByRole('button', { name: 'Dismiss' }).click())
      emit(recovering())
      emit({ sequence: 12, phase: 'ready', incident: null, actions: [] })
      expect(documentNotice()).not.toBeInTheDocument()
    })

    it('keeps the document notice gated by its feature flag while the runtime warning shows', async () => {
      await mountWithPendingUpdate({ flag: false })
      emit(recovering())
      expect(runtimeNotice()).toBeInTheDocument()
      expect(documentNotice()).not.toBeInTheDocument()
      emit({ sequence: 12, phase: 'ready', incident: null, actions: [] })
      expect(documentNotice()).not.toBeInTheDocument()
      act(() => setFlag('document-reload-notice', true))
      expect(documentNotice()).toBeInTheDocument()
    })
  })

  it('hides only the notice when disabled and retains pending state for a later flag change', () => {
    setFlag('document-reload-notice', false)
    render(<SidebarNoticeHost><StoryboardProvider><span>workspace</span></StoryboardProvider></SidebarNoticeHost>)
    act(() => window.dispatchEvent(new CustomEvent('storyboard:reload-pending', { detail: { kind: 'document-update' } })))
    expect(screen.queryByRole('status', { name: 'Pending document reload' })).not.toBeInTheDocument()
    act(() => setFlag('document-reload-notice', true))
    const notice = screen.getByRole('status', { name: 'Pending document reload' })
    expect(screen.getByTestId('notice-slot')).toContainElement(notice)
    expect(screen.getByTestId('notice-slot').nextElementSibling).toHaveTextContent('Sidebar footer')
    expect(notice.style.position).toBe('')
    act(() => setFlag('document-reload-notice', false))
    expect(screen.queryByRole('status', { name: 'Pending document reload' })).not.toBeInTheDocument()
  })

  it('keeps the actual shell notice slot in flow directly before its footer', () => {
    const source = fs.readFileSync(path.resolve('packages/storyboard/src/internals/NotebookShell/NotebookShell.jsx'), 'utf8')
    expect(source).toMatch(/<\/SidebarContent>\s*\{!published && <div ref=\{setNoticeSlot\}[^>]*data-slot="sidebar-reload-notice" \/>\}\s*<SidebarFooter/)
    const styles = fs.readFileSync(path.resolve('packages/storyboard/src/internals/NotebookShell/NotebookShell.module.css'), 'utf8')
    const noticeStyles = styles.match(/\.reloadNotice(?:Slot)?(?::empty)?\s*\{[^}]+\}/g).join('\n')
    expect(noticeStyles).not.toMatch(/position\s*:\s*(fixed|absolute)/)
  })

  it('does not float a notice when the sidebar is absent', () => {
    setFlag('document-reload-notice', true)
    render(<StoryboardProvider><span>workspace</span></StoryboardProvider>)
    act(() => window.dispatchEvent(new CustomEvent('storyboard:reload-pending', { detail: { kind: 'document-update' } })))
    expect(screen.queryByRole('status', { name: 'Pending document reload' })).not.toBeInTheDocument()
  })

  it('provides flow data via context', () => {
    render(
      <StoryboardProvider>
        <ContextReader path="title" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('Default Scene')
  })

  it('uses flowName prop when provided', () => {
    render(
      <StoryboardProvider flowName="other">
        <ContextReader path="title" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('Other Scene')
  })

  it('uses sceneName prop for backward compat', () => {
    render(
      <StoryboardProvider sceneName="other">
        <ContextReader path="title" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('Other Scene')
  })

  it("falls back to 'default' flow when no ?scene= param", () => {
    render(
      <StoryboardProvider>
        <ContextReader path="title" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('Default Scene')
  })

  it('shows error message when flow fails to load', () => {
    render(
      <StoryboardProvider flowName="nonexistent">
        <ContextReader />
      </StoryboardProvider>,
    )
    expect(screen.getByText(/Error loading flow/)).toBeInTheDocument()
  })

  it('provides flowName in context value', () => {
    function FlowNameReader() {
      const ctx = useContext(StoryboardContext)
      return <span data-testid="name">{ctx?.flowName}</span>
    }
    render(
      <StoryboardProvider flowName="other">
        <FlowNameReader />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('name')).toHaveTextContent('other')
  })

  it('provides sceneName (backward compat) in context value', () => {
    function SceneNameReader() {
      const ctx = useContext(StoryboardContext)
      return <span data-testid="name">{ctx?.sceneName}</span>
    }
    render(
      <StoryboardProvider flowName="other">
        <SceneNameReader />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('name')).toHaveTextContent('other')
  })

  it('provides loading: false in context value', () => {
    function LoadingReader() {
      const ctx = useContext(StoryboardContext)
      return <span data-testid="loading">{String(ctx?.loading)}</span>
    }
    render(
      <StoryboardProvider>
        <LoadingReader />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })

  it('auto-matches flow by pathname and resolves $ref data', () => {
    init({
      flows: {
        default: { title: 'Default' },
        Repositories: {
          '$global': ['navigation'],
          heading: 'All repos',
        },
      },
      objects: {
        navigation: { topnav: [{ label: 'Home' }, { label: 'Repos' }] },
      },
      records: {},
    })

    // Simulate navigating to /base/Repositories
    mockUseLocation.mockReturnValue({ pathname: '/base/Repositories', search: '', hash: '' })

    render(
      <StoryboardProvider>
        <ContextReader path="heading" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('All repos')
  })

  it('resolves $ref objects when auto-matching flow by pathname', () => {
    init({
      flows: {
        default: { title: 'Default' },
        Repositories: {
          '$global': ['navigation'],
          heading: 'All repos',
        },
      },
      objects: {
        navigation: { topnav: [{ label: 'Home' }, { label: 'Repos' }] },
      },
      records: {},
    })

    mockUseLocation.mockReturnValue({ pathname: '/base/Repositories', search: '', hash: '' })

    function NavReader() {
      const ctx = useContext(StoryboardContext)
      const topnav = ctx?.data?.topnav
      return <span data-testid="nav">{topnav ? topnav.map(n => n.label).join(',') : 'none'}</span>
    }

    render(
      <StoryboardProvider>
        <NavReader />
      </StoryboardProvider>,
    )
    // $global navigation object should be resolved — topnav merged at root
    expect(screen.getByTestId('nav')).toHaveTextContent('Home,Repos')
  })

  it('reads ?flow= param from location.search', () => {
    mockUseLocation.mockReturnValue({ pathname: '/whatever', search: '?flow=other', hash: '' })

    render(
      <StoryboardProvider>
        <ContextReader path="title" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('Other Scene')
  })

  it('reads ?scene= as alias for ?flow=', () => {
    mockUseLocation.mockReturnValue({ pathname: '/whatever', search: '?scene=other', hash: '' })

    render(
      <StoryboardProvider>
        <ContextReader path="title" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('Other Scene')
  })

  it('prefers ?flow= over ?scene= when both present', () => {
    mockUseLocation.mockReturnValue({ pathname: '/whatever', search: '?flow=other&scene=default', hash: '' })

    render(
      <StoryboardProvider>
        <ContextReader path="title" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('Other Scene')
  })

  it('loads prototype flow for sub-pages when no page-specific flow exists', () => {
    init({
      flows: {
        default: { title: 'Global Default' },
        'Example/example': { title: 'Example Flow' },
      },
      objects: {},
      records: {},
    })

    // /Example/Forms — no Forms flow exists, should fall back to Example/example
    mockUseLocation.mockReturnValue({ pathname: '/Example/Forms', search: '', hash: '' })

    render(
      <StoryboardProvider>
        <ContextReader path="title" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('Example Flow')
  })

  it('maps a canonical encoded prototype route to the logical scope across provider data and hooks', () => {
    init({
      flows: {
        default: { title: 'Global default' },
        'Other/default': { title: 'Other prototype default' },
        'Account/default': {
          title: 'Account prototype default',
          profile: { $ref: 'profile' },
        },
      },
      objects: {
        profile: { source: 'global object' },
        'Other/profile': { source: 'other prototype object' },
        'Account/profile': { source: 'account prototype object' },
      },
      records: {
        entries: [{ id: '42', source: 'global record' }],
        'Other/entries': [{ id: '42', source: 'other prototype record' }],
        'Account/entries': [{ id: '42', source: 'account prototype record' }],
      },
      prototypes: {
        Other: { tokens: { activePrototype: 'other' } },
        Account: { tokens: { activePrototype: 'account' } },
      },
    })
    initKnobs({
      prototypeKnobs: {
        Other: [{ id: 'accent', type: 'text', default: 'other knob' }],
        Account: [{ id: 'accent', type: 'text', default: 'account knob' }],
      },
    })
    mockUseLocation.mockReturnValue({ pathname: '/Account.prototype', search: '', hash: '' })
    mockUseParams.mockReturnValue({ id: '42' })
    window.history.replaceState(null, '', '/')

    function ScopedDataReader() {
      const context = useContext(StoryboardContext)
      const object = useObject('profile')
      const record = useRecord('entries', 'id')
      const knob = useKnob('accent')
      return (
        <div>
          <span data-testid="scope">{context?.prototypeName}</span>
          <span data-testid="flow">{context?.flowName}</span>
          <span data-testid="flow-title">{context?.data?.title}</span>
          <span data-testid="flow-object">{context?.data?.profile?.source}</span>
          <span data-testid="object-hook">{object?.source}</span>
          <span data-testid="context-record">{context?.data?.record?.source}</span>
          <span data-testid="record-hook">{record?.source}</span>
          <span data-testid="knob">{knob}</span>
        </div>
      )
    }

    const view = render(
      <StoryboardProvider recordName="entries" recordParam="id">
        <ScopedDataReader />
      </StoryboardProvider>,
    )

    expect(screen.getByTestId('scope')).toHaveTextContent('Account')
    expect(screen.getByTestId('flow')).toHaveTextContent('Account/default')
    expect(screen.getByTestId('flow-title')).toHaveTextContent('Account prototype default')
    expect(screen.getByTestId('flow-object')).toHaveTextContent('account prototype object')
    expect(screen.getByTestId('object-hook')).toHaveTextContent('account prototype object')
    expect(screen.getByTestId('context-record')).toHaveTextContent('account prototype record')
    expect(screen.getByTestId('record-hook')).toHaveTextContent('account prototype record')
    expect(screen.getByTestId('knob')).toHaveTextContent('account knob')
    expect(new URL(window.location.href).searchParams.get('activePrototype')).toBe('account')

    view.unmount()
    window.history.replaceState(null, '', '/')
  })

  it.each([
    ['/Caf%C3%A9.prototype/Overview', 'Café', 'Café prototype default'],
    ['/Release.v2.prototype/Overview', 'Release.v2', 'Dotted prototype default'],
  ])('decodes the canonical root in child route %s', (pathname, logicalName, title) => {
    init({
      flows: {
        default: { title: 'Global default' },
        'Other/default': { title: 'Other prototype default' },
        'Café/default': { title: 'Café prototype default' },
        'Release.v2/default': { title: 'Dotted prototype default' },
      },
      objects: {},
      records: {},
    })
    mockUseLocation.mockReturnValue({ pathname, search: '', hash: '' })

    function ScopeReader() {
      const context = useContext(StoryboardContext)
      return (
        <>
          <span data-testid="scope">{context?.prototypeName}</span>
          <span data-testid="flow">{context?.flowName}</span>
          <span data-testid="title">{context?.data?.title}</span>
        </>
      )
    }

    render(
      <StoryboardProvider>
        <ScopeReader />
      </StoryboardProvider>,
    )

    expect(screen.getByTestId('scope')).toHaveTextContent(logicalName)
    expect(screen.getByTestId('flow')).toHaveTextContent(`${logicalName}/default`)
    expect(screen.getByTestId('title')).toHaveTextContent(title)
  })

  it('page-specific flow takes priority over prototype flow', () => {
    init({
      flows: {
        default: { title: 'Global Default' },
        'Example/example': { title: 'Example Flow' },
        'Example/Forms': { title: 'Forms Flow' },
      },
      objects: {},
      records: {},
    })

    mockUseLocation.mockReturnValue({ pathname: '/Example/Forms', search: '', hash: '' })

    render(
      <StoryboardProvider>
        <ContextReader path="title" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('Forms Flow')
  })

  it('falls to global default when no prototype flow exists', () => {
    init({
      flows: {
        default: { title: 'Global Default' },
      },
      objects: {},
      records: {},
    })

    mockUseLocation.mockReturnValue({ pathname: '/NoProto/SomePage', search: '', hash: '' })

    render(
      <StoryboardProvider>
        <ContextReader path="title" />
      </StoryboardProvider>,
    )
    expect(screen.getByTestId('ctx')).toHaveTextContent('Global Default')
  })

  it('shows a simple 404 for unknown canvas routes with a reload action', () => {
    mockUseLocation.mockReturnValue({ pathname: '/canvas/unknown-board', search: '', hash: '' })

    render(
      <StoryboardProvider>
        <ContextReader />
      </StoryboardProvider>,
    )

    expect(screen.getByText('Canvas not found')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('data-hc-full-error')
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /notebook sidebar/i })).toBeNull()
  })

  it('uses the persistent desktop marker for canvas error reload wording', () => {
    document.documentElement.setAttribute('data-hc-desktop-shell', '')
    mockUseLocation.mockReturnValue({ pathname: '/canvas/unknown-board', search: '', hash: '' })

    render(
      <StoryboardProvider>
        <ContextReader />
      </StoryboardProvider>,
    )

    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload page' })).toBeNull()
    expect(screen.queryByRole('button', { name: /notebook sidebar/i })).toBeNull()
    document.documentElement.removeAttribute('data-hc-desktop-shell')
  })

  it('strips dev-domain prefix in local dev (Caddy proxy) so canvas routes resolve', () => {
    // Local dev via Caddy: window.location.pathname includes the /{devDomain}/
    // prefix even though BASE_URL is `/` (the proxy strips it before forwarding
    // to the dev server). Without stripping, isCanvasPath returns false and the
    // 404 never renders — the canvas page just stays blank.
    const origLocalDev = window.__SB_LOCAL_DEV__
    const origDomain = window.__SB_DEV_DOMAIN__
    window.__SB_LOCAL_DEV__ = true
    window.__SB_DEV_DOMAIN__ = 'storyboard'
    try {
      mockUseLocation.mockReturnValue({ pathname: '/storyboard/canvas/unknown-board', search: '', hash: '' })

      render(
        <StoryboardProvider>
          <ContextReader />
        </StoryboardProvider>,
      )

      expect(screen.getByText('Canvas not found')).toBeInTheDocument()
    } finally {
      window.__SB_LOCAL_DEV__ = origLocalDev
      window.__SB_DEV_DOMAIN__ = origDomain
    }
  })

  it('does not strip dev-domain prefix when __SB_LOCAL_DEV__ is not set', () => {
    // Same URL shape, but production-like: prefix should be left alone so it
    // doesn't accidentally match canvas routes for unrelated path segments.
    const origDomain = window.__SB_DEV_DOMAIN__
    window.__SB_DEV_DOMAIN__ = 'storyboard'
    try {
      mockUseLocation.mockReturnValue({ pathname: '/storyboard/canvas/unknown-board', search: '', hash: '' })

      render(
        <StoryboardProvider>
          <ContextReader />
        </StoryboardProvider>,
      )

      // isCanvasPath sees `/storyboard/canvas/...` → does NOT start with `/canvas/`
      // → no 404, just renders flow context
      expect(screen.queryByText('Canvas not found')).not.toBeInTheDocument()
    } finally {
      window.__SB_DEV_DOMAIN__ = origDomain
    }
  })
})


it('marks the provider-owned story host after its actual branch commits', async () => {
  vi.resetModules()
  vi.doMock('virtual:storyboard-data-index', async importOriginal => ({ ...await importOriginal(), stories: {} }))
  // Authored iframe loading is owned by ContentFrame, not the native shell.
  vi.doMock('./ContentFrame/ContentFrame.jsx', () => ({ default: () => <iframe title="materialized story host" /> }))
  const { default: StoryProvider } = await import('./context.jsx')
  const { storyboardWs: storyWs } = await import('./storyboard-ws.js')
  const { stories } = await import('virtual:storyboard-data-index')
  const app = fs.readFileSync(path.resolve('src/library/_app.jsx'), 'utf8')
  const Marker = new Function('useEffect', app.match(/function InitialRouteReady\(\) \{[\s\S]*?\n\}/)[0] + '; return InitialRouteReady')(useEffect)
  let committed = false
  window.__hypercanvasInitialLoad = {
    routeReadiness: () => ({ required: true, committed, current: true }),
    markRouteReady: () => { committed = true; window.dispatchEvent(new Event('hypercanvas:initial-route-ready')) },
  }
  const snapshot = { schemaVersion: 1, sequence: 771, phase: 'starting', incident: null, actions: [] }
  desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
  desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
  desktopRuntimeMocks.confirmReady.mockResolvedValue({ accepted: true, snapshot: { ...snapshot, sequence: 772, phase: 'ready' } })
  vi.spyOn(storyWs, 'connectionState').mockReturnValue('connected')
  stories['managed-story'] = { _route: '/components/managed-story' }
  mockUseLocation.mockReturnValue({ pathname: '/components/managed-story', search: '', hash: '' })
  let view
  try {
    view = render(<StoryProvider initialRouteReadyMarker={<Marker />}><span>unused Outlet marker location</span></StoryProvider>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByTitle('materialized story host')).toBeInTheDocument()
    expect(screen.queryByText('unused Outlet marker location')).toBeNull()
    expect(committed).toBe(true)
    expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledExactlyOnceWith({ expectedSequence: 771 })
  } finally {
    view?.unmount()
    delete stories['managed-story']
    vi.doUnmock('./ContentFrame/ContentFrame.jsx')
    vi.doUnmock('virtual:storyboard-data-index')
    vi.resetModules()
  }
})

describe('Canvas lazy-module loading boundary', () => {
  it.each(['resolve', 'reject'])('shows the regular spinner until the lazy module promise can %s', async outcome => {
    vi.resetModules()
    let resolveModule
    let rejectModule
    const modulePromise = new Promise((resolve, reject) => { resolveModule = resolve; rejectModule = reject })
    vi.doMock('./canvas/CanvasPage.jsx', () => modulePromise)
    const app = fs.readFileSync(path.resolve('src/library/_app.jsx'), 'utf8')
    const Marker = new Function('useEffect', app.match(/function InitialRouteReady\(\) \{[\s\S]*?\n\}/)[0] + '; return InitialRouteReady')(useEffect)
    let committed = false
    window.__hypercanvasInitialLoad = {
      routeReadiness: () => ({ required: true, committed, current: true }),
      markRouteReady: () => { committed = true; window.dispatchEvent(new Event('hypercanvas:initial-route-ready')) },
    }
    const snapshot = { schemaVersion: 1, sequence: outcome === 'resolve' ? 761 : 762, phase: 'starting', incident: null, actions: [] }
    desktopRuntimeMocks.subscribe.mockImplementation(() => vi.fn())
    desktopRuntimeMocks.getSnapshot.mockResolvedValue(snapshot)
    desktopRuntimeMocks.confirmReady.mockResolvedValue({ accepted: true, snapshot: { ...snapshot, sequence: snapshot.sequence + 10, phase: 'ready' } })
    vi.spyOn(storyboardWs, 'connectionState').mockReturnValue('connected')
    const { storyboardWs: canvasWs } = await import('./storyboard-ws.js')
    vi.spyOn(canvasWs, 'connectionState').mockReturnValue('connected')
    const { default: CanvasProvider } = await import('./context.jsx')
    const { canvases } = await import('virtual:storyboard-data-index')
    canvases['lazy-test'] = { _route: '/canvas/lazy-test' }
    mockUseLocation.mockReturnValue({ pathname: '/canvas/lazy-test', search: '', hash: '' })
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<CanvasProvider initialRouteReadyMarker={<Marker />}><span>Route content</span></CanvasProvider>)
      const status = screen.getByRole('status', { name: 'Loading canvas' })
      expect(status.querySelector('.main-loading-spinner')).toHaveAttribute('aria-hidden', 'true')
      expect(status).not.toHaveStyle({ position: 'fixed' })
      expect(screen.queryByText('Canvas module ready')).toBeNull()
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()
      await act(async () => {
        if (outcome === 'resolve') resolveModule({ default: () => <p>Canvas module ready</p> })
        else rejectModule(new TypeError('Failed to fetch dynamically imported canvas module'))
        await modulePromise.catch(() => {})
      })
      expect(screen.queryByRole('status', { name: 'Loading canvas' })).toBeNull()
      if (outcome === 'resolve') {
        expect(screen.getByText('Canvas module ready')).toBeInTheDocument()
        expect(committed).toBe(true)
        expect(desktopRuntimeMocks.confirmReady).toHaveBeenCalledExactlyOnceWith({ expectedSequence: snapshot.sequence })
        expect(screen.queryByText('Canvas error')).toBeNull()
      } else {
        expect(screen.getByText('Canvas error')).toBeInTheDocument()
        expect(committed).toBe(false)
        expect(desktopRuntimeMocks.confirmReady).not.toHaveBeenCalled()
        expect(screen.getByRole('main')).toHaveAttribute('data-hc-full-error')
        expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
      }
    } finally {
      delete canvases['lazy-test']
      errorLog.mockRestore()
      vi.doUnmock('./canvas/CanvasPage.jsx')
      vi.resetModules()
      mockUseLocation.mockReturnValue({ pathname: '/', search: '', hash: '' })
    }
  })
})
