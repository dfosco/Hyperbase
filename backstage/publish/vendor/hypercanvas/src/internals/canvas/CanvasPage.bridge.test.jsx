import { fireEvent, render, screen, act, waitFor } from '@testing-library/react'
import CanvasPage from './CanvasPage.jsx'
import { initCanvasInteraction } from '../../core/stores/canvasInteractionStore.js'
import { canvasViewportStorageKey } from './viewportState.js'
import { getCanvasPrimerAttrs, getCanvasThemeVars } from './canvasTheme.js'
import { addWidget, checkGitHubCliAvailable, fetchGitHubEmbed, updateCanvas, uploadImage } from './canvasApi.js'

const pastedStoryPreview = vi.hoisted(() => ({
  createStoryPreview: vi.fn(),
  cleanupStoryPreview: vi.fn(),
}))

vi.mock('../story/createStoryPreview.js', () => pastedStoryPreview)

vi.mock('../../canvas/index.js', () => ({
  Canvas: ({ children, onDragEnd }) => (
    <div data-testid="tiny-canvas">
      {children}
      <button
        data-testid="drag-widget"
        onClick={() => onDragEnd?.('widget-1', { x: 111.4, y: 222.7 })}
      >
        drag widget
      </button>
      <button
        data-testid="drag-widget-negative"
        onClick={() => onDragEnd?.('widget-1', { x: -50, y: -30 })}
      >
        drag widget negative
      </button>
      <button
        data-testid="drag-source"
        onClick={() => onDragEnd?.('jsx-PrimaryButtons', { x: 333.2, y: 444.8 })}
      >
        drag source
      </button>
    </div>
  ),
}))

const mockCanvas = {
  title: 'Bridge Test Canvas',
  widgets: [{ id: 'widget-1', type: 'mock-widget', position: { x: 10, y: 20 }, props: {} }],
  sources: [{ export: 'PrimaryButtons', position: { x: 1, y: 2 } }],
  centered: false,
  dotted: false,
  grid: false,
  gridSize: 18,
  colorMode: 'auto',
}

const mockUseCanvasState = vi.hoisted(() => ({ loading: false }))

vi.mock('./useCanvas.js', () => ({
  useCanvas: () => ({
    canvas: mockCanvas,
    jsxExports: {
      PrimaryButtons: () => <div data-testid="jsx-widget-content">jsx widget</div>,
    },
    loading: mockUseCanvasState.loading,
  }),
}))

vi.mock('./widgets/index.js', () => ({
  getWidgetComponent: () => function MockWidget() { return <div>mock widget</div> },
}))

vi.mock('./widgets/WidgetChrome.jsx', () => ({
  default: ({ children }) => <div data-testid="widget-chrome">{children}</div>,
}))

vi.mock('./widgets/widgetProps.js', () => ({
  schemas: {},
  getDefaults: () => ({}),
}))

vi.mock('./widgets/widgetConfig.js', async () => {
  const actual = await vi.importActual('./widgets/widgetConfig.js')
  return {
    getFeatures: () => [],
    isResizable: () => false,
    isExpandable: () => false,
    getAnchorState: () => ({}),
    canAcceptConnection: () => false,
    isSplitScreenCapable: () => false,
    getChromeOptions: () => ({ enabled: true }),
    getInteractionOptions: () => ({ selectable: true, movable: true, resize: null, expandable: false, splitScreen: false, interactGate: false, interactGateLabel: 'Click to interact' }),
    isMovable: () => false,
    isEditableInProduction: () => false,
    schemas: {},
    getMenuWidgetTypes: () => [],
    getConnectorDefaults: actual.getConnectorDefaults,
  }
})

vi.mock('./widgets/figmaUrl.js', () => ({
  isFigmaUrl: () => false,
  sanitizeFigmaUrl: (url) => url,
}))

vi.mock('./canvasApi.js', () => ({
  addWidget: vi.fn(),
  checkGitHubCliAvailable: vi.fn(),
  fetchGitHubEmbed: vi.fn(),
  updateCanvas: vi.fn(() => Promise.resolve({ success: true })),
  removeWidget: vi.fn(),
  uploadImage: vi.fn(),
  uploadAgentScreenshot: vi.fn(),
}))

