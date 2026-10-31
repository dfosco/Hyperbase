import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import CanvasPage from './CanvasPage.jsx'
import { batchOperations, updateCanvas, undoEvent, redoEvent } from './canvasApi.js'
import { applyEvent } from '../../core/canvas/materializer.js'
import { initCanvasConfig, _resetCanvasConfig } from '../../core/stores/canvasConfig.js'
import { registerWidget, unregisterWidget } from '../../core/stores/widgetRegistry.js'

const fixture = vi.hoisted(() => ({ canvas: null, created: [], persisted: null, events: null, sequence: 0 }))
vi.mock('./useCanvas.js', () => ({ useCanvas: () => ({ canvas: fixture.canvas, jsxExports: null, loading: false }) }))
vi.mock('./widgets/index.js', () => {
  function Content({ id, props }) { return <div data-testid={`content-${id}`}>{props.text}</div> }
  return { getWidgetComponent: () => Content }
})
vi.mock('./canvasApi.js', async () => {
  const actual = await vi.importActual('./canvasApi.js')
  return { ...actual, batchOperations: vi.fn(), updateCanvas: vi.fn(), undoEvent: vi.fn(), redoEvent: vi.fn() }
})

const widget = (id, x, y, width = 100, height = 80) => ({ id, type: 'sticky-note', position: { x, y }, props: { width, height, text: `Original content ${id}`, color: 'yellow' } })
const positionOf = (id) => {
  const node = document.getElementById(id)
  return node && { x: Number(node.dataset.tcX), y: Number(node.dataset.tcY) }
}
function record(forward, inverse) {
  const id = `event-${++fixture.sequence}`
  fixture.events.set(id, { forward, inverse })
  fixture.persisted = applyEvent(fixture.persisted, forward)
  return id
}
async function invert(_canvasId, eventId) {
  const event = fixture.events.get(eventId)
  if (!event) throw new Error(`Unknown test event ${eventId}`)
  const inverseId = record(event.inverse, event.forward)
  return { status: 200, ok: true, data: { success: true, eventId: inverseId, inverseEvent: event.inverse } }
}
function renderCanvas({ width = 1000, height = 800 } = {}) {
  fixture.persisted = { widgets: fixture.canvas.widgets, sources: fixture.canvas.sources, connectors: fixture.canvas.connectors }
  const rendered = render(<CanvasPage canvasId="duplicate-test" />)
  const viewport = document.querySelector('[data-storyboard-canvas-scroll]')
  Object.defineProperties(viewport, { clientWidth: { value: width }, clientHeight: { value: height } })
  viewport.scrollLeft = 0
  viewport.scrollTop = 0
  return rendered
}
function copySingle({ altKey = false } = {}) {
  fireEvent.click(document.getElementById('source-a'))
  fireEvent.click(within(document.getElementById('source-a')).getByRole('button', { name: 'Duplicate' }), { altKey })
}
const createOps = () => batchOperations.mock.calls.flatMap(([, operations]) => operations).filter((operation) => operation.op === 'create-widget')

