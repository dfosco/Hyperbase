import { act, render, waitFor } from '@testing-library/react'
import CanvasPage from './CanvasPage.jsx'
import { canvasViewportStorageKey } from './viewportState.js'

const fixture = vi.hoisted(() => ({
  canvas: null,
  loading: false,
  jsxExports: null,
  resizeCallbacks: [],
}))

vi.mock('./useCanvas.js', () => ({
  useCanvas: () => ({ canvas: fixture.canvas, loading: fixture.loading, jsxExports: fixture.jsxExports }),
}))
vi.mock('../../canvas/index.js', () => ({ Canvas: ({ children }) => <div>{children}</div> }))
vi.mock('./widgets/index.js', () => ({ getWidgetComponent: () => function MockWidget() { return <div>widget</div> } }))
vi.mock('./widgets/WidgetChrome.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('./widgets/widgetProps.js', () => ({ schemas: {}, getDefaults: () => ({}) }))
vi.mock('./widgets/widgetConfig.js', async () => {
  const actual = await vi.importActual('./widgets/widgetConfig.js')
  return {
    getFeatures: () => [], isResizable: () => false, isExpandable: () => false,
    getAnchorState: () => ({}), canAcceptConnection: () => false, isSplitScreenCapable: () => false,
    getChromeOptions: () => ({ enabled: true }),
    getInteractionOptions: () => ({ selectable: true, movable: true, resize: null, expandable: false, splitScreen: false, interactGate: false, interactGateLabel: 'Click to interact' }),
    isMovable: () => false, isEditableInProduction: () => false, schemas: {}, getMenuWidgetTypes: () => [],
    getConnectorDefaults: actual.getConnectorDefaults,
  }
})
vi.mock('./widgets/figmaUrl.js', () => ({ isFigmaUrl: () => false, sanitizeFigmaUrl: (url) => url }))
vi.mock('./canvasApi.js', () => ({
  addWidget: vi.fn(), batchOperations: vi.fn(), patchWidget: vi.fn(), updateCanvas: vi.fn(() => Promise.resolve({ success: true })),
  removeWidget: vi.fn(), uploadImage: vi.fn(), uploadAgentScreenshot: vi.fn(),
  checkGitHubCliAvailable: vi.fn(() => Promise.resolve({ available: true })), fetchGitHubEmbed: vi.fn(),
}))
vi.mock('./useUndoRedo.js', () => ({ default: () => ({ snapshot: vi.fn(), undo: vi.fn(), redo: vi.fn(), reset: vi.fn(), track: vi.fn(), trackMany: vi.fn(), trackBatch: vi.fn(), canUndo: false, canRedo: false }) }))

const savedViewport = { zoom: 125, scrollLeft: 1400, scrollTop: 1900 }
const canvas = (widgets) => ({
  _route: 'viewport-lifecycle', title: 'Viewport lifecycle', widgets, sources: [], gridSize: 18,
  centered: false, dotted: false, grid: false, colorMode: 'auto',
})

describe('CanvasPage viewport lifecycle', () => {
  beforeEach(() => {
    fixture.canvas = canvas([])
    fixture.loading = false
    fixture.jsxExports = null
    fixture.resizeCallbacks = []
    window.__SB_LOCAL_DEV__ = false
  })

  afterEach(() => {
    delete window.__SB_LOCAL_DEV__
    vi.unstubAllGlobals()
  })

  it('clears temporary fullscreen chrome on unmount and restores the link view', () => {
    window.history.replaceState(null, '', '/canvas/work?removeUI&showTools')
    const view = render(<CanvasPage canvasId="work" />)
    document.documentElement.classList.add('storyboard-canvas-immersive', 'storyboard-chrome-hidden')
    view.unmount()
    expect(document.documentElement).not.toHaveClass('storyboard-canvas-immersive')
    expect(document.documentElement).toHaveClass('storyboard-chrome-hidden', 'storyboard-chrome-completely-hidden')
    expect(window.location.search).toBe('?removeUI&showTools')
    window.history.replaceState(null, '', '/')
    document.documentElement.classList.remove('storyboard-chrome-hidden', 'storyboard-chrome-completely-hidden')
  })

  it('keeps saved pan and zoom through delayed content layout, effect cleanup, HMR-like replacement, and repeated reload', async () => {
    const key = canvasViewportStorageKey('viewport-lifecycle')
    localStorage.setItem(key, JSON.stringify(savedViewport))

    const dimensions = { clientWidth: 800, clientHeight: 600, scrollWidth: 4000, scrollHeight: 4000 }
    const descriptors = Object.fromEntries(Object.keys(dimensions).map((name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)]))
    for (const name of Object.keys(dimensions)) Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: () => dimensions[name] })
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { fixture.resizeCallbacks.push(callback) }
      observe() {}
      disconnect() {}
    })

    const settleEffects = async () => act(async () => new Promise((resolve) => setTimeout(resolve, 180)))
    const replaceDelayedContent = (view) => {
      // A transient empty layout can clamp the browser's live scroll position.
      // Hydration removes the scroller, then real data/HMR grows the surface again.
      dimensions.scrollWidth = 800
      dimensions.scrollHeight = 600
      const scroller = document.querySelector('[data-storyboard-canvas-scroll]')
      scroller.scrollLeft = 0
      scroller.scrollTop = 0
      act(() => scroller.dispatchEvent(new Event('scroll')))

      fixture.loading = true
      view.rerender(<CanvasPage canvasId="viewport-lifecycle" />)
      fixture.canvas = canvas([{ id: 'hydrated-widget', type: 'mock-widget', position: { x: 1800, y: 2200 }, props: { width: 300, height: 200 } }])
      dimensions.scrollWidth = 4000
      dimensions.scrollHeight = 4000
      fixture.loading = false
      view.rerender(<CanvasPage canvasId="viewport-lifecycle" />)
      act(() => fixture.resizeCallbacks.forEach((callback) => callback([])))
    }

    try {
      const first = render(<CanvasPage canvasId="viewport-lifecycle" />)
      let scroller = document.querySelector('[data-storyboard-canvas-scroll]')
      await waitFor(() => {
        expect(scroller.scrollLeft).toBe(savedViewport.scrollLeft)
        expect(scroller.scrollTop).toBe(savedViewport.scrollTop)
      })

      replaceDelayedContent(first)
      await settleEffects()
      scroller = document.querySelector('[data-storyboard-canvas-scroll]')
      expect(scroller.scrollLeft).toBe(savedViewport.scrollLeft)
      expect(scroller.scrollTop).toBe(savedViewport.scrollTop)
      expect(JSON.parse(localStorage.getItem(key))).toMatchObject(savedViewport)

      // Remount and repeat delayed data/layout replacement, as on reload/navigation.
      first.unmount()
      const second = render(<CanvasPage canvasId="viewport-lifecycle" />)
      scroller = document.querySelector('[data-storyboard-canvas-scroll]')
      await waitFor(() => expect(scroller.scrollTop).toBe(savedViewport.scrollTop))
      replaceDelayedContent(second)
      await settleEffects()
      scroller = document.querySelector('[data-storyboard-canvas-scroll]')
      expect(scroller.scrollLeft).toBe(savedViewport.scrollLeft)
      expect(scroller.scrollTop).toBe(savedViewport.scrollTop)
      expect(JSON.parse(localStorage.getItem(key))).toMatchObject(savedViewport)
      second.unmount()
    } finally {
      for (const [name, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor)
        else delete HTMLElement.prototype[name]
      }
    }
  })

  it('captures a wheel pan during pending restoration as user intent', async () => {
    const key = canvasViewportStorageKey('viewport-user-pan')
    localStorage.setItem(key, JSON.stringify(savedViewport))
    const dimensions = { clientWidth: 800, clientHeight: 600, scrollWidth: 1200, scrollHeight: 1000 }
    const descriptors = Object.fromEntries(Object.keys(dimensions).map((name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)]))
    for (const name of Object.keys(dimensions)) Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: () => dimensions[name] })
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { fixture.resizeCallbacks.push(callback) }
      observe() {}
      disconnect() {}
    })

    const settleEffects = async () => act(async () => new Promise((resolve) => setTimeout(resolve, 180)))
    let view
    try {
      view = render(<CanvasPage canvasId="viewport-user-pan" />)
      const scroller = document.querySelector('[data-storyboard-canvas-scroll]')
      await waitFor(() => expect(scroller).toBeTruthy())

      // The browser has clamped the saved 1400,1900 position to the current
      // nonzero maximum. A passive layout scroll must keep the saved target.
      scroller.scrollLeft = 400
      scroller.scrollTop = 400
      act(() => scroller.dispatchEvent(new Event('scroll')))
      await settleEffects()
      expect(JSON.parse(localStorage.getItem(key))).toMatchObject(savedViewport)

      // A following wheel gesture moves within the reduced range. CanvasPage
      // marks that scroll event as user initiated and replaces the old target.
      act(() => {
        scroller.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaX: 100, deltaY: 100 }))
        scroller.scrollLeft = 300
        scroller.scrollTop = 300
        scroller.dispatchEvent(new Event('scroll'))
      })
      await settleEffects()
      expect(JSON.parse(localStorage.getItem(key))).toMatchObject({ zoom: 125, scrollLeft: 300, scrollTop: 300 })
    } finally {
      view?.unmount()
      for (const [name, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor)
        else delete HTMLElement.prototype[name]
      }
    }
  })
})
