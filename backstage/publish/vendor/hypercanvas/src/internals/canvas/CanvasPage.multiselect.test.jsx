import { fireEvent, render, screen, act } from '@testing-library/react'
import CanvasPage from './CanvasPage.jsx'
import { getCanvas, updateCanvasLayout, updateCanvas, removeWidget, removeConnector, batchOperations, patchWidget } from './canvasApi.js'
import { showToast } from '../showToast.js'
import { initCanvasConfig } from '../../core/stores/canvasConfig.js'
import { getActionsForMode } from '../../core/index.js'

vi.mock('../showToast.js', () => ({ showToast: vi.fn() }))

vi.mock('./ConnectorLayer.jsx', () => ({
  default: ({ connectors }) => <div data-testid="connectors" data-ids={connectors.map((connector) => connector.id).join(',')} />,
}))

const MOCK_UNDO_REDO = {
  track: vi.fn(),
  trackMany: vi.fn(),
  trackBatch: vi.fn(),
  beginBatch: vi.fn(() => 146),
  endBatch: vi.fn(),
  popUndo: vi.fn(),
  popRedo: vi.fn(),
  pushRedo: vi.fn(),
  pushUndo: vi.fn(),
  reset: vi.fn(),
  canUndo: false,
  canRedo: false,
}

vi.mock('./useUndoRedo.js', () => ({
  default: () => MOCK_UNDO_REDO,
}))

// Expose drag callbacks so tests can trigger drags with specific IDs
let capturedOnDragStart = null
let capturedOnDrag = null
let capturedOnDragEnd = null
let capturedResolveDropPosition = null
const capturedWidgetUpdates = new Map()
const capturedSourceUpdates = new Map()
vi.mock('./widgets/ComponentWidget.jsx', () => ({
  default: ({ exportName, onUpdate }) => {
    capturedSourceUpdates.set(exportName, onUpdate)
    return <div />
  },
}))
vi.mock('../../canvas/index.js', () => ({
  Canvas: ({ children, onDragStart, onDrag, onDragEnd, resolveDropPosition }) => {
    capturedOnDragStart = onDragStart
    capturedOnDrag = onDrag
    capturedOnDragEnd = onDragEnd
    capturedResolveDropPosition = resolveDropPosition
    return <div data-testid="tiny-canvas">{children}</div>
  },
}))

const mockCanvas = {
  title: 'Multi-Select Test',
  widgets: [
    { id: 'w1', type: 'sticky-note', position: { x: 100, y: 100 }, props: {} },
    { id: 'w2', type: 'sticky-note', position: { x: 300, y: 100 }, props: {} },
    { id: 'w3', type: 'markdown', position: { x: 500, y: 200 }, props: {} },
  ],
  sources: [],
  centered: false,
  dotted: false,
  grid: false,
  gridSize: 18,
  colorMode: 'auto',
}

let mockJsxExports = null
vi.mock('./useCanvas.js', () => ({
  useCanvas: () => ({
    canvas: mockCanvas,
    jsxExports: mockJsxExports,
    loading: false,
  }),
}))

vi.mock('./widgets/index.js', () => ({
  getWidgetComponent: () => function MockWidget({ id, props, onUpdate }) {
    capturedWidgetUpdates.set(id, onUpdate)
    return <div data-testid={`widget-content-${id}`} data-path={props.path}>widget</div>
  },
}))

// WidgetChrome mock that exposes onSelect with shift parameter
vi.mock('./widgets/WidgetChrome.jsx', () => ({
  default: ({ children, onSelect, selected, multiSelected, nudgeInRange, widgetId }) => (
    <div
      data-testid={`chrome-${widgetId}`}
      data-nudge-in-range={nudgeInRange || undefined}
      data-selected={selected || undefined}
      data-multi-selected={multiSelected || undefined}
    >
      {children}
      <button
        className="tc-drag-handle"
        data-testid={`select-${widgetId}`}
        onClick={(e) => { e.stopPropagation(); onSelect?.(false) }}
      >
        select
      </button>
      <button
        className="tc-drag-handle"
        data-testid={`shift-select-${widgetId}`}
        onClick={(e) => { e.stopPropagation(); onSelect?.(true) }}
      >
        shift-select
      </button>
    </div>
  ),
}))

vi.mock('./widgets/widgetProps.js', () => ({
  schemas: {},
  getDefaults: () => ({}),
}))