beforeEach(() => {
  window.__SB_LOCAL_DEV__ = true
  fixture.canvas = { _route: 'duplicate-test', title: 'Duplicate test', widgets: [widget('source-a', 100, 100)], sources: [], connectors: [], gridSize: 18, autoPlace: true }
  fixture.created = []
  fixture.events = new Map()
  fixture.sequence = 0
  vi.clearAllMocks()
  initCanvasConfig({ autoPlace: { overlap: { 'overlap-nudge-offset': 24 } } })
  // Persistence alone is mocked. Placement, real Canvas/WidgetChrome rendering,
  // action dispatch and grouped undo/redo run through the application code.
  batchOperations.mockImplementation(async (_id, operations) => {
    const results = []
    const refs = {}
    const resolve = (id) => id?.startsWith('$') ? refs[id.slice(1)] : id
    for (const [index, operation] of operations.entries()) {
      if (operation.op === 'move-widget') {
        const previous = fixture.persisted.widgets.find((entry) => entry.id === operation.widgetId)
        const eventId = record({ event: 'widget_moved', widgetId: operation.widgetId, position: operation.position }, { event: 'widget_moved', widgetId: operation.widgetId, position: previous.position })
        results.push({ ...operation, index, eventId })
      } else if (operation.op === 'create-widget') {
        const id = `copied-${fixture.created.length + 1}`
        const created = { id, type: operation.type, props: operation.props, position: operation.position }
        fixture.created.push(created)
        if (operation.ref) refs[operation.ref] = id
        const eventId = record({ event: 'widget_added', widget: created }, { event: 'widget_removed', widgetId: id })
        results.push({ ...operation, index, widget: created, widgetId: id, eventId, eventIds: [eventId] })
      } else if (operation.op === 'create-connector') {
        const connector = { id: `connector-${index}`, type: 'connector', connectorType: operation.connectorType || 'default', start: { widgetId: resolve(operation.startWidgetId), anchor: operation.startAnchor }, end: { widgetId: resolve(operation.endWidgetId), anchor: operation.endAnchor }, meta: {} }
        const eventId = record({ event: 'connector_added', connector }, { event: 'connector_removed', connectorId: connector.id })
        results.push({ ...operation, index, connector, connectorId: connector.id, eventId })
      }
    }
    return { success: true, results, refs }
  })
  updateCanvas.mockResolvedValue({ success: true, eventIds: [] })
  undoEvent.mockImplementation(invert)
  redoEvent.mockImplementation(invert)
})
afterEach(() => { delete window.__SB_LOCAL_DEV__; _resetCanvasConfig(); unregisterWidget('duplicate-selection-test') })