vi.mock('./useUndoRedo.js', () => ({
  default: () => ({
    snapshot: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    reset: vi.fn(),
    canUndo: false,
    canRedo: false,
  }),
}))

describe('CanvasPage canvas bridge', () => {
  it('shows an accessible spinner in the canvas viewport while loading', () => {
    mockUseCanvasState.loading = true
    render(<CanvasPage canvasId="loading-canvas" />)

    expect(screen.getByRole('status', { name: 'Loading canvas' })).toBeInTheDocument()
    const spinner = screen.getByRole('status').querySelector('[aria-hidden="true"]')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('main-loading-spinner', 'main-loading-spinner--canvas')
    expect(screen.queryByText('Loading canvas…')).not.toBeInTheDocument()

    mockUseCanvasState.loading = false
  })

  it('restores Notebook-scoped viewport across delayed layout, hydration replacement and remount', async () => {
    const originalScope = mockCanvas._viewportScope
    mockCanvas._viewportScope = 'notebook-one'
    const key = canvasViewportStorageKey('restore-canvas', 'notebook-one')
    localStorage.setItem(key, JSON.stringify({ zoom: 125, scrollLeft: 1400, scrollTop: 1900 }))
    const dimensions = { clientWidth: 0, clientHeight: 0, scrollWidth: 20000, scrollHeight: 20000 }
    const descriptors = Object.fromEntries(Object.keys(dimensions).map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)]))
    for (const key of Object.keys(dimensions)) Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => dimensions[key] })
    try {
      const view = render(<CanvasPage canvasId="restore-canvas" />)
      let el = document.querySelector('[data-storyboard-canvas-scroll]')
      expect(el.scrollLeft).toBe(0)
      // The saved viewport remains pending until the scheduled layout retry.
      dimensions.clientWidth = 800
      dimensions.clientHeight = 600
      await waitFor(() => expect(el.scrollLeft).toBe(1400))
      expect(el.scrollTop).toBe(1900)
      expect(document.querySelector('[data-storyboard-canvas-zoom]').style.transform).toBe('scale(1.25)')
      el.scrollLeft = 1650
      el.scrollTop = 2200
      fireEvent.scroll(el)
      // Hydration removes the old scroller. Cleanup must retain its live snapshot.
      mockUseCanvasState.loading = true
      view.rerender(<CanvasPage canvasId="restore-canvas" />)
      el.scrollLeft = 0
      el.scrollTop = 0
      mockUseCanvasState.loading = false
      view.rerender(<CanvasPage canvasId="restore-canvas" />)
      el = document.querySelector('[data-storyboard-canvas-scroll]')
      await waitFor(() => expect(el.scrollTop).toBe(2200))
      expect(el.scrollLeft).toBe(1650)
      fireEvent(window, new Event('pagehide'))
      expect(JSON.parse(localStorage.getItem(key))).toMatchObject({ zoom: 125, scrollLeft: 1650, scrollTop: 2200 })
      view.unmount()
      const reopened = render(<CanvasPage canvasId="restore-canvas" />)
      expect(document.querySelector('[data-storyboard-canvas-scroll]').scrollTop).toBe(2200)
      reopened.unmount()
      // A different Notebook with the same canvas ID cannot consume that position.
      mockCanvas._viewportScope = 'notebook-two'
      const other = render(<CanvasPage canvasId="restore-canvas" />)
      expect(document.querySelector('[data-storyboard-canvas-scroll]').scrollTop).not.toBe(2200)
      other.unmount()
      expect(JSON.parse(localStorage.getItem(key)).scrollTop).toBe(2200)
    } finally {
      mockCanvas._viewportScope = originalScope
      mockUseCanvasState.loading = false
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
        else delete HTMLElement.prototype[key]
      }
    }
  })

  it.each([
    { metaKey: true, altKey: false, anchorX: 100, anchorY: 150 },
    { metaKey: true, altKey: true, anchorX: 400, anchorY: 300 },
    { ctrlKey: true, altKey: false, anchorX: 100, anchorY: 150 },
    { ctrlKey: true, altKey: true, anchorX: 400, anchorY: 300 },
  ])('anchors modifier wheel events correctly: %j', async ({ metaKey = false, ctrlKey = false, altKey, anchorX, anchorY }) => {
    // Toolbar origin remains top-left. Alt+wheel must still use viewport center.
    initCanvasInteraction({ zoomOrigin: 'top-left', zoomGestures: true })
    localStorage.setItem(canvasViewportStorageKey('wheel-canvas'), JSON.stringify({ zoom: 100, scrollLeft: 500, scrollTop: 600 }))
    const descriptors = Object.fromEntries(['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight'].map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)]))
    const dimensions = { clientWidth: 800, clientHeight: 600, scrollWidth: 20000, scrollHeight: 20000 }
    for (const key of Object.keys(dimensions)) Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => dimensions[key] })
    try {
      const view = render(<CanvasPage canvasId="wheel-canvas" />)
      const el = document.querySelector('[data-storyboard-canvas-scroll]')
      el.getBoundingClientRect = () => ({ left: 20, top: 30, width: 800, height: 600 })
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, metaKey, ctrlKey, altKey, deltaY: -25, clientX: 120, clientY: 180 })
      act(() => document.dispatchEvent(event))
      expect(event.defaultPrevented).toBe(true)
      expect(document.querySelector('[data-storyboard-canvas-zoom]').style.transform).toBe('scale(1.25)')
      expect((el.scrollLeft + anchorX) / 1.25).toBeCloseTo(500 + anchorX)
      expect((el.scrollTop + anchorY) / 1.25).toBeCloseTo(600 + anchorY)
      // Navigate before the delayed React commit: persist actual imperative zoom.
      view.unmount()
      expect(JSON.parse(localStorage.getItem(canvasViewportStorageKey('wheel-canvas'))).zoom).toBe(125)
    } finally {
      initCanvasInteraction({})
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
        else delete HTMLElement.prototype[key]
      }
    }
  })

  it.each([false, true])('maps forwarded iframe wheel coordinates and Alt=%s', (altKey) => {
    localStorage.setItem(canvasViewportStorageKey('iframe-wheel'), JSON.stringify({ zoom: 100, scrollLeft: 500, scrollTop: 600 }))
    const descriptors = Object.fromEntries(['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight'].map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)]))
    const dimensions = { clientWidth: 800, clientHeight: 600, scrollWidth: 20000, scrollHeight: 20000 }
    for (const key of Object.keys(dimensions)) Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => dimensions[key] })
    try {
      render(<CanvasPage canvasId="iframe-wheel" />)
      const el = document.querySelector('[data-storyboard-canvas-scroll]')
      el.getBoundingClientRect = () => ({ left: 20, top: 30, width: 800, height: 600 })
      const frame = document.createElement('iframe')
      el.append(frame)
      frame.getBoundingClientRect = () => ({ left: 120, top: 130, width: 400, height: 300 })
      act(() => window.dispatchEvent(new MessageEvent('message', {
        source: frame.contentWindow,
        data: { type: 'storyboard:embed:wheel', deltaY: -25, clientX: 100, clientY: 80, altKey },
      })))
      const anchorX = altKey ? 400 : 150
      const anchorY = altKey ? 300 : 140
      expect((el.scrollLeft + anchorX) / 1.25).toBeCloseTo(500 + anchorX)
      expect((el.scrollTop + anchorY) / 1.25).toBeCloseTo(600 + anchorY)
      frame.remove()
    } finally {
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
        else delete HTMLElement.prototype[key]
      }
    }
  })

  it('cancels old wheel commits across same-instance canvas navigation', async () => {
    vi.useFakeTimers()
    const firstKey = canvasViewportStorageKey('wheel-first')
    const secondKey = canvasViewportStorageKey('wheel-second')
    localStorage.setItem(firstKey, JSON.stringify({ zoom: 100, scrollLeft: 500, scrollTop: 600 }))
    localStorage.setItem(secondKey, JSON.stringify({ zoom: 75, scrollLeft: 300, scrollTop: 400 }))
    const descriptors = Object.fromEntries(['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight'].map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)]))
    const dimensions = { clientWidth: 800, clientHeight: 600, scrollWidth: 20000, scrollHeight: 20000 }
    for (const key of Object.keys(dimensions)) Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => dimensions[key] })
    try {
      const view = render(<CanvasPage canvasId="wheel-first" />)
      act(() => document.dispatchEvent(new WheelEvent('wheel', { metaKey: true, deltaY: -25, clientX: 100, clientY: 100, cancelable: true })))
      view.rerender(<CanvasPage canvasId="wheel-second" />)
      await act(async () => vi.advanceTimersByTime(500))
      expect(document.querySelector('[data-storyboard-canvas-zoom]').style.transform).toBe('scale(0.75)')
      expect(document.querySelector('[data-storyboard-canvas-scroll]').scrollTop).toBe(400)
      expect(JSON.parse(localStorage.getItem(secondKey))).toMatchObject({ zoom: 75, scrollLeft: 300, scrollTop: 400 })
      expect(JSON.parse(localStorage.getItem(firstKey)).zoom).toBe(125)
      // The stable document wheel listener must now publish the second ID.
      act(() => document.dispatchEvent(new WheelEvent('wheel', { metaKey: true, deltaY: -10, clientX: 100, clientY: 100, cancelable: true })))
      await act(async () => vi.advanceTimersByTime(500))
      expect(window.__storyboardCanvasBridgeState).toMatchObject({ canvasId: 'wheel-second', zoom: 85 })
      view.unmount()
    } finally {
      vi.useRealTimers()
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
        else delete HTMLElement.prototype[key]
      }
    }
  })

  it('lets an explicit widget link supersede a saved pan waiting for more surface extent', async () => {
    const key = canvasViewportStorageKey('linked-canvas')
    localStorage.setItem(key, JSON.stringify({ zoom: 125, scrollLeft: 1400, scrollTop: 1900 }))
    const descriptors = Object.fromEntries(['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight'].map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)]))
    const dimensions = { clientWidth: 80, clientHeight: 60, scrollWidth: 200, scrollHeight: 200 }
    for (const key of Object.keys(dimensions)) Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => dimensions[key] })
    const originalUrl = window.location.href
    window.history.replaceState({}, '', '?widget=widget-1')
    try {
      const view = render(<CanvasPage canvasId="linked-canvas" />)
      const el = document.querySelector('[data-storyboard-canvas-scroll]')
      const expected = { zoom: 125, scrollLeft: 97.5, scrollTop: 88.75 }
      await waitFor(() => expect(JSON.parse(localStorage.getItem(key))).toMatchObject(expected))
      await act(async () => new Promise(resolve => requestAnimationFrame(resolve)))
      expect(el.scrollLeft).toBe(expected.scrollLeft)
      expect(el.scrollTop).toBe(expected.scrollTop)
      expect(window.location.search).toBe('')
      view.unmount()
    } finally {
      window.history.replaceState({}, '', originalUrl)
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
        else delete HTMLElement.prototype[key]
      }
    }
  })

  it('leaves ordinary wheel scrolling unhandled', () => {
    render(<CanvasPage canvasId="plain-wheel" />)
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 25 })
    act(() => document.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(false)
  })

  function dispatchTextPaste(text) {
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (type) => (type === 'text/plain' ? text : ''),
        items: [],
      },
    })
    document.dispatchEvent(event)
  }

  function dispatchImagePaste(file) {
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', {
      value: { items: [{ type: file.type, getAsFile: () => file }] },
    })
    document.dispatchEvent(event)
  }

  beforeEach(() => {
    delete window.__storyboardCanvasBridgeState
    vi.clearAllMocks()
    addWidget.mockResolvedValue({
      success: true,
      widget: { id: 'widget-link', type: 'link-preview', position: { x: 0, y: 0 }, props: {} },
    })
    checkGitHubCliAvailable.mockResolvedValue({ available: true })
    fetchGitHubEmbed.mockResolvedValue({ success: false })
    uploadImage.mockResolvedValue({ success: true, filename: 'pasted-image.png' })
    pastedStoryPreview.createStoryPreview.mockResolvedValue({ status: 'failed', phase: 'create' })
    pastedStoryPreview.cleanupStoryPreview.mockResolvedValue({ status: 'deleted' })
  })

  it('keeps plain text on the existing Markdown paste path', async () => {
    render(<CanvasPage canvasId="design-overview" />)

    await act(async () => {
      dispatchTextPaste('A reminder for the review')
      await Promise.resolve()
    })

    await waitFor(() => expect(addWidget).toHaveBeenCalledWith(
      'design-overview',
      expect.objectContaining({ type: 'markdown', props: expect.objectContaining({ content: 'A reminder for the review' }) }),
    ))
    expect(pastedStoryPreview.createStoryPreview).not.toHaveBeenCalled()
  })

  it('keeps clipboard images on the existing image-widget path', async () => {
    const originalImage = globalThis.Image
    globalThis.Image = class {
      naturalWidth = 400
      naturalHeight = 200
      set src(_value) { queueMicrotask(() => this.onload?.()) }
    }
    render(<CanvasPage canvasId="design-overview" />)

    try {
      await act(async () => {
        dispatchImagePaste(new Blob(['image bytes'], { type: 'image/png' }))
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      await waitFor(() => expect(addWidget).toHaveBeenCalledWith(
        'design-overview',
        expect.objectContaining({ type: 'image', props: expect.objectContaining({ src: 'pasted-image.png' }) }),
      ))
      expect(uploadImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/), 'design-overview')
      expect(pastedStoryPreview.createStoryPreview).not.toHaveBeenCalled()
    } finally {
      globalThis.Image = originalImage
    }
  })

  it('fences detected source code instead of creating bare Markdown', async () => {
    render(<CanvasPage canvasId="design-overview" />)

    await act(async () => {
      dispatchTextPaste('const answer = 42;')
      await Promise.resolve()
    })

    await waitFor(() => expect(addWidget).toHaveBeenCalledWith(
      'design-overview',
      expect.objectContaining({
        type: 'markdown',
        props: expect.objectContaining({ content: '``` javascript\nconst answer = 42;\n```' }),
      }),
    ))
  })

  it('adds an HTML paste as a story widget only after the preview reports ready', async () => {
    pastedStoryPreview.createStoryPreview.mockResolvedValue({ status: 'ready', storyId: 'pasted-demo', exportName: 'Default' })
    render(<CanvasPage canvasId="design-overview" />)

    await act(async () => {
      dispatchTextPaste('<main><h1>Hello</h1></main>')
      await Promise.resolve()
    })

    await waitFor(() => expect(addWidget).toHaveBeenCalledWith(
      'design-overview',
      expect.objectContaining({ type: 'story', props: expect.objectContaining({ storyId: 'pasted-demo', exportName: 'Default' }) }),
    ))
    expect(pastedStoryPreview.createStoryPreview).toHaveBeenCalledWith(expect.objectContaining({
      source: '<main><h1>Hello</h1></main>', kind: 'html', canvasName: 'design-overview',
    }))
    expect(addWidget).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['<Card />', 'jsx'],
    ['type Props = { label: string }; export function Card(props: Props) { return <h1>{props.label}</h1> }', 'tsx'],
  ])('routes valid %s UI source through the story provider', async (source, kind) => {
    pastedStoryPreview.createStoryPreview.mockResolvedValue({ status: 'ready', storyId: 'pasted-card' })
    render(<CanvasPage canvasId="design-overview" />)

    await act(async () => {
      dispatchTextPaste(source)
      await Promise.resolve()
    })

    await waitFor(() => expect(addWidget).toHaveBeenCalledWith(
      'design-overview',
      expect.objectContaining({ type: 'story', props: expect.objectContaining({ storyId: 'pasted-card' }) }),
    ))
    expect(pastedStoryPreview.createStoryPreview).toHaveBeenCalledWith(expect.objectContaining({ source, kind }))
    expect(addWidget).toHaveBeenCalledTimes(1)
  })

  it('uses one fenced fallback with the original source when story validation fails', async () => {
    pastedStoryPreview.createStoryPreview.mockResolvedValue({ status: 'failed', phase: 'import', error: 'missing import' })
    const source = '  <Widget />  '
    render(<CanvasPage canvasId="design-overview" />)

    await act(async () => {
      dispatchTextPaste(source)
      await Promise.resolve()
    })

    await waitFor(() => expect(addWidget).toHaveBeenCalledWith(
      'design-overview',
      expect.objectContaining({
        type: 'markdown',
        props: expect.objectContaining({ content: '``` jsx\n  <Widget />  \n```' }),
      }),
    ))
    expect(addWidget.mock.calls.map(([, request]) => request.type)).toEqual(['markdown'])
  })

  it('falls back once and cleans up when a validated story cannot be inserted', async () => {
    pastedStoryPreview.createStoryPreview.mockResolvedValue({ status: 'ready', storyId: 'pasted-demo', cleanupToken: 'owned-preview' })
    addWidget
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true, widget: { id: 'fallback', type: 'markdown', position: { x: 0, y: 0 }, props: {} } })
    render(<CanvasPage canvasId="design-overview" />)

    await act(async () => {
      dispatchTextPaste('<main><h1>Hello</h1></main>')
      await Promise.resolve()
    })

    await waitFor(() => expect(addWidget).toHaveBeenLastCalledWith(
      'design-overview',
      expect.objectContaining({ type: 'markdown', props: expect.objectContaining({ content: '``` html\n<main><h1>Hello</h1></main>\n```' }) }),
    ))
    expect(addWidget.mock.calls.map(([, request]) => request.type)).toEqual(['story', 'markdown'])
    expect(pastedStoryPreview.cleanupStoryPreview).toHaveBeenCalledWith(expect.objectContaining({ cleanupToken: 'owned-preview' }))
  })

  it('publishes bridge state and responds to status requests', () => {
    const mountedHandler = vi.fn()
    const statusHandler = vi.fn()
    document.addEventListener('storyboard:canvas:mounted', mountedHandler)
    document.addEventListener('storyboard:canvas:status', statusHandler)

    const { unmount } = render(<CanvasPage canvasId="design-overview" />)

    expect(window.__storyboardCanvasBridgeState).toEqual({
      active: true,
      canvasId: 'design-overview',
      connectors: [],
      widgets: [{ id: 'widget-1', type: 'mock-widget', position: { x: 10, y: 20 }, props: {} }],
      zoom: 100,
    })
    expect(mountedHandler).toHaveBeenCalled()

    document.dispatchEvent(new CustomEvent('storyboard:canvas:status-request'))
    expect(statusHandler).toHaveBeenCalled()
    expect(statusHandler.mock.calls.at(-1)?.[0]?.detail).toEqual({
      active: true,
      canvasId: 'design-overview',
      connectors: [],
      widgets: [{ id: 'widget-1', type: 'mock-widget', position: { x: 10, y: 20 }, props: {} }],
      zoom: 100,
    })

    unmount()

    document.removeEventListener('storyboard:canvas:mounted', mountedHandler)
    document.removeEventListener('storyboard:canvas:status', statusHandler)
  })

  it('marks bridge inactive on unmount', () => {
    const unmountedHandler = vi.fn()
    document.addEventListener('storyboard:canvas:unmounted', unmountedHandler)

    const { unmount } = render(<CanvasPage canvasId="design-overview" />)
    unmount()

    expect(unmountedHandler).toHaveBeenCalled()
    expect(window.__storyboardCanvasBridgeState).toEqual({
      active: false,
      canvasId: '',
      zoom: 100,
    })

    document.removeEventListener('storyboard:canvas:unmounted', unmountedHandler)
  })

  it('shows gh install banner when gh is unavailable during GitHub URL paste', async () => {
    checkGitHubCliAvailable.mockResolvedValue({
      available: false,
      installUrl: 'https://github.com/cli/cli',
    })

    render(<CanvasPage name="design-overview" />)

    await act(async () => {
      dispatchTextPaste('https://github.com/dfosco/storyboard/issues/42')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(addWidget).toHaveBeenCalled()
    })
    expect(fetchGitHubEmbed).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Install GitHub CLI' })).toHaveAttribute(
      'href',
      'https://github.com/cli/cli',
    )
  })

  it('hydrates GitHub metadata when gh is available during paste', async () => {
    checkGitHubCliAvailable.mockResolvedValue({ available: true })
    fetchGitHubEmbed.mockResolvedValue({
      success: true,
      snapshot: {
        kind: 'issue',
        parentKind: 'issue',
        context: 'GitHub · dfosco/storyboard · Issue #42',
        title: '#42 Ship GitHub embeds',
        body: 'Details from GitHub',
        authors: ['dfosco'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
    })

    render(<CanvasPage name="design-overview" />)

    await act(async () => {
      dispatchTextPaste('https://github.com/dfosco/storyboard/issues/42')
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(fetchGitHubEmbed).toHaveBeenCalledWith('https://github.com/dfosco/storyboard/issues/42')
    })
    expect(addWidget).toHaveBeenCalledWith(
      'design-overview',
      expect.objectContaining({
        type: 'link-preview',
        props: expect.objectContaining({
          title: '#42 Ship GitHub embeds',
          width: 580,
          height: 400,
          github: expect.objectContaining({
            context: 'GitHub · dfosco/storyboard · Issue #42',
            body: 'Details from GitHub',
          }),
        }),
      }),
    )
  })

  it('pastes a localhost URL as a Site Frame and preserves the upstream path', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).includes('/_hypercanvas/site/list')) return {
        ok: true,
        json: async () => ({ sites: [{ id: 'docs', title: 'Docs', binding: { developmentBaseUrl: 'http://localhost:5173/' } }] }),
      }
      throw new Error(`Unexpected request: ${url}`)
    }))
    render(<CanvasPage canvasId="design-overview" />)

    await act(async () => {
      dispatchTextPaste('http://localhost:5173/docs/guide?mode=full#intro')
      await Promise.resolve()
    })

    await waitFor(() => expect(addWidget).toHaveBeenCalledWith('design-overview', expect.objectContaining({
      type: 'site-frame',
      props: { siteId: 'docs', route: 'docs/guide?mode=full#intro', title: 'Docs', width: 800, height: 600 },
    })))
  })

  it('pastes a registered Site base URL as a Site Frame instead of opening Site creation', async () => {
    const openCreate = vi.fn()
    document.addEventListener('storyboard:open-site-create', openCreate)
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).includes('/_hypercanvas/site/list')) return {
        ok: true,
        json: async () => ({ sites: [{ id: 'docs', title: 'Docs', binding: { developmentBaseUrl: 'http://localhost:5173/' } }] }),
      }
      throw new Error(`Unexpected request: ${url}`)
    }))
    render(<CanvasPage canvasId="design-overview" />)

    await act(async () => {
      dispatchTextPaste('http://localhost:5173/?from=copy#top')
      await Promise.resolve()
    })

    await waitFor(() => expect(addWidget).toHaveBeenCalledWith('design-overview', expect.objectContaining({
      type: 'site-frame',
      props: { siteId: 'docs', route: '?from=copy#top', title: 'Docs', width: 800, height: 600 },
    })))
    expect(openCreate).not.toHaveBeenCalled()
    document.removeEventListener('storyboard:open-site-create', openCreate)
  })

  it('resolves a nested viewer URL to its Site route rather than the viewer path', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ sites: [
        { id: 'docs', title: 'Docs', binding: { developmentBaseUrl: 'http://localhost:5173/' } },
        { id: 'other', title: 'Other', binding: { developmentBaseUrl: 'http://localhost:4321/' } },
      ] }),
    })))
    render(<CanvasPage canvasId="design-overview" />)

    await act(async () => {
      dispatchTextPaste(`${window.location.origin}/sites/other/guide/chapter?mode=full#intro`)
      await Promise.resolve()
    })

    await waitFor(() => expect(addWidget).toHaveBeenCalledWith('design-overview', expect.objectContaining({
      type: 'site-frame',
      props: { siteId: 'other', route: 'guide/chapter?mode=full#intro', title: 'Other', width: 800, height: 600 },
    })))
  })

  it('opens a prefilled Site creation form for an unmatched localhost Site URL', async () => {
    const openCreate = vi.fn()
    document.addEventListener('storyboard:open-site-create', openCreate)
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).includes('/_hypercanvas/site/list')) return { ok: true, json: async () => ({ sites: [] }) }
      throw new Error(`Unexpected request: ${url}`)
    }))
    render(<CanvasPage canvasId="design-overview" />)

    await act(async () => {
      dispatchTextPaste('http://localhost:5173/new-docs/guide?lang=en')
      await Promise.resolve()
    })

    await waitFor(() => expect(openCreate).toHaveBeenCalledWith(expect.objectContaining({
      detail: { title: 'New Docs', developmentBaseUrl: 'http://localhost:5173/', route: 'new-docs/guide?lang=en' },
    })))
    expect(addWidget).not.toHaveBeenCalled()
    document.removeEventListener('storyboard:open-site-create', openCreate)
  })

  it.skip('persists dragged JSON widgets and JSX sources to canvas JSONL via update API', async () => {
    render(<CanvasPage canvasId="design-overview" />)

    fireEvent.click(screen.getByTestId('drag-widget'))
    // Flush the promise-based write queue
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(updateCanvas).toHaveBeenCalledWith(
      'design-overview',
      expect.objectContaining({
        widgets: expect.arrayContaining([
          expect.objectContaining({
            id: 'widget-1',
            position: { x: 111, y: 223 },
          }),
        ]),
      })
    )

    fireEvent.click(screen.getByTestId('drag-source'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(updateCanvas).toHaveBeenCalledWith(
      'design-overview',
      expect.objectContaining({
        sources: expect.arrayContaining([
          expect.objectContaining({
            export: 'PrimaryButtons',
            position: { x: 333, y: 445 },
          }),
        ]),
      })
    )
  })

  it.skip('clamps negative drag positions to zero', async () => {
    render(<CanvasPage canvasId="design-overview" />)

    fireEvent.click(screen.getByTestId('drag-widget-negative'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(updateCanvas).toHaveBeenCalledWith(
      'design-overview',
      expect.objectContaining({
        widgets: expect.arrayContaining([
          expect.objectContaining({
            id: 'widget-1',
            position: { x: 0, y: 0 },
          }),
        ]),
      })
    )
  })
})

describe('getCanvasThemeVars', () => {
  it('is a no-op shim — canvas color tokens now cascade via data-sb-canvas-theme + tailwind.css', () => {
    expect(getCanvasThemeVars('light')).toEqual({})
    expect(getCanvasThemeVars('dark')).toEqual({})
    expect(getCanvasThemeVars('dark_dimmed')).toEqual({})
    expect(getCanvasThemeVars('dark_high_contrast')).toEqual({})
    expect(getCanvasThemeVars('dark_colorblind')).toEqual({})
    expect(getCanvasThemeVars('light_colorblind')).toEqual({})
    expect(getCanvasThemeVars('unknown')).toEqual({})
  })
})

describe('getCanvasPrimerAttrs', () => {
  it('maps canvas theme to local Primer mode attrs', () => {
    expect(getCanvasPrimerAttrs('light')).toEqual({
      'data-color-mode': 'light',
      'data-dark-theme': 'dark',
      'data-light-theme': 'light',
    })
    expect(getCanvasPrimerAttrs('light_colorblind')).toEqual({
      'data-color-mode': 'light',
      'data-dark-theme': 'dark',
      'data-light-theme': 'light_colorblind',
    })
    expect(getCanvasPrimerAttrs('dark')).toEqual({
      'data-color-mode': 'dark',
      'data-dark-theme': 'dark',
      'data-light-theme': 'light',
    })
    expect(getCanvasPrimerAttrs('dark_dimmed')).toEqual({
      'data-color-mode': 'dark',
      'data-dark-theme': 'dark_dimmed',
      'data-light-theme': 'light',
    })
    expect(getCanvasPrimerAttrs('dark_high_contrast')).toEqual({
      'data-color-mode': 'dark',
      'data-dark-theme': 'dark_high_contrast',
      'data-light-theme': 'light',
    })
    expect(getCanvasPrimerAttrs('dark_colorblind')).toEqual({
      'data-color-mode': 'dark',
      'data-dark-theme': 'dark_colorblind',
      'data-light-theme': 'light',
    })
  })
})

describe('canvas target fallback', () => {
  it('stays light when canvas target is unchecked even if stale canvas attribute is dark', () => {
    localStorage.setItem('sb-theme-sync', JSON.stringify({
      prototype: true,
      toolbar: true,
      codeBoxes: true,
      canvas: false,
    }))
    localStorage.setItem('sb-color-scheme', 'dark')
    document.documentElement.setAttribute('data-sb-canvas-theme', 'dark')

    render(<CanvasPage canvasId="design-overview" />)

    const scroll = document.querySelector('[data-storyboard-canvas-scroll]')
    const jsxWidget = document.getElementById('jsx-PrimaryButtons')
    // Canvas color attribute should be light when canvas sync is off, even
    // if a stale dark attribute remains on the root — CanvasPage reapplies
    // the resolved theme attribute on its own scroll wrapper.
    expect(scroll?.getAttribute('data-color-mode')).toBe('light')
    expect(jsxWidget?.getAttribute('data-color-mode')).toBe('light')
  })
})