vi.mock('./widgets/widgetConfig.js', async () => {
  const actual = await vi.importActual('./widgets/widgetConfig.js')
  return {
    getFeatures: () => [],
    getMultiSelectionFeatures: () => [],
    isResizable: () => false,
    isExpandable: () => false,
    isSplitScreenCapable: () => false,
    getInteractGate: () => ({ enabled: false, label: 'Click to interact' }),
    getChromeOptions: () => ({ enabled: true }),
    getInteractionOptions: () => ({ selectable: true, movable: true, resize: null, expandable: false, splitScreen: false, interactGate: false, interactGateLabel: 'Click to interact' }),
    isMovable: () => false,
    isEditableInProduction: () => false,
    getWidgetMeta: () => null,
    getConnectorConfig: actual.getConnectorConfig,
    getAnchorState: actual.getAnchorState,
    canAcceptConnection: () => true,
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
  getCanvas: vi.fn(),
  updateCanvasLayout: vi.fn(),
  addWidget: vi.fn(),
  checkGitHubCliAvailable: vi.fn(() => Promise.resolve({ available: true })),
  fetchGitHubEmbed: vi.fn(() => Promise.resolve({ success: false })),
  updateCanvas: vi.fn(() => Promise.resolve({ success: true })),
  patchWidget: vi.fn(() => Promise.resolve({ success: true, eventIds: ['evt_patch'] })),
  removeWidget: vi.fn(() => Promise.resolve({ success: true, eventId: 'evt_remove' })),
  removeConnector: vi.fn(() => Promise.resolve({ success: true })),
  undoEvent: vi.fn(() => Promise.resolve({ status: 200, ok: true, data: { success: true, eventId: 'evt_undo' } })),
  redoEvent: vi.fn(() => Promise.resolve({ status: 200, ok: true, data: { success: true, eventId: 'evt_redo' } })),
  uploadImage: vi.fn(),
  uploadAgentScreenshot: vi.fn(),
  batchOperations: vi.fn((_canvasId, operations) => Promise.resolve({
    success: true,
    results: operations.map((operation) => ({
      ...operation,
      eventId: `evt_move_${operation.widgetId}`,
    })),
  })),
}))

