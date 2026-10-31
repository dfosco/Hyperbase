import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import CanvasPage from './CanvasPage.jsx'
import { addWidget, batchOperations, checkGitHubCliAvailable, fetchGitHubEmbed, patchWidget, updateCanvas, undoEvent, redoEvent, removeWidget } from './canvasApi.js'
import { registerWidget, unregisterWidget } from '../../core/stores/widgetRegistry.js'
import { getConfig, initConfig } from '../../core/stores/configStore.ts'

const fixture = vi.hoisted(() => ({ canvas: null, jsxExports: null, trackMany: vi.fn(), track: vi.fn(), trackBatch: vi.fn(), groupActionCalls: vi.fn(), queuedGroupActionGate: null }))
const originalConfig = getConfig()
vi.mock('./useCanvas.js', () => ({ useCanvas: () => ({ canvas: fixture.canvas, jsxExports: fixture.jsxExports, loading: false }) }))
// Exercise CanvasPage, real declarative chrome and tiny-canvas together.
vi.mock('./widgets/ComponentWidget.jsx', () => ({ default: () => <div>JSX content</div> }))
vi.mock('./widgets/index.js', async () => {
  const React = await import('react')
  const TestWidget = React.forwardRef(function TestWidget({ id, props, onUpdate }, ref) {
    React.useImperativeHandle(ref, () => ({
      handleAction(action) {
        if (action === 'wait-group-value') {
          fixture.groupActionCalls(id)
          onUpdate?.({ color: 'pink' })
          return fixture.queuedGroupActionGate?.()
        }
        if (action !== 'set-group-value') return false
        fixture.groupActionCalls(id)
        onUpdate?.({ color: 'pink' })
        return true
      },
    }), [id, onUpdate])
    return <div data-testid={`content-${id}`} data-color={props?.color} data-title={props?.title}
      data-frame-theme={props?.frameThemeOverride} data-frame-device={props?.frameDevice}
      data-width={props?.width} data-height={props?.height}>Content {id}</div>
  })
  return { getWidgetComponent: () => TestWidget }
})
vi.mock('./canvasApi.js', async () => {
  const actual = await vi.importActual('./canvasApi.js')
  return { ...actual,
    addWidget: vi.fn(),
    batchOperations: vi.fn(),
    checkGitHubCliAvailable: vi.fn(),
    fetchGitHubEmbed: vi.fn(),
    patchWidget: vi.fn(),
    updateCanvas: vi.fn(),
    undoEvent: vi.fn(),
    redoEvent: vi.fn(),
    removeWidget: vi.fn(),
  }
})
vi.mock('./useUndoRedo.js', async () => {
  const actual = await vi.importActual('./useUndoRedo.js')
  return { default: () => {
    const history = actual.default()
    return { ...history,
      track: (id, token) => { fixture.track(id, ...(token === undefined ? [] : [token])); history.track(id, token) },
      trackMany: (ids, token) => { fixture.trackMany(ids, ...(token === undefined ? [] : [token])); history.trackMany(ids, token) },
      trackBatch: (ids, token) => { fixture.trackBatch(ids, ...(token === undefined ? [] : [token])); history.trackBatch(ids, token) },
    }
  } }
})

const sticky = (id, x, y, width = 100, height = 80) => ({ id, type: 'sticky-note', position: { x, y }, props: { width, height, color: 'yellow' } })
const positionOf = (id) => {
  const node = document.getElementById(id)
  return { x: Number(node.dataset.tcX), y: Number(node.dataset.tcY) }
}
const select = (...ids) => ids.forEach((id, index) => fireEvent.click(document.getElementById(id), { shiftKey: index > 0 }))
function pointer(target, type, x, y, pointerId) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
  if (pointerId != null) Object.defineProperty(event, 'pointerId', { value: pointerId })
  fireEvent(target, event)
}

beforeEach(() => {
  window.__SB_LOCAL_DEV__ = true
  fixture.canvas = { _route: 'selection-test', title: 'Selection test', widgets: [sticky('a', 100, 100), sticky('b', 350, 250, 180, 120), sticky('other', 700, 100)], sources: [], gridSize: 18, autoPlace: true }
  fixture.jsxExports = null
  fixture.queuedGroupActionGate = null
  vi.clearAllMocks()
  batchOperations.mockImplementation(async (_id, operations) => ({ success: true, results: operations.map((operation, index) => ({ ...operation, eventId: `move-${index}` })) }))
  patchWidget.mockResolvedValue({ success: true, eventIds: ['patch-event'] })
  checkGitHubCliAvailable.mockResolvedValue({ available: true })
  fetchGitHubEmbed.mockReset()
  updateCanvas.mockResolvedValue({ success: true })
  removeWidget.mockResolvedValue({ success: true, eventId: 'removed' })
})
afterEach(() => {
  initConfig(originalConfig)
  delete window.__SB_LOCAL_DEV__
  unregisterWidget('test-subset')
  unregisterWidget('test-group-action')
  unregisterWidget('test-refresh-action')
  vi.unstubAllGlobals()
})