describe('mode-aware duplication through canonical widget controls', () => {
  it('preserves the historical overlapping 40px offset with Autoplace disabled', async () => {
    fixture.canvas.autoPlace = false
    renderCanvas()
    const original = screen.getByTestId('content-source-a')
    copySingle()
    await waitFor(() => expect(document.getElementById('copied-1')).not.toBeNull())
    expect(positionOf('copied-1')).toEqual({ x: 140, y: 140 })
    expect(positionOf('source-a')).toEqual({ x: 100, y: 100 })
    expect(createOps()).toEqual([expect.objectContaining({ position: { x: 140, y: 140 }, resolve: false, near: false })])
    expect(batchOperations.mock.calls[0][1].some((operation) => operation.op === 'move-widget')).toBe(false)
    expect(screen.getByTestId('content-source-a')).toBe(original)
    expect(original).toBeVisible()
    expect(screen.getByTestId('content-copied-1')).toHaveTextContent(original.textContent)
  })

  it('places an enabled duplicate aligned right using the configured gap', async () => {
    renderCanvas()
    copySingle()
    await waitFor(() => expect(positionOf('copied-1')).toEqual({ x: 224, y: 100 }))
    expect(createOps()[0]).toMatchObject({ resolve: false, near: false })
    expect(positionOf('source-a')).toEqual({ x: 100, y: 100 })
    expect(batchOperations).toHaveBeenCalledTimes(1)
  })

  it('uses below when that direction fits the visible viewport', async () => {
    renderCanvas({ width: 260 })
    copySingle()
    await waitFor(() => expect(positionOf('copied-1')).toEqual({ x: 100, y: 204 }))
    expect(positionOf('source-a')).toEqual({ x: 100, y: 100 })
  })

  it('moves a blocking stationary widget with translation motion and undoes/redoes the complete command once', async () => {
    fixture.canvas.widgets.push(widget('blocker', 224, 100))
    renderCanvas({ height: 180 })
    const originalSource = screen.getByTestId('content-source-a')
    const originalPeer = screen.getByTestId('content-blocker')
    copySingle()
    await waitFor(() => expect(positionOf('copied-1')).toEqual({ x: 224, y: 100 }))
    const peerPosition = positionOf('blocker')
    expect(peerPosition).not.toEqual({ x: 224, y: 100 })
    expect(peerPosition.x + 100 + 24 <= 224 || 324 + 24 <= peerPosition.x || peerPosition.y + 80 + 24 <= 100 || 180 + 24 <= peerPosition.y).toBe(true)
    expect(document.getElementById('blocker').closest('article')).toHaveClass('tc-on-translation')
    expect(screen.getByTestId('content-source-a')).toBe(originalSource)
    expect(screen.getByTestId('content-blocker')).toBe(originalPeer)
    expect(originalSource).toBeVisible()
    expect(originalPeer).toBeVisible()
    expect(positionOf('source-a')).toEqual({ x: 100, y: 100 })
    const eventCount = fixture.events.size
    expect(eventCount).toBe(2)
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(document.getElementById('copied-1')).toBeNull())
    expect(positionOf('blocker')).toEqual({ x: 224, y: 100 })
    expect(undoEvent).toHaveBeenCalledTimes(eventCount)
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(positionOf('copied-1')).toEqual({ x: 224, y: 100 }))
    expect(positionOf('blocker')).toEqual(peerPosition)
    expect(redoEvent).toHaveBeenCalledTimes(eventCount)
    expect(positionOf('source-a')).toEqual({ x: 100, y: 100 })
  })

  it('copies a multi-selection as one rigid group and preserves its content and one-step history', async () => {
    registerWidget('duplicate-selection-test', { features: [{ id: 'copy', type: 'action', action: 'copy', label: 'Duplicate selection', icon: 'copy', multiSelection: {} }] })
    fixture.canvas.widgets = [widget('source-a', 100, 100), widget('source-b', 260, 200, 120, 100)]
    fixture.canvas.widgets.forEach((entry) => { entry.type = 'duplicate-selection-test' })
    renderCanvas()
    const contentA = screen.getByTestId('content-source-a')
    const contentB = screen.getByTestId('content-source-b')
    fireEvent.click(document.getElementById('source-a'))
    fireEvent.click(document.getElementById('source-b'), { shiftKey: true })
    fireEvent.click(within(screen.getByRole('group', { name: 'Selection actions' })).getByRole('button', { name: 'Duplicate selection' }))
    await waitFor(() => expect(fixture.created).toHaveLength(2))
    expect(batchOperations).toHaveBeenCalledTimes(1)
    expect(positionOf('copied-1')).toEqual({ x: 404, y: 100 })
    expect(positionOf('copied-2')).toEqual({ x: 564, y: 200 })
    expect(screen.getByTestId('content-source-a')).toBe(contentA)
    expect(screen.getByTestId('content-source-b')).toBe(contentB)
    expect(screen.getByTestId('content-copied-1')).toHaveTextContent(contentA.textContent)
    expect(screen.getByTestId('content-copied-2')).toHaveTextContent(contentB.textContent)
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(document.getElementById('copied-1')).toBeNull())
    expect(document.getElementById('copied-2')).toBeNull()
    expect(undoEvent).toHaveBeenCalledTimes(2)
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(positionOf('copied-2')).toEqual({ x: 564, y: 200 }))
    expect(positionOf('copied-1')).toEqual({ x: 404, y: 100 })
    expect(positionOf('source-a')).toEqual({ x: 100, y: 100 })
    expect(positionOf('source-b')).toEqual({ x: 260, y: 200 })
  })

  it('keeps connector endpoints mapped to the copied widget on Alt duplication', async () => {
    fixture.canvas.autoPlace = false
    fixture.canvas.widgets.push(widget('peer', 500, 100))
    fixture.canvas.connectors = [{ id: 'original-link', start: { widgetId: 'source-a', anchor: 'right' }, end: { widgetId: 'peer', anchor: 'left' } }]
    renderCanvas()
    copySingle({ altKey: true })
    await waitFor(() => expect(document.getElementById('copied-1')).not.toBeNull())
    expect(batchOperations).toHaveBeenCalledTimes(1)
    expect(fixture.persisted.connectors).toContainEqual(expect.objectContaining({ start: { widgetId: 'copied-1', anchor: 'right' }, end: { widgetId: 'peer', anchor: 'left' } }))
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(document.getElementById('copied-1')).toBeNull())
    expect(fixture.persisted.connectors.map((connector) => connector.id)).toEqual(['original-link'])
    expect(undoEvent).toHaveBeenCalledTimes(2)
  })
})