describe('CanvasPage multi-select', () => {
  beforeEach(() => {
    delete window.__storyboardCanvasBridgeState
    window.__SB_LOCAL_DEV__ = true
    vi.clearAllMocks()
    initCanvasConfig({})
    capturedOnDragStart = null
    capturedOnDrag = null
    capturedOnDragEnd = null
    capturedWidgetUpdates.clear()
    capturedSourceUpdates.clear()
    mockCanvas.connectors = []
    mockCanvas.scroll = { axis: 'both' }
  })

  it('mounts and registers the layout actions after their callbacks initialize', () => {
    render(<CanvasPage canvasId="test-canvas" />)

    const actions = getActionsForMode('canvas')
    expect(actions.map((action) => action.id)).toEqual(expect.arrayContaining([
      'canvas-layout/toggle-vertical:test-canvas',
      'canvas-layout/reflow:test-canvas',
    ]))
    expect(actions.find((action) => action.id === 'canvas-layout/reflow:test-canvas').hideFromCommandMenu).toBe(true)
  })

  it('answers a late undo toolbar state request for only the mounted canvas', () => {
    const stateHandler = vi.fn()
    document.addEventListener('storyboard:canvas:undo-redo-state', stateHandler)
    const { unmount } = render(<CanvasPage canvasId="test-canvas" />)
    stateHandler.mockClear()

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo-redo-state-request', {
      detail: { canvasId: 'other-canvas', requestId: 'request-other' },
    })))
    expect(stateHandler).not.toHaveBeenCalled()

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo-redo-state-request', {
      detail: { canvasId: 'test-canvas', requestId: 'request-current' },
    })))
    expect(stateHandler).toHaveBeenLastCalledWith(expect.objectContaining({
      detail: expect.objectContaining({
        canvasId: 'test-canvas',
        canUndo: false,
        canRedo: false,
        requestId: 'request-current',
      }),
    }))

    unmount()
    stateHandler.mockClear()
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo-redo-state-request', {
      detail: { canvasId: 'test-canvas', requestId: 'after-unmount' },
    })))
    expect(stateHandler).not.toHaveBeenCalled()
    document.removeEventListener('storyboard:canvas:undo-redo-state', stateHandler)
  })

  it('keeps stored-only source geometry when unlocking vertical layout', async () => {
    const storedOnlySource = {
      export: 'StoredButUndiscovered',
      position: { x: 321, y: 654 },
      width: 287,
      height: 193,
      metadata: { authored: true },
    }
    mockCanvas.scroll = { axis: 'vertical' }
    getCanvas.mockResolvedValue({
      documentRevision: 'revision-1',
      widgets: [],
      sources: [storedOnlySource],
    })
    updateCanvasLayout.mockResolvedValue({ status: 200, data: { eventId: 'evt-layout' } })
    render(<CanvasPage canvasId="test-canvas" />)

    act(() => getActionsForMode('canvas').find((action) => action.id === 'canvas-layout/toggle-vertical:test-canvas').handler.execute())
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

    expect(updateCanvasLayout).toHaveBeenCalledWith('test-canvas', 'revision-1', expect.objectContaining({
      scroll: { axis: 'both' },
      sources: [{ export: 'StoredButUndiscovered', position: { x: 321, y: 654 }, width: 287, height: 193 }],
    }), { canvasId: 'test-canvas', jsxReference: null })
  })

  it.each(['both', 'vertical'])('standalone reflow preserves the latest %s axis in one layout write', async (axis) => {
    mockCanvas.scroll = { axis }
    getCanvas.mockResolvedValue({
      documentRevision: `revision-${axis}`,
      widgets: mockCanvas.widgets,
      sources: [],
      scroll: { axis },
    })
    updateCanvasLayout.mockResolvedValue({ status: 200, data: { eventId: 'evt-reflow' } })
    render(<CanvasPage canvasId="test-canvas" />)

    await act(async () => {
      getActionsForMode('canvas').find((action) => action.id === 'canvas-layout/reflow:test-canvas').handler()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(updateCanvasLayout).toHaveBeenCalledTimes(1)
    expect(updateCanvasLayout).toHaveBeenCalledWith('test-canvas', `revision-${axis}`, expect.objectContaining({
      scroll: { axis },
    }), { canvasId: 'test-canvas', jsxReference: null })
    expect(MOCK_UNDO_REDO.track).toHaveBeenCalledTimes(1)
    expect(MOCK_UNDO_REDO.track).toHaveBeenCalledWith('evt-reflow')
  })

  afterEach(() => {
    delete window.__SB_LOCAL_DEV__
  })

  it.each(['widget', 'source'])('resolves connected drops against stationary %s geometry', async (kind) => {
    const originalWidgets = mockCanvas.widgets
    const originalSources = mockCanvas.sources
    mockCanvas.autoPlace = true
    const peerId = kind === 'source' ? 'jsx-Peer' : 'peer'
    mockCanvas.widgets = [
      { id: 'moving', type: 'sticky-note', position: { x: 100, y: 100 }, props: { width: 80, height: 60 } },
      ...(kind === 'widget' ? [{ id: peerId, type: 'sticky-note', position: { x: 400, y: 100 }, props: { width: 80, height: 60 } }] : []),
    ]
    mockCanvas.sources = kind === 'source' ? [{ export: 'Peer', position: { x: 400, y: 100 }, width: 80, height: 60 }] : []
    mockCanvas.connectors = [{ id: 'link', start: { widgetId: 'moving', anchor: 'right' }, end: { widgetId: peerId, anchor: 'left' } }]
    try {
      await act(async () => { render(<CanvasPage canvasId="test-canvas" />) })
      // Nearby edges align and close the gap without corrupting coordinates.
      expect(capturedResolveDropPosition('moving', { x: 240, y: 110 })).toEqual({ x: 320, y: 100 })
      // A real collision preserves the requested moving position. The direct
      // drop batch displaces its blockers; resolving this coordinate alone
      // must not evict the connected moving widget to make them stationary.
      expect(capturedResolveDropPosition('moving', { x: 400, y: 100 })).toEqual({ x: 400, y: 100 })
    } finally {
      mockCanvas.widgets = originalWidgets
      mockCanvas.sources = originalSources
      delete mockCanvas.autoPlace
    }
  })

  it('uses canvas-specific ranges for live hints and clears them on cancel or disable', async () => {
    const originalAutoPlace = mockCanvas.autoPlace
    const originalWidgets = mockCanvas.widgets
    mockCanvas.autoPlace = true
    mockCanvas.widgets = [
      { id: 'w1', type: 'sticky-note', position: { x: 100, y: 100 }, props: { width: 80, height: 60 } },
      { id: 'w2', type: 'sticky-note', position: { x: 300, y: 100 }, props: { width: 80, height: 60 } },
    ]
    initCanvasConfig({
      autoPlace: { align: { 'top-edge-nudge-offset': 10, 'left-edge-nudge-offset': 30 }, overlap: { 'overlap-nudge-trigger': 0, 'overlap-nudge-offset': 0 } },
      overrides: { 'test-canvas': { autoPlace: { align: { 'top-edge-nudge-offset': 60 } } } },
    })
    try {
      await act(async () => { render(<CanvasPage canvasId="test-canvas" />) })
      act(() => {
        capturedOnDragStart('w1')
        capturedOnDrag('w1', { x: 200, y: 140 })
      })
      expect(screen.getByTestId('chrome-w2')).toHaveAttribute('data-nudge-in-range', 'true')
      expect(screen.getByTestId('chrome-w1')).not.toHaveAttribute('data-nudge-in-range')
      expect(capturedResolveDropPosition('w1', { x: 200, y: 140 })).toEqual({ x: 200, y: 100 })
      fireEvent.pointerCancel(document)
      expect(screen.getByTestId('chrome-w2')).not.toHaveAttribute('data-nudge-in-range')
      act(() => capturedOnDrag('w1', { x: 200, y: 140 }))
      expect(screen.getByTestId('chrome-w2')).not.toHaveAttribute('data-nudge-in-range')
      act(() => {
        capturedOnDragStart('w1')
        capturedOnDrag('w1', { x: 200, y: 140 })
      })
      expect(screen.getByTestId('chrome-w2')).toHaveAttribute('data-nudge-in-range', 'true')
      act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:toggle-auto-place')))
      expect(screen.getByTestId('chrome-w2')).not.toHaveAttribute('data-nudge-in-range')
    } finally {
      mockCanvas.autoPlace = originalAutoPlace
      mockCanvas.widgets = originalWidgets
      initCanvasConfig({})
    }
  })

  it.each(['widget', 'source'])('persists stationary %s moves along with the dropped widget', async (kind) => {
    const originalWidgets = mockCanvas.widgets
    const originalSources = mockCanvas.sources
    const originalAutoPlace = mockCanvas.autoPlace
    mockCanvas.autoPlace = true
    mockCanvas.widgets = [
      { id: 'w1', type: 'sticky-note', position: { x: 100, y: 100 }, props: { width: 80, height: 60 } },
      ...(kind === 'widget' ? [{ id: 'w2', type: 'sticky-note', position: { x: 300, y: 100 }, props: { width: 80, height: 60 } }] : []),
    ]
    mockCanvas.sources = kind === 'source' ? [{ export: 'Peer', position: { x: 300, y: 100 }, width: 80, height: 60 }] : []
    mockJsxExports = kind === 'source' ? { Peer: () => null } : null
    initCanvasConfig({ autoPlace: {
      align: { 'top-edge-nudge-offset': 0, 'left-edge-nudge-offset': 0 },
      overlap: { 'overlap-nudge-trigger': 0, 'overlap-nudge-offset': 0, 'overlap-place-stationary': true },
    } })
    try {
      await act(async () => { render(<CanvasPage canvasId="test-canvas" />) })
      vi.useFakeTimers()
      act(() => {
        capturedWidgetUpdates.get('w1')({ text: 'edited before placement' })
        if (kind === 'source') capturedSourceUpdates.get('Peer')({ width: 90 })
      })
      const requested = { x: 320, y: 100 }
      const resolved = capturedResolveDropPosition('w1', requested)
      expect(resolved).toEqual(requested)
      await act(async () => { capturedOnDragEnd('w1', resolved) })
      expect(patchWidget).toHaveBeenCalledWith('test-canvas', 'w1', { props: { text: 'edited before placement' } })
      const operations = batchOperations.mock.calls.flatMap(([, ops]) => ops)
      expect(operations).toContainEqual({ op: 'move-widget', widgetId: 'w1', position: requested })
      const movedPeer = kind === 'widget'
        ? operations.find((op) => op.widgetId === 'w2')?.position
        : updateCanvas.mock.calls.find(([, update]) => update.sources)?.[1].sources.find((source) => source.export === 'Peer')?.position
      expect(movedPeer).toBeDefined()
      expect(movedPeer).not.toEqual({ x: 300, y: 100 })
      expect(movedPeer.x < 400 && movedPeer.x + 80 > 320 && movedPeer.y < 160 && movedPeer.y + 60 > 100).toBe(false)
      await act(async () => { await vi.advanceTimersByTimeAsync(2100) })
      if (kind === 'source') {
        const saves = updateCanvas.mock.calls.filter(([, update]) => update.sources)
        expect(saves).toHaveLength(1)
        expect(saves[0][1].sources.find((source) => source.export === 'Peer')).toMatchObject({ width: 90, position: movedPeer })
      }
    } finally {
      vi.useRealTimers()
      mockJsxExports = null
      mockCanvas.widgets = originalWidgets
      mockCanvas.sources = originalSources
      mockCanvas.autoPlace = originalAutoPlace
      initCanvasConfig({})
    }
  })

  it('persists a discrete update before displaying it, coalescing pending edits without a second PATCH', async () => {
    vi.useFakeTimers()
    try {
      let finishPatch
      patchWidget.mockImplementationOnce(() => new Promise(resolve => { finishPatch = resolve }))
      render(<CanvasPage canvasId="test-canvas" />)

      act(() => capturedWidgetUpdates.get('w1')({ width: 420 }))
      expect(patchWidget).not.toHaveBeenCalled()
      let saved
      await act(async () => {
        saved = capturedWidgetUpdates.get('w1')({ path: 'assets/renamed.txt' }, { immediate: true })
      })
      expect(patchWidget).toHaveBeenCalledWith('test-canvas', 'w1', { props: { width: 420, path: 'assets/renamed.txt' } })
      expect(screen.getByTestId('widget-content-w1').dataset.path).toBeUndefined()

      await act(async () => {
        finishPatch({ success: true, eventIds: ['evt_saved'] })
        await saved
      })
      expect(screen.getByTestId('widget-content-w1').dataset.path).toBe('assets/renamed.txt')
      expect(MOCK_UNDO_REDO.trackMany).toHaveBeenCalledWith(['evt_saved'])
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(patchWidget).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects a failed discrete save without displaying the unsaved path', async () => {
    const error = new Error('Save failed')
    patchWidget.mockRejectedValueOnce(error)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<CanvasPage canvasId="test-canvas" />)
      await act(async () => {
        await expect(capturedWidgetUpdates.get('w1')({ path: 'assets/unsaved.txt' }, { immediate: true })).rejects.toThrow('Save failed')
      })
      expect(screen.getByTestId('widget-content-w1').dataset.path).toBeUndefined()
      expect(log).toHaveBeenCalledWith('[canvas] Write queue error:', error)
    } finally {
      log.mockRestore()
    }
  })

  it('shift+click on select handle adds widget to selection', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    // Select first widget
    fireEvent.click(screen.getByTestId('select-w1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.getByTestId('chrome-w1').dataset.selected).toBeDefined()

    // Shift+select second widget
    fireEvent.click(screen.getByTestId('shift-select-w2'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.getByTestId('chrome-w1').dataset.selected).toBeDefined()
    expect(screen.getByTestId('chrome-w2').dataset.selected).toBeDefined()
  })

  it('shift+click on already selected widget removes it from selection', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    // Select both
    fireEvent.click(screen.getByTestId('select-w1'))
    fireEvent.click(screen.getByTestId('shift-select-w2'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.getByTestId('chrome-w1').dataset.selected).toBeDefined()
    expect(screen.getByTestId('chrome-w2').dataset.selected).toBeDefined()

    // Shift+click w1 again to remove it
    fireEvent.click(screen.getByTestId('shift-select-w1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.getByTestId('chrome-w1').dataset.selected).toBeUndefined()
    expect(screen.getByTestId('chrome-w2').dataset.selected).toBeDefined()
  })

  it('normal click replaces multi-selection with single', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    // Multi-select
    fireEvent.click(screen.getByTestId('select-w1'))
    fireEvent.click(screen.getByTestId('shift-select-w2'))
    fireEvent.click(screen.getByTestId('shift-select-w3'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // Normal click on w1 clears multi-select
    fireEvent.click(screen.getByTestId('select-w1'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.getByTestId('chrome-w1').dataset.selected).toBeDefined()
    expect(screen.getByTestId('chrome-w2').dataset.selected).toBeUndefined()
    expect(screen.getByTestId('chrome-w3').dataset.selected).toBeUndefined()
  })

  it('sets multiSelected on all selected widgets when multiple are selected', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    fireEvent.click(screen.getByTestId('select-w1'))
    fireEvent.click(screen.getByTestId('shift-select-w2'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(screen.getByTestId('chrome-w1').dataset.multiSelected).toBeDefined()
    expect(screen.getByTestId('chrome-w2').dataset.multiSelected).toBeDefined()
    // Unselected widget should not have multiSelected
    expect(screen.getByTestId('chrome-w3').dataset.multiSelected).toBeUndefined()
  })

  it('Escape clears all selection', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    fireEvent.click(screen.getByTestId('select-w1'))
    fireEvent.click(screen.getByTestId('shift-select-w2'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    fireEvent.keyDown(document, { key: 'Escape' })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(screen.getByTestId('chrome-w1').dataset.selected).toBeUndefined()
    expect(screen.getByTestId('chrome-w2').dataset.selected).toBeUndefined()
  })

  it('Delete removes all selected widgets through individual deletion requests', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    // Multi-select w1 and w2
    fireEvent.click(screen.getByTestId('select-w1'))
    fireEvent.click(screen.getByTestId('shift-select-w2'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // Press Delete
    fireEvent.keyDown(document, { key: 'Delete' })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // Multi-delete now uses individual removeWidget calls (one per selected
    // widget) instead of widgets_replaced — keeps server's wipe guard happy
    // and closes terminal sessions per widget.
    expect(removeWidget).toHaveBeenCalledWith('test-canvas', 'w1')
    expect(removeWidget).toHaveBeenCalledWith('test-canvas', 'w2')
    expect(removeWidget).toHaveBeenCalledTimes(2)
    // updateCanvas (widgets_replaced) is NOT used for multi-delete
    expect(updateCanvas).not.toHaveBeenCalled()
    // Each remove call's eventId is tracked for undo
    expect(MOCK_UNDO_REDO.track).toHaveBeenCalledWith('evt_remove', 146)
    expect(MOCK_UNDO_REDO.track.mock.calls.map(([, token]) => token)).toEqual([146, 146])
    expect(MOCK_UNDO_REDO.beginBatch).toHaveBeenCalledTimes(1)
    expect(MOCK_UNDO_REDO.endBatch).toHaveBeenCalledWith(146)
  })

  it('single-select Delete uses removeWidget API', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    fireEvent.click(screen.getByTestId('select-w1'))
    fireEvent.keyDown(document, { key: 'Backspace' })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(removeWidget).toHaveBeenCalledWith('test-canvas', 'w1')
  })

  it('keeps a widget and its connectors visible until deletion succeeds, then tracks all undo events', async () => {
    let finishRemoval
    removeWidget.mockImplementationOnce(() => new Promise((resolve) => { finishRemoval = resolve }))
    mockCanvas.connectors = [{ id: 'c1', start: { widgetId: 'w1' }, end: { widgetId: 'w3' } }]
    render(<CanvasPage canvasId="test-canvas" />)
    fireEvent.click(screen.getByTestId('select-w1'))

    await act(async () => { fireEvent.keyDown(document, { key: 'Delete' }) })
    expect(screen.getByTestId('widget-content-w1')).toBeInTheDocument()
    expect(screen.getByTestId('chrome-w1').dataset.selected).toBeDefined()
    expect(screen.getByTestId('connectors').dataset.ids).toBe('c1')
    expect(removeConnector).not.toHaveBeenCalled()

    // Repeated Delete while shutdown is pending must share the same request.
    await act(async () => { fireEvent.keyDown(document, { key: 'Delete' }) })
    expect(removeWidget).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishRemoval({ success: true, eventId: 'evt_remove', eventIds: ['evt_connector', 'evt_remove'] })
    })
    expect(screen.queryByTestId('widget-content-w1')).not.toBeInTheDocument()
    expect(screen.getByTestId('connectors').dataset.ids).toBe('')
    expect(removeConnector).not.toHaveBeenCalled()
    expect(MOCK_UNDO_REDO.trackMany).toHaveBeenCalledWith(['evt_connector', 'evt_remove'])
  })

  it.each([
    ['server rejection', () => Promise.resolve({ error: 'Terminal shutdown failed' })],
    ['request failure', () => Promise.reject(new Error('Terminal shutdown failed'))],
  ])('retains a selected widget and its connectors after %s and shows the error', async (_label, response) => {
    removeWidget.mockImplementationOnce(response)
    mockCanvas.connectors = [{ id: 'c1', start: { widgetId: 'w1' }, end: { widgetId: 'w3' } }]
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<CanvasPage canvasId="test-canvas" />)
      fireEvent.click(screen.getByTestId('select-w1'))
      await act(async () => { fireEvent.keyDown(document, { key: 'Delete' }) })

      expect(screen.getByTestId('widget-content-w1')).toBeInTheDocument()
      expect(screen.getByTestId('chrome-w1').dataset.selected).toBeDefined()
      expect(screen.getByTestId('connectors').dataset.ids).toBe('c1')
      expect(removeConnector).not.toHaveBeenCalled()
      expect(MOCK_UNDO_REDO.track).not.toHaveBeenCalled()
      expect(showToast).toHaveBeenCalledWith('Could not remove widget: Terminal shutdown failed')

      // A failed attempt does not prevent retrying the same widget.
      await act(async () => { fireEvent.keyDown(document, { key: 'Delete' }) })
      expect(removeWidget).toHaveBeenCalledTimes(2)
      expect(screen.queryByTestId('widget-content-w1')).not.toBeInTheDocument()
    } finally {
      log.mockRestore()
    }
  })

  it('keeps failed widgets selected during multi-delete while successful deletions finish', async () => {
    removeWidget.mockResolvedValueOnce({ error: 'Terminal shutdown failed' })
    mockCanvas.connectors = [
      { id: 'c1', start: { widgetId: 'w1' }, end: { widgetId: 'w3' } },
      { id: 'c2', start: { widgetId: 'w2' }, end: { widgetId: 'w3' } },
    ]
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<CanvasPage canvasId="test-canvas" />)
      fireEvent.click(screen.getByTestId('select-w1'))
      fireEvent.click(screen.getByTestId('shift-select-w2'))
      await act(async () => { fireEvent.keyDown(document, { key: 'Delete' }) })

      expect(screen.getByTestId('widget-content-w1')).toBeInTheDocument()
      expect(screen.getByTestId('chrome-w1').dataset.selected).toBeDefined()
      expect(screen.queryByTestId('widget-content-w2')).not.toBeInTheDocument()
      expect(screen.getByTestId('connectors').dataset.ids).toBe('c1')
      expect(removeConnector).not.toHaveBeenCalled()
      expect(showToast).toHaveBeenCalledWith('Could not remove widget: Terminal shutdown failed')
    } finally {
      log.mockRestore()
    }
  })

  it('saves pending widget edits before a deletion that the server rejects', async () => {
    removeWidget.mockResolvedValueOnce({ error: 'Terminal shutdown failed' })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<CanvasPage canvasId="test-canvas" />)
      act(() => capturedWidgetUpdates.get('w1')({ width: 420 }))
      fireEvent.click(screen.getByTestId('select-w1'))
      await act(async () => { fireEvent.keyDown(document, { key: 'Delete' }) })

      expect(patchWidget).toHaveBeenCalledWith('test-canvas', 'w1', { props: { width: 420 } })
      expect(patchWidget.mock.invocationCallOrder[0]).toBeLessThan(removeWidget.mock.invocationCallOrder[0])
      expect(screen.getByTestId('widget-content-w1')).toBeInTheDocument()
    } finally {
      log.mockRestore()
    }
  })

  it('multi-select move applies delta to all selected widgets', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    // Multi-select w1 (100,100) and w2 (300,100)
    fireEvent.click(screen.getByTestId('select-w1'))
    fireEvent.click(screen.getByTestId('shift-select-w2'))

    // Wait for selectedIdsRef to sync
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // Drag w1 to (150, 200) → delta is (+50, +100)
    expect(capturedOnDragEnd).toBeTruthy()
    act(() => {
      capturedOnDragEnd('w1', { x: 150, y: 200 })
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // w1 → (150, 200), w2 → (300+50, 100+100) = (350, 200).
    // Multi-move is now persisted as a batch of widget_moved ops instead of
    // a widgets_replaced bomb — fixes the rollback class of bugs.
    expect(batchOperations).toHaveBeenCalledWith(
      'test-canvas',
      expect.arrayContaining([
        expect.objectContaining({ op: 'move-widget', widgetId: 'w1', position: { x: 150, y: 200 } }),
        expect.objectContaining({ op: 'move-widget', widgetId: 'w2', position: { x: 350, y: 200 } }),
      ])
    )
    expect(MOCK_UNDO_REDO.trackBatch).toHaveBeenCalledWith(['evt_move_w1', 'evt_move_w2'])
    expect(MOCK_UNDO_REDO.trackMany).not.toHaveBeenCalled()
    expect(updateCanvas).not.toHaveBeenCalled()
  })

  it('records a mixed widget and JSX group drag as one history entry', async () => {
    const originalWidgets = mockCanvas.widgets
    const originalSources = mockCanvas.sources
    const originalExports = mockJsxExports
    mockCanvas.widgets = [
      { id: 'w1', type: 'sticky-note', position: { x: 100, y: 100 }, props: { width: 100, height: 80 } },
      { id: 'w2', type: 'sticky-note', position: { x: 300, y: 100 }, props: { width: 100, height: 80 } },
    ]
    mockCanvas.sources = [{ export: 'Peer', position: { x: 500, y: 200 }, width: 120, height: 90 }]
    mockJsxExports = { Peer: () => null }
    updateCanvas.mockResolvedValue({ success: true, eventIds: ['evt_source_move'] })
    try {
      render(<CanvasPage canvasId="test-canvas" />)
      fireEvent.click(screen.getByTestId('select-w1'))
      fireEvent.click(screen.getByTestId('shift-select-w2'))
      fireEvent.click(screen.getByTestId('shift-select-jsx-Peer'))
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

      await act(async () => { capturedOnDragEnd('w1', { x: 150, y: 200 }) })

      expect(batchOperations).toHaveBeenCalledWith('test-canvas', [
        { op: 'move-widget', widgetId: 'w1', position: { x: 150, y: 200 } },
        { op: 'move-widget', widgetId: 'w2', position: { x: 350, y: 200 } },
      ])
      expect(updateCanvas).toHaveBeenCalledWith('test-canvas', { sources: [
        { export: 'Peer', position: { x: 550, y: 300 }, width: 120, height: 90 },
      ] })
      expect(MOCK_UNDO_REDO.trackBatch).toHaveBeenCalledWith(['evt_move_w1', 'evt_move_w2', 'evt_source_move'])
      expect(MOCK_UNDO_REDO.trackMany).not.toHaveBeenCalled()
    } finally {
      mockCanvas.widgets = originalWidgets
      mockCanvas.sources = originalSources
      mockJsxExports = originalExports
    }
  })

  it('multi-select drag captures peer articles on drag start', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    // Multi-select w1 and w2
    fireEvent.click(screen.getByTestId('select-w1'))
    fireEvent.click(screen.getByTestId('shift-select-w2'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // All drag callbacks should be captured
    expect(capturedOnDragStart).toBeTruthy()
    expect(capturedOnDrag).toBeTruthy()

    // Trigger drag start — should not throw
    act(() => {
      capturedOnDragStart('w1', { x: 100, y: 100 })
    })

    // Drag tick — peers stay put (no live preview), should not throw
    act(() => {
      capturedOnDrag('w1', { x: 150, y: 200 })
    })
  })

  it('multi-select drag preserves selection after drag end', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    // Multi-select w1 and w2
    fireEvent.click(screen.getByTestId('select-w1'))
    fireEvent.click(screen.getByTestId('shift-select-w2'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    expect(screen.getByTestId('chrome-w1').dataset.selected).toBeDefined()
    expect(screen.getByTestId('chrome-w2').dataset.selected).toBeDefined()

    // Simulate full drag: start → drag → end
    act(() => {
      capturedOnDragStart('w1', { x: 100, y: 100 })
    })
    act(() => {
      capturedOnDragEnd('w1', { x: 150, y: 200 })
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // Selection should still include both widgets (justDraggedRef prevents collapse)
    expect(screen.getByTestId('chrome-w1').dataset.selected).toBeDefined()
    expect(screen.getByTestId('chrome-w2').dataset.selected).toBeDefined()
  })

  it('any selected widget can serve as drag handler for the group', async () => {
    render(<CanvasPage canvasId="test-canvas" />)

    // Multi-select w1 (100,100), w2 (300,100), w3 (500,200)
    fireEvent.click(screen.getByTestId('select-w1'))
    fireEvent.click(screen.getByTestId('shift-select-w2'))
    fireEvent.click(screen.getByTestId('shift-select-w3'))
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // Drag w2 (the middle one) to (350, 150) → delta (+50, +50)
    act(() => {
      capturedOnDragStart('w2', { x: 300, y: 100 })
    })
    act(() => {
      capturedOnDragEnd('w2', { x: 350, y: 150 })
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    // All selected widgets should move by the same delta (+50, +50) via the
    // batch endpoint.
    expect(batchOperations).toHaveBeenCalledWith(
      'test-canvas',
      expect.arrayContaining([
        expect.objectContaining({ op: 'move-widget', widgetId: 'w1', position: { x: 150, y: 150 } }),
        expect.objectContaining({ op: 'move-widget', widgetId: 'w2', position: { x: 350, y: 150 } }),
        expect.objectContaining({ op: 'move-widget', widgetId: 'w3', position: { x: 550, y: 250 } }),
      ])
    )
    expect(updateCanvas).not.toHaveBeenCalled()
  })
})