describe('group selection controls', () => {
  it('encloses actual geometry with one handle and changes focus without arranging on toggle', () => {
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    const outline = screen.getByRole('region', { name: 'Selected widgets' })
    expect(outline).toHaveStyle({ left: '100px', top: '100px', width: '430px', height: '270px' })
    expect(screen.getAllByRole('button', { name: 'Move selected widgets' })).toHaveLength(1)
    expect(document.getElementById('a').querySelector('.tc-drag-handle')).toBeNull()
    expect(document.getElementById('b').querySelector('.tc-drag-handle')).toBeNull()
    expect(outline).toHaveAttribute('data-autoplace', 'true')
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:toggle-auto-place')))
    expect(outline).not.toHaveAttribute('data-autoplace')
    expect(positionOf('a')).toEqual({ x: 100, y: 100 })
    expect(positionOf('b')).toEqual({ x: 350, y: 250 })
    expect(batchOperations).not.toHaveBeenCalled()
  })

  it('moves every member live with rigid offsets, leaves peers alone and persists once', async () => {
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    const handle = screen.getByRole('button', { name: 'Move selected widgets' })
    const contentA = screen.getByTestId('content-a')
    const contentB = screen.getByTestId('content-b')
    pointer(handle, 'pointerdown', 50, 60)
    pointer(document, 'pointermove', 90, 90)
    expect(positionOf('a')).toEqual({ x: 140, y: 130 })
    expect(positionOf('b')).toEqual({ x: 390, y: 280 })
    expect(positionOf('other')).toEqual({ x: 700, y: 100 })
    expect(document.getElementById('a').closest('article')).toHaveStyle({ transform: 'translate3d(140px, 130px, 0)' })
    expect(document.getElementById('b').closest('article')).toHaveStyle({ transform: 'translate3d(390px, 280px, 0)' })
    expect(document.getElementById('a')).toBeVisible()
    expect(document.getElementById('b')).toBeVisible()
    expect(screen.getByTestId('content-a')).toBe(contentA)
    expect(screen.getByTestId('content-b')).toBe(contentB)
    expect(contentA).toBeVisible()
    expect(contentB).toBeVisible()
    expect(document.querySelector('[data-storyboard-canvas-zoom]')).toHaveAttribute('data-selection-dragging', 'true')
    expect(screen.getByRole('region', { name: 'Selected widgets' })).toHaveStyle({ left: '140px', top: '130px' })
    expect(batchOperations).not.toHaveBeenCalled()
    pointer(document, 'pointerup', 90, 90)
    expect(screen.getByTestId('content-a')).toBe(contentA)
    expect(screen.getByTestId('content-b')).toBe(contentB)
    expect(contentA).toBeVisible()
    expect(contentB).toBeVisible()
    expect(document.querySelector('[data-storyboard-canvas-zoom]')).not.toHaveAttribute('data-selection-dragging')
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    expect(batchOperations).toHaveBeenCalledWith('selection-test', [
      { op: 'move-widget', widgetId: 'a', position: { x: 140, y: 130 } },
      { op: 'move-widget', widgetId: 'b', position: { x: 390, y: 280 } },
    ])
    await waitFor(() => expect(fixture.trackBatch).toHaveBeenCalledWith(['move-0', 'move-1']))
    expect(screen.getByRole('button', { name: 'Move selected widgets' })).toBeInTheDocument()
  })

  it('clamps one delta at the boundary and restores canceled dragging without writes', () => {
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    pointer(screen.getByRole('button', { name: 'Move selected widgets' }), 'pointerdown', 0, 0)
    expect(document.documentElement).toHaveAttribute('data-hypercanvas-widget-drag-cursor')
    pointer(document, 'pointermove', -500, -500)
    expect(positionOf('a')).toEqual({ x: 18, y: 18 })
    expect(positionOf('b')).toEqual({ x: 268, y: 168 })
    pointer(document, 'pointercancel', -500, -500)
    expect(positionOf('a')).toEqual({ x: 100, y: 100 })
    expect(positionOf('b')).toEqual({ x: 350, y: 250 })
    expect(batchOperations).not.toHaveBeenCalled()
    expect(document.documentElement).not.toHaveAttribute('data-hypercanvas-widget-drag-cursor')
  })

  it('captures the initiating pointer across iframe surfaces and cancels safely when capture is lost', () => {
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    const handle = screen.getByRole('button', { name: 'Move selected widgets' })
    let captured = false
    handle.setPointerCapture = vi.fn(() => { captured = true })
    handle.hasPointerCapture = () => captured
    handle.releasePointerCapture = vi.fn(() => { captured = false })
    pointer(handle, 'pointerdown', 0, 0, 7)
    expect(handle.setPointerCapture).toHaveBeenCalledWith(7)
    pointer(document, 'pointermove', 40, 30, 8)
    pointer(document, 'pointerup', 40, 30, 8)
    expect(positionOf('a')).toEqual({ x: 100, y: 100 })
    pointer(document, 'pointermove', 40, 30, 7)
    expect(positionOf('a')).toEqual({ x: 140, y: 130 })
    pointer(handle, 'lostpointercapture', 40, 30, 7)
    expect(positionOf('a')).toEqual({ x: 100, y: 100 })
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(7)
    expect(batchOperations).not.toHaveBeenCalled()
  })

  it('uses zoomed pointer deltas and keeps the outline in canvas coordinates', async () => {
    render(<CanvasPage canvasId="selection-test" />)
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:set-zoom', { detail: { zoom: 200 } })))
    select('a', 'b')
    pointer(screen.getByRole('button', { name: 'Move selected widgets' }), 'pointerdown', 0, 0)
    pointer(document, 'pointermove', 100, 80)
    expect(positionOf('a')).toEqual({ x: 150, y: 140 })
    expect(positionOf('b')).toEqual({ x: 400, y: 290 })
    pointer(document, 'pointerup', 100, 80)
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
  })

  it('returns to the origin during drag without leaving a stale translated group', () => {
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    pointer(screen.getByRole('button', { name: 'Move selected widgets' }), 'pointerdown', 0, 0)
    pointer(document, 'pointermove', 40, 30)
    pointer(document, 'pointermove', 0, 0)
    pointer(document, 'pointerup', 0, 0)
    expect(positionOf('a')).toEqual({ x: 100, y: 100 })
    expect(positionOf('b')).toEqual({ x: 350, y: 250 })
    expect(batchOperations).not.toHaveBeenCalled()
  })

  it('arranges only on the explicit left action, preserving sizes and unselected positions', async () => {
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    const button = screen.getByRole('button', { name: 'Align to grid' })
    const actions = screen.getByRole('group', { name: 'Selection actions' })
    expect(within(actions).getAllByRole('button')[0]).toBe(button)
    expect(button.querySelector('svg')).not.toBeNull()
    expect(button.querySelectorAll('svg path')).toHaveLength(4)
    expect(batchOperations).not.toHaveBeenCalled()
    fireEvent.click(button)
    expect(positionOf('a')).toEqual({ x: 100, y: 100 })
    expect(positionOf('b')).toEqual({ x: 240, y: 100 })
    expect(positionOf('other')).toEqual({ x: 700, y: 100 })
    expect(screen.getByRole('region', { name: 'Selected widgets' })).toHaveStyle({ width: '320px', height: '120px' })
    expect(document.getElementById('b').closest('article')).toHaveClass('tc-on-translation')
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    fireEvent.click(button)
    expect(batchOperations).toHaveBeenCalledTimes(1)
  })

  it('tracks measured content resizing for the outline and explicit grid geometry', async () => {
    const callbacks = []
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { callbacks.push(callback) }
      observe() {}
      disconnect() {}
    })
    render(<CanvasPage canvasId="selection-test" />)
    let width = 600
    const chrome = document.getElementById('a').querySelector('[data-widget-id]')
    Object.defineProperty(chrome, 'offsetWidth', { get: () => width })
    select('a', 'b')
    expect(screen.getByRole('region', { name: 'Selected widgets' })).toHaveStyle({ width: '600px' })
    width = 800
    act(() => callbacks.forEach((callback) => callback([])))
    expect(screen.getByRole('region', { name: 'Selected widgets' })).toHaveStyle({ width: '800px' })
    expect(batchOperations).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Align to grid' }))
    expect(positionOf('b')).toEqual({ x: 940, y: 100 })
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
  })

  it('includes JSX source bounds and persists mixed selection movement', async () => {
    fixture.canvas.sources = [{ export: 'Sample', position: { x: 40, y: 50 }, width: 240, height: 160 }]
    fixture.jsxExports = { Sample: () => <div>sample</div> }
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'jsx-Sample')
    expect(screen.getByRole('region', { name: 'Selected widgets' })).toHaveStyle({ left: '40px', top: '50px', width: '240px', height: '160px' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move selected widgets' }), { key: 'ArrowRight', shiftKey: true })
    expect(positionOf('a')).toEqual({ x: 110, y: 100 })
    expect(positionOf('jsx-Sample')).toEqual({ x: 50, y: 50 })
    await waitFor(() => expect(updateCanvas).toHaveBeenCalledWith('selection-test', { sources: [{ export: 'Sample', position: { x: 50, y: 50 }, width: 240, height: 160 }] }))
  })

  it('undoes and redoes the entire grid once, including exact fractional JSX and widget positions', async () => {
    fixture.canvas.widgets = [sticky('a', 100.3, 100.7), sticky('b', 350.8, 250.2, 180, 120), sticky('other', 700.4, 100.6)]
    fixture.canvas.sources = [{ export: 'Sample', position: { x: 40.25, y: 50.5 }, width: 240, height: 160 }]
    fixture.jsxExports = { Sample: () => <div>sample</div> }
    const originals = Object.fromEntries(fixture.canvas.widgets.map((widget) => [widget.id, widget.position]))
    const originalSources = fixture.canvas.sources
    const events = new Map()
    batchOperations.mockImplementation(async (_id, operations) => ({ success: true, results: operations.map((operation) => {
      const eventId = `grid-${operation.widgetId}`
      events.set(eventId, { forward: { event: 'widget_moved', widgetId: operation.widgetId, position: operation.position }, inverse: { event: 'widget_moved', widgetId: operation.widgetId, position: originals[operation.widgetId] } })
      return { eventId }
    }) }))
    updateCanvas.mockImplementation(async (_id, { sources }) => {
      events.set('grid-source', { forward: { event: 'source_updated', sources }, inverse: { event: 'source_updated', sources: originalSources } })
      return { success: true, eventIds: ['grid-source'] }
    })
    undoEvent.mockImplementation(async (_id, eventId) => ({ status: 200, data: { eventId: `inverse-${eventId}`, inverseEvent: events.get(eventId).inverse } }))
    redoEvent.mockImplementation(async (_id, eventId) => ({ status: 200, data: { eventId: `redo-${eventId}`, inverseEvent: events.get(eventId.slice('inverse-'.length)).forward } }))
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b', 'jsx-Sample')
    fireEvent.click(screen.getByRole('button', { name: 'Align to grid' }))
    await waitFor(() => expect(fixture.trackBatch).toHaveBeenCalledWith(['grid-a', 'grid-b', 'grid-source']))
    expect(fixture.trackBatch).toHaveBeenCalledTimes(1)
    const arranged = { a: positionOf('a'), b: positionOf('b'), source: positionOf('jsx-Sample') }
    expect(arranged.a).not.toEqual(originals.a)
    expect(positionOf('other')).toEqual(originals.other)
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(positionOf('a')).toEqual(originals.a))
    expect(positionOf('b')).toEqual(originals.b)
    expect(positionOf('jsx-Sample')).toEqual(originalSources[0].position)
    expect(positionOf('other')).toEqual(originals.other)
    expect(undoEvent.mock.calls.map(([, id]) => id)).toEqual(['grid-source', 'grid-b', 'grid-a'])
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(positionOf('jsx-Sample')).toEqual(arranged.source))
    expect(positionOf('a')).toEqual(arranged.a)
    expect(positionOf('b')).toEqual(arranged.b)
    expect(positionOf('other')).toEqual(originals.other)
    expect(redoEvent.mock.calls.map(([, id]) => id)).toEqual(['inverse-grid-a', 'inverse-grid-b', 'inverse-grid-source'])
  })

  it('updates selected sticky colors as one real chrome action with one Undo and Redo', async () => {
    const originalColors = { a: 'yellow', b: 'yellow', other: 'yellow' }
    const events = new Map()
    batchOperations.mockImplementation(async (_id, operations) => ({ success: true, results: operations.map((operation) => {
      const eventId = `color-${operation.widgetId}`
      events.set(eventId, {
        forward: { event: 'widget_updated', widgetId: operation.widgetId, props: operation.props, prevProps: { color: originalColors[operation.widgetId] } },
        inverse: { event: 'widget_updated', widgetId: operation.widgetId, props: { color: originalColors[operation.widgetId] }, prevProps: operation.props },
      })
      return { eventId }
    }) }))
    undoEvent.mockImplementation(async (_id, eventId) => ({ status: 200, data: { eventId: `inverse-${eventId}`, inverseEvent: events.get(eventId).inverse } }))
    redoEvent.mockImplementation(async (_id, inverseId) => {
      const eventId = inverseId.replace(/^inverse-/, '')
      return { status: 200, data: { eventId: `redo-${eventId}`, inverseEvent: events.get(eventId).forward } }
    })
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    const group = screen.getByRole('group', { name: 'Selection actions' })
    fireEvent.click(within(group).getByRole('button', { name: 'Change color' }))
    fireEvent.click(within(group).getByRole('button', { name: 'Set color to pink' }))

    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    expect(batchOperations).toHaveBeenCalledWith('selection-test', [
      { op: 'update-widget', widgetId: 'a', props: { color: 'pink' } },
      { op: 'update-widget', widgetId: 'b', props: { color: 'pink' } },
    ])
    await waitFor(() => expect(fixture.trackBatch).toHaveBeenCalledWith(['color-a', 'color-b']))
    expect(fixture.trackBatch).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('content-a')).toHaveAttribute('data-color', 'pink')
    expect(screen.getByTestId('content-b')).toHaveAttribute('data-color', 'pink')
    expect(screen.getByTestId('content-other')).toHaveAttribute('data-color', 'yellow')

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(screen.getByTestId('content-a')).toHaveAttribute('data-color', 'yellow'))
    expect(screen.getByTestId('content-b')).toHaveAttribute('data-color', 'yellow')
    expect(screen.getByTestId('content-other')).toHaveAttribute('data-color', 'yellow')
    expect(undoEvent.mock.calls.map(([, eventId]) => eventId)).toEqual(['color-b', 'color-a'])

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(screen.getByTestId('content-a')).toHaveAttribute('data-color', 'pink'))
    expect(screen.getByTestId('content-b')).toHaveAttribute('data-color', 'pink')
    expect(screen.getByTestId('content-other')).toHaveAttribute('data-color', 'yellow')
    expect(redoEvent.mock.calls.map(([, eventId]) => eventId)).toEqual(['inverse-color-a', 'inverse-color-b'])
    expect(patchWidget).not.toHaveBeenCalled()
  })

  it('sets prototype/component theme as one eligible-only batch with one Undo and Redo', async () => {
    initConfig({ ...originalConfig, theming: { themes: {
      light: { label: 'Light' }, dark: { label: 'Dark' },
    } } })
    fixture.canvas.widgets = [
      { id: 'prototype', type: 'prototype', position: { x: 100, y: 100 }, props: { width: 420, height: 300, frameThemeOverride: null } },
      { id: 'component', type: 'component', position: { x: 300, y: 100 }, props: { width: 320, height: 240, frameThemeOverride: null } },
      sticky('other', 600, 100),
    ]
    const events = new Map()
    batchOperations.mockImplementation(async (_id, operations) => ({ success: true, results: operations.map(operation => {
      const eventId = `theme-${operation.widgetId}`
      const previous = fixture.canvas.widgets.find(widget => widget.id === operation.widgetId)?.props || {}
      events.set(eventId, {
        forward: { event: 'widget_updated', widgetId: operation.widgetId, props: operation.props, prevProps: previous },
        inverse: { event: 'widget_updated', widgetId: operation.widgetId, props: previous, prevProps: operation.props },
      })
      return { eventId }
    }) }))
    undoEvent.mockImplementation(async (_id, eventId) => ({ status: 200, data: { eventId: `inverse-${eventId}`, inverseEvent: events.get(eventId).inverse } }))
    redoEvent.mockImplementation(async (_id, inverseId) => {
      const eventId = inverseId.replace(/^inverse-/, '')
      return { status: 200, data: { eventId: `redo-${eventId}`, inverseEvent: events.get(eventId).forward } }
    })

    render(<CanvasPage canvasId="selection-test" />)
    select('prototype', 'component')
    const group = screen.getByRole('group', { name: 'Selection actions' })
    fireEvent.click(within(group).getByRole('button', { name: 'Theme' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }))
      await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    })
    expect(batchOperations.mock.calls[0][1]).toEqual([
      { op: 'update-widget', widgetId: 'prototype', props: { frameThemeOverride: 'dark' } },
      { op: 'update-widget', widgetId: 'component', props: { frameThemeOverride: 'dark' } },
    ])
    await waitFor(() => expect(fixture.trackBatch).toHaveBeenCalledTimes(1))
    expect(fixture.trackBatch.mock.calls[0][0]).toEqual(['theme-prototype', 'theme-component'])
    expect(screen.getByTestId('content-prototype')).toHaveAttribute('data-frame-theme', 'dark')
    expect(screen.getByTestId('content-component')).toHaveAttribute('data-frame-theme', 'dark')
    expect(screen.getByTestId('content-other')).not.toHaveAttribute('data-frame-theme')

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(undoEvent).toHaveBeenCalledTimes(2))
    expect(undoEvent.mock.calls.map(([, id]) => id)).toEqual(['theme-component', 'theme-prototype'])
    await waitFor(() => expect(screen.getByTestId('content-prototype')).not.toHaveAttribute('data-frame-theme'))
    expect(screen.getByTestId('content-component')).not.toHaveAttribute('data-frame-theme')

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(redoEvent).toHaveBeenCalledTimes(2))
    expect(redoEvent.mock.calls.map(([, id]) => id)).toEqual(['inverse-theme-prototype', 'inverse-theme-component'])
    expect(screen.getByTestId('content-prototype')).toHaveAttribute('data-frame-theme', 'dark')
    expect(screen.getByTestId('content-component')).toHaveAttribute('data-frame-theme', 'dark')
  })

  it('clears a checked multi-frame Theme to inheritance as one undoable batch', async () => {
    initConfig({ ...originalConfig, theming: { themes: {
      light: { label: 'Light' }, dark: { label: 'Dark' },
    } } })
    fixture.canvas.widgets = [
      { id: 'prototype', type: 'prototype', position: { x: 100, y: 100 }, props: { width: 420, height: 300, frameThemeOverride: 'dark' } },
      { id: 'component', type: 'component', position: { x: 300, y: 100 }, props: { width: 320, height: 240, frameThemeOverride: 'dark' } },
      sticky('other', 600, 100),
    ]
    const currentProps = new Map(fixture.canvas.widgets.map(widget => [widget.id, { ...widget.props }]))
    const events = new Map()
    batchOperations.mockImplementation(async (_id, operations) => ({ success: true, results: operations.map(operation => {
      const eventId = `clear-theme-${operation.widgetId}`
      const previous = currentProps.get(operation.widgetId) || {}
      events.set(eventId, {
        forward: { event: 'widget_updated', widgetId: operation.widgetId, props: operation.props, prevProps: previous },
        inverse: { event: 'widget_updated', widgetId: operation.widgetId, props: previous, prevProps: operation.props },
      })
      currentProps.set(operation.widgetId, { ...previous, ...operation.props })
      return { eventId }
    }) }))
    undoEvent.mockImplementation(async (_id, eventId) => ({ status: 200, data: { eventId: `inverse-${eventId}`, inverseEvent: events.get(eventId).inverse } }))
    redoEvent.mockImplementation(async (_id, inverseId) => {
      const eventId = inverseId.replace(/^inverse-/, '')
      return { status: 200, data: { eventId: `redo-${eventId}`, inverseEvent: events.get(eventId).forward } }
    })

    render(<CanvasPage canvasId="selection-test" />)
    select('prototype', 'component')
    const group = screen.getByRole('group', { name: 'Selection actions' })
    fireEvent.click(within(group).getByRole('button', { name: 'Theme' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }))
      await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    })
    expect(batchOperations.mock.calls[0][1]).toEqual([
      { op: 'update-widget', widgetId: 'prototype', props: { frameThemeOverride: null } },
      { op: 'update-widget', widgetId: 'component', props: { frameThemeOverride: null } },
    ])
    await waitFor(() => expect(fixture.trackBatch).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('content-prototype')).not.toHaveAttribute('data-frame-theme')
    expect(screen.getByTestId('content-component')).not.toHaveAttribute('data-frame-theme')

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(undoEvent).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('content-prototype')).toHaveAttribute('data-frame-theme', 'dark')
    expect(screen.getByTestId('content-component')).toHaveAttribute('data-frame-theme', 'dark')

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(redoEvent).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('content-prototype')).not.toHaveAttribute('data-frame-theme')
    expect(screen.getByTestId('content-component')).not.toHaveAttribute('data-frame-theme')
  })

  it('applies Device width-only by default and batches opt-in clipping through the real action path', async () => {
    fixture.canvas.widgets = [
      { id: 'prototype', type: 'prototype', position: { x: 100, y: 100 }, props: { width: 420, height: 487 } },
      { id: 'site', type: 'site-frame', position: { x: 300, y: 100 }, props: { width: 600, height: 312 } },
      sticky('other', 700, 100),
    ]
    const events = new Map()
    const currentProps = new Map(fixture.canvas.widgets.map(widget => [widget.id, { ...widget.props }]))
    let actionIndex = 0
    batchOperations.mockImplementation(async (_id, operations) => {
      actionIndex += 1
      return { success: true, results: operations.map(operation => {
        const eventId = `device-${actionIndex}-${operation.widgetId}`
        const previous = currentProps.get(operation.widgetId) || {}
        events.set(eventId, {
          forward: { event: 'widget_updated', widgetId: operation.widgetId, props: operation.props, prevProps: previous },
          inverse: { event: 'widget_updated', widgetId: operation.widgetId, props: previous, prevProps: operation.props },
        })
        currentProps.set(operation.widgetId, { ...previous, ...operation.props })
        return { eventId }
      }) }
    })
    undoEvent.mockImplementation(async (_id, eventId) => ({ status: 200, data: { eventId: `inverse-${eventId}`, inverseEvent: events.get(eventId).inverse } }))
    redoEvent.mockImplementation(async (_id, inverseId) => {
      const eventId = inverseId.replace(/^inverse-/, '')
      return { status: 200, data: { eventId: `redo-${eventId}`, inverseEvent: events.get(eventId).forward } }
    })

    render(<CanvasPage canvasId="selection-test" />)
    select('prototype', 'site')
    const group = screen.getByRole('group', { name: 'Selection actions' })
    fireEvent.click(within(group).getByRole('button', { name: 'Device' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Mobile' }))
      await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    })
    expect(batchOperations.mock.calls[0][1]).toEqual([
      { op: 'update-widget', widgetId: 'prototype', props: { frameDevice: 'mobile', width: 390 } },
      { op: 'update-widget', widgetId: 'site', props: { frameDevice: 'mobile', width: 390 } },
    ])
    expect(screen.getByTestId('content-prototype')).toHaveAttribute('data-height', '487')
    expect(screen.getByTestId('content-site')).toHaveAttribute('data-height', '312')
    expect(screen.getByTestId('content-other')).toHaveAttribute('data-width', '100')

    fireEvent.click(within(group).getByRole('button', { name: 'Device' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Clip height' }))
      await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(2))
    })
    expect(batchOperations.mock.calls[1][1]).toEqual([
      { op: 'update-widget', widgetId: 'prototype', props: { frameClipHeight: true, height: 844 } },
      { op: 'update-widget', widgetId: 'site', props: { frameClipHeight: true, height: 844 } },
    ])
    await waitFor(() => expect(fixture.trackBatch).toHaveBeenCalledTimes(2))

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(undoEvent).toHaveBeenCalledTimes(2))
    expect(undoEvent.mock.calls.map(([, id]) => id)).toEqual(['device-2-site', 'device-2-prototype'])
    expect(screen.getByTestId('content-prototype')).toHaveAttribute('data-width', '390')
    expect(screen.getByTestId('content-prototype')).toHaveAttribute('data-height', '487')
    expect(screen.getByTestId('content-site')).toHaveAttribute('data-height', '312')
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(redoEvent).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('content-prototype')).toHaveAttribute('data-height', '844')
    expect(screen.getByTestId('content-site')).toHaveAttribute('data-height', '844')
  })

  it('groups per-widget handler effects from any shared selection action into one history entry', async () => {
    registerWidget('test-group-action', { features: [{ id: 'set-group-value', type: 'action', action: 'set-group-value', label: 'Set group value', multiSelection: {} }] })
    fixture.canvas.widgets[0].type = 'test-group-action'
    fixture.canvas.widgets[1].type = 'test-group-action'
    const events = new Map()
    patchWidget.mockImplementation(async (_id, widgetId, { props }) => {
      const eventId = `action-${widgetId}`
      events.set(eventId, {
        forward: { event: 'widget_updated', widgetId, props, prevProps: { color: 'yellow' } },
        inverse: { event: 'widget_updated', widgetId, props: { color: 'yellow' }, prevProps: props },
      })
      return { success: true, eventIds: [eventId] }
    })
    undoEvent.mockImplementation(async (_id, eventId) => ({ status: 200, data: { eventId: `inverse-${eventId}`, inverseEvent: events.get(eventId).inverse } }))
    redoEvent.mockImplementation(async (_id, inverseId) => {
      const eventId = inverseId.replace(/^inverse-/, '')
      return { status: 200, data: { eventId: `redo-${eventId}`, inverseEvent: events.get(eventId).forward } }
    })
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    fireEvent.click(within(screen.getByRole('group', { name: 'Selection actions' })).getByRole('button', { name: 'Set group value' }))
    await waitFor(() => expect(fixture.groupActionCalls).toHaveBeenCalled())
    await waitFor(() => expect(patchWidget).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('content-a')).toHaveAttribute('data-color', 'pink')
    expect(screen.getByTestId('content-b')).toHaveAttribute('data-color', 'pink')
    expect(screen.getByTestId('content-other')).toHaveAttribute('data-color', 'yellow')

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(screen.getByTestId('content-a')).toHaveAttribute('data-color', 'yellow'))
    expect(screen.getByTestId('content-b')).toHaveAttribute('data-color', 'yellow')
    expect(screen.getByTestId('content-other')).toHaveAttribute('data-color', 'yellow')
    expect(undoEvent.mock.calls.map(([, eventId]) => eventId)).toEqual(['action-b', 'action-a'])

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(screen.getByTestId('content-a')).toHaveAttribute('data-color', 'pink'))
    expect(screen.getByTestId('content-b')).toHaveAttribute('data-color', 'pink')
    expect(screen.getByTestId('content-other')).toHaveAttribute('data-color', 'yellow')
    expect(redoEvent.mock.calls.map(([, eventId]) => eventId)).toEqual(['inverse-action-a', 'inverse-action-b'])
  })

  it('serializes overlapping async selection actions so each closes its own history batch', async () => {
    registerWidget('test-queued-action', { features: [{ id: 'wait-group-value', type: 'action', action: 'wait-group-value', label: 'Wait group value', multiSelection: {} }] })
    fixture.canvas.widgets[0].type = 'test-queued-action'
    fixture.canvas.widgets[1].type = 'test-queued-action'
    const releases = []
    fixture.queuedGroupActionGate = () => new Promise(resolve => releases.push(resolve))
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    const action = within(screen.getByRole('group', { name: 'Selection actions' })).getByRole('button', { name: 'Wait group value' })

    fireEvent.click(action)
    await waitFor(() => expect(fixture.groupActionCalls).toHaveBeenCalledTimes(1))
    fireEvent.click(action)
    expect(fixture.groupActionCalls).toHaveBeenCalledTimes(1)

    for (let index = 0; index < 4; index++) {
      await waitFor(() => expect(releases).toHaveLength(index + 1))
      await act(async () => { releases[index]() })
      if (index < 3) await waitFor(() => expect(fixture.groupActionCalls).toHaveBeenCalledTimes(index + 2))
    }

    await waitFor(() => expect(fixture.trackMany).toHaveBeenCalledTimes(4))
    const tokens = fixture.trackMany.mock.calls.map(([, token]) => token)
    expect(tokens.every(Number.isInteger)).toBe(true)
    expect(new Set(tokens).size).toBe(2)
    expect(screen.getByTestId('content-other')).toHaveAttribute('data-color', 'yellow')
    unregisterWidget('test-queued-action')
  })

  it('keeps confirmed multi-delete inside one history batch after the existing dialog resolves', async () => {
    registerWidget('test-confirm-delete', {
      deleteConfirm: { enabled: true, title: 'Delete widget?', message: 'Remove this widget.' },
      features: [{ id: 'delete', type: 'action', action: 'delete', label: 'Delete selected', multiSelection: {} }],
    })
    fixture.canvas.widgets[0].type = 'test-confirm-delete'
    fixture.canvas.widgets[1].type = 'test-confirm-delete'
    removeWidget.mockImplementation(async (_canvasId, id) => ({ success: true, eventId: `removed-${id}` }))
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    fireEvent.click(within(screen.getByRole('group', { name: 'Selection actions' })).getByRole('button', { name: 'Delete selected' }))
    expect(removeWidget).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Delete widgets' }))

    await waitFor(() => expect(removeWidget).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(fixture.track).toHaveBeenCalledTimes(2))
    expect(fixture.track.mock.calls.map(([eventId]) => eventId).sort()).toEqual(['removed-a', 'removed-b'])
    expect(fixture.track.mock.calls[0][1]).toBe(fixture.track.mock.calls[1][1])
    unregisterWidget('test-confirm-delete')
  })

  it('waits for async refresh effects and batches both selected widgets into one Undo', async () => {
    registerWidget('test-refresh-action', { features: [{ id: 'refresh-github', type: 'action', action: 'refresh-github', label: 'Refresh data', multiSelection: {} }] })
    fixture.canvas.widgets = ['a', 'b', 'other'].map((id, index) => ({
      ...sticky(id, 100 + index * 180, 100),
      type: 'test-refresh-action',
      props: { width: 100, height: 80, title: `Old ${id}`, url: `https://github.com/example/${id}`, github: {} },
    }))
    let resolveFirst
    let resolveSecond
    fetchGitHubEmbed
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve }))
    const refreshEvents = new Map()
    patchWidget.mockImplementation(async (_canvasId, widgetId, { props }) => {
      const eventId = `refresh-${widgetId}`
      refreshEvents.set(eventId, { forward: { event: 'widget_updated', widgetId, props, prevProps: { title: `Old ${widgetId}` } } })
      return { success: true, eventIds: [eventId] }
    })
    undoEvent.mockImplementation(async (_canvasId, eventId) => ({ status: 200, data: {
      eventId: `inverse-${eventId}`,
      inverseEvent: { event: 'widget_updated', widgetId: eventId.replace('refresh-', ''), props: { title: `Old ${eventId.replace('refresh-', '')}` } },
    } }))
    redoEvent.mockImplementation(async (_canvasId, inverseId) => {
      const eventId = inverseId.replace('inverse-', '')
      return { status: 200, data: { eventId: `redo-${eventId}`, inverseEvent: refreshEvents.get(eventId).forward } }
    })

    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    fireEvent.click(within(screen.getByRole('group', { name: 'Selection actions' })).getByRole('button', { name: 'Refresh data' }))
    await waitFor(() => expect(fetchGitHubEmbed).toHaveBeenCalledTimes(1))
    expect(patchWidget).not.toHaveBeenCalled()
    resolveFirst({ success: true, snapshot: { title: 'New a' } })
    await waitFor(() => expect(fetchGitHubEmbed).toHaveBeenCalledTimes(2))
    expect(patchWidget).not.toHaveBeenCalled()
    resolveSecond({ success: true, snapshot: { title: 'New b' } })

    await waitFor(() => expect(patchWidget).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByTestId('content-a')).toHaveAttribute('data-title', 'New a'))
    expect(screen.getByTestId('content-b')).toHaveAttribute('data-title', 'New b')
    expect(undoEvent).not.toHaveBeenCalled()
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(undoEvent.mock.calls).toHaveLength(2))
    expect(undoEvent.mock.calls.map(([, eventId]) => eventId)).toEqual(['refresh-b', 'refresh-a'])
    await waitFor(() => expect(screen.getByTestId('content-a')).toHaveAttribute('data-title', 'Old a'))
    expect(screen.getByTestId('content-b')).toHaveAttribute('data-title', 'Old b')
    expect(document.getElementById('a')).toHaveAttribute('data-tc-x', '100')
    expect(document.getElementById('b')).toHaveAttribute('data-tc-x', '280')

    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(redoEvent.mock.calls).toHaveLength(2))
    expect(redoEvent.mock.calls.map(([, eventId]) => eventId)).toEqual(['inverse-refresh-a', 'inverse-refresh-b'])
    await waitFor(() => expect(screen.getByTestId('content-a')).toHaveAttribute('data-title', 'New a'))
    expect(screen.getByTestId('content-b')).toHaveAttribute('data-title', 'New b')
    unregisterWidget('test-refresh-action')
  })

  it('hides exclusive sticky color for a mixed unsupported selection', () => {
    fixture.canvas.widgets[1].type = 'markdown'
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    expect(within(screen.getByRole('group', { name: 'Selection actions' })).queryByRole('button', { name: 'Change color' })).toBeNull()
  })

  it('routes an opted-in subset copy through the existing CanvasPage creation handler', async () => {
    registerWidget('test-subset', { features: [{ id: 'copy', type: 'action', action: 'copy', label: 'Copy eligible', icon: 'copy', multiSelection: { exclusive: false } }] })
    fixture.canvas.widgets[0].type = 'test-subset'
    fixture.canvas.widgets[1].type = 'markdown'
    fixture.canvas.widgets[2].type = 'test-subset'
    batchOperations.mockImplementation(async (_id, operations) => ({ success: true, results: operations.map((operation, index) => ({ ...operation, index, widget: { id: 'copied', type: operation.type, props: operation.props, position: operation.position }, eventIds: ['copy-added'] })) }))
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    fireEvent.click(within(screen.getByRole('group', { name: 'Selection actions' })).getByRole('button', { name: 'Copy eligible' }))
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    expect(batchOperations).toHaveBeenCalledWith('selection-test', [expect.objectContaining({ type: 'test-subset', position: { x: 200, y: 100 }, resolve: false, near: false })])
    expect(fixture.trackBatch).toHaveBeenCalledWith(['copy-added'])
    expect(positionOf('b')).toEqual({ x: 350, y: 250 })
    expect(positionOf('other')).toEqual({ x: 700, y: 100 })
  })

  it('routes an opted-in subset delete through the existing confirmed removal path', async () => {
    registerWidget('test-subset', { features: [{ id: 'delete', type: 'action', action: 'delete', label: 'Delete eligible', icon: 'trash', multiSelection: { exclusive: false } }] })
    fixture.canvas.widgets[0].type = 'test-subset'
    fixture.canvas.widgets[1].type = 'markdown'
    fixture.canvas.widgets[2].type = 'test-subset'
    render(<CanvasPage canvasId="selection-test" />)
    select('a', 'b')
    fireEvent.click(within(screen.getByRole('group', { name: 'Selection actions' })).getByRole('button', { name: 'Delete eligible' }))
    await waitFor(() => expect(removeWidget).toHaveBeenCalledTimes(1))
    expect(removeWidget).toHaveBeenCalledWith('selection-test', 'a')
    await waitFor(() => expect(document.getElementById('a')).toBeNull())
    expect(positionOf('b')).toEqual({ x: 350, y: 250 })
    expect(positionOf('other')).toEqual({ x: 700, y: 100 })
  })

  it('opts interactive Agent creation into placement and reconciles peers, sources and undo ids', async () => {
    fixture.canvas.sources = [{ export: 'Sample', position: { x: 40, y: 50 } }]
    addWidget.mockResolvedValue({ success: true,
      widget: { id: 'new-agent', type: 'agent', position: { x: 900, y: 600 }, props: {} },
      placementEvents: [
        { event: 'widget_moved', widgetId: 'a', position: { x: 40, y: 600 } },
        { event: 'source_updated', sources: [{ export: 'Sample', position: { x: 40, y: 900 } }] },
      ], eventId: 'added', eventIds: ['moved', 'source', 'added'],
    })
    render(<CanvasPage canvasId="selection-test" />)
    await act(async () => document.dispatchEvent(new CustomEvent('storyboard:canvas:add-widget', { detail: { type: 'agent' } })))
    expect(addWidget).toHaveBeenCalledWith('selection-test', expect.objectContaining({ type: 'agent', resolve: true }))
    await waitFor(() => expect(document.getElementById('new-agent')).not.toBeNull())
    expect(positionOf('a')).toEqual({ x: 40, y: 600 })
    expect(fixture.trackMany).toHaveBeenCalledWith(['moved', 'source', 'added'])
  })
})

describe('single frame menu persistence', () => {
  it('updates Device, Clip height and Theme through the actual CanvasPage bound callback', async () => {
    initConfig({ ...originalConfig, theming: { themes: { light: { label: 'Light' }, dark: { label: 'Dark' } } } })
    fixture.canvas.widgets = [{ id: 'prototype-menu', type: 'prototype', position: { x: 100, y: 100 }, props: { width: 800, height: 600 } }]
    render(<CanvasPage canvasId="selection-test" />)
    select('prototype-menu')
    const chrome = within(document.getElementById('prototype-menu'))
    fireEvent.click(chrome.getByRole('button', { name: 'Device' }))
    fireEvent.click(chrome.getByRole('menuitemradio', { name: 'Mobile' }))
    expect(screen.getByTestId('content-prototype-menu')).toHaveAttribute('data-width', '390')
    fireEvent.click(chrome.getByRole('button', { name: 'Device' }))
    fireEvent.click(chrome.getByRole('menuitemcheckbox', { name: 'Clip height' }))
    expect(screen.getByTestId('content-prototype-menu')).toHaveAttribute('data-height', '844')
    fireEvent.click(chrome.getByRole('button', { name: 'Theme' }))
    fireEvent.click(chrome.getByRole('menuitemradio', { name: 'Dark' }))
    expect(screen.getByTestId('content-prototype-menu')).toHaveAttribute('data-frame-theme', 'dark')
    await waitFor(() => expect(patchWidget).toHaveBeenCalledWith('selection-test', 'prototype-menu', { props: {
      frameDevice: 'mobile', width: 390, frameClipHeight: true, height: 844, frameThemeOverride: 'dark',
    } }))
    expect(batchOperations).not.toHaveBeenCalled()
  })

  it('passes JSX component type and a bound Theme updater', async () => {
    initConfig({ ...originalConfig, theming: { themes: { light: { label: 'Light' }, dark: { label: 'Dark' } } } })
    fixture.canvas.widgets = []
    fixture.canvas.sources = [{ export: 'Sample', position: { x: 40, y: 50 }, width: 240, height: 160 }]
    fixture.jsxExports = { Sample: () => <div>sample</div> }
    render(<CanvasPage canvasId="selection-test" />)
    select('jsx-Sample')
    const chrome = within(document.getElementById('jsx-Sample'))
    fireEvent.click(chrome.getByRole('button', { name: 'Theme' }))
    fireEvent.click(chrome.getByRole('menuitemradio', { name: 'Dark' }))
    await waitFor(() => expect(updateCanvas).toHaveBeenCalledWith('selection-test', { sources: [
      { export: 'Sample', position: { x: 40, y: 50 }, width: 240, height: 160, frameThemeOverride: 'dark' },
    ] }), { timeout: 3000 })
    expect(document.getElementById('jsx-Sample')).toHaveAttribute('data-sb-canvas-theme', 'dark')
  })
})
