import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import CanvasPage from './CanvasPage.jsx'
import { batchOperations, undoEvent, redoEvent } from './canvasApi.js'
import { initCanvasConfig, _resetCanvasConfig } from '../../core/stores/canvasConfig.js'

const fixture = vi.hoisted(() => ({ canvas: null, trackBatch: vi.fn(), events: null }))
vi.mock('./useCanvas.js', () => ({ useCanvas: () => ({ canvas: fixture.canvas, jsxExports: null, loading: false }) }))
vi.mock('./widgets/index.js', () => {
  function Content({ id, props }) { return <div data-testid={`content-${id}`}>{props.text}</div> }
  return { getWidgetComponent: () => Content }
})
vi.mock('./canvasApi.js', async () => {
  const actual = await vi.importActual('./canvasApi.js')
  return { ...actual, batchOperations: vi.fn(), undoEvent: vi.fn(), redoEvent: vi.fn() }
})
vi.mock('./useUndoRedo.js', async () => {
  const actual = await vi.importActual('./useUndoRedo.js')
  return { default: () => {
    const history = actual.default()
    return { ...history, trackBatch: (ids) => { fixture.trackBatch(ids); history.trackBatch(ids) } }
  } }
})

const widget = (id, x, y) => ({ id, type: 'sticky-note', position: { x, y }, props: { width: 100, height: 80, color: 'yellow', text: `Content ${id}` } })
const positionOf = (id) => {
  const node = document.getElementById(id)
  return { x: Number(node.dataset.tcX), y: Number(node.dataset.tcY) }
}
const selectedIds = () => fixture.canvas.widgets.filter((entry) => document.getElementById(entry.id)?.querySelector('[data-widget-selected="true"]')).map((entry) => entry.id).sort()
function pointer(target, type, x, y) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
  Object.defineProperty(event, 'pointerId', { value: 7 })
  fireEvent(target, event)
}
function selectGroup() {
  fireEvent.click(document.getElementById('source-a'))
  fireEvent.click(document.getElementById('source-b'), { shiftKey: true })
  expect(selectedIds()).toEqual(['source-a', 'source-b'])
}
function dragGroup() {
  pointer(screen.getByRole('button', { name: 'Move selected widgets' }), 'pointerdown', 0, 0)
  pointer(document, 'pointermove', 300, 0)
}
function expectGap(aId, bId) {
  const a = positionOf(aId)
  const b = positionOf(bId)
  expect(a.x + 100 + 24 <= b.x || b.x + 100 + 24 <= a.x || a.y + 80 + 24 <= b.y || b.y + 80 + 24 <= a.y,
    `${aId} and ${bId} must retain the configured 24px gap`).toBe(true)
}
async function invert(_canvasId, eventId) {
  const event = fixture.events.get(eventId)
  if (!event) throw new Error(`Unknown test event ${eventId}`)
  const inverseId = `inverse-${eventId}`
  fixture.events.set(inverseId, { forward: event.inverse, inverse: event.forward })
  return { status: 200, ok: true, data: { eventId: inverseId, inverseEvent: event.inverse } }
}

beforeEach(() => {
  window.__SB_LOCAL_DEV__ = true
  fixture.canvas = { _route: 'group-drop-test', title: 'Group drop test', autoPlace: true, gridSize: 18, widgets: [widget('source-a', 100, 100), widget('source-b', 260, 100), widget('blocker', 400, 100), widget('unrelated', 1200, 1200)], sources: [], connectors: [] }
  fixture.events = new Map()
  vi.clearAllMocks()
  // User drops have a moving-first placement contract even when legacy
  // stationary and multiselection options are both disabled.
  initCanvasConfig({ autoPlace: { align: { 'top-edge-nudge-offset': 0, 'left-edge-nudge-offset': 0 }, overlap: { 'overlap-nudge-trigger': 0, 'overlap-nudge-offset': 24, 'overlap-place-stationary': false, 'overlap-place-multiselection': false } } })
  batchOperations.mockImplementation(async (_id, operations) => ({ success: true, results: operations.map((operation) => {
    const eventId = `${operation.op === 'update-widget' ? 'color' : 'move'}-${operation.widgetId}`
    const previous = fixture.canvas.widgets.find((entry) => entry.id === operation.widgetId)
    fixture.events.set(eventId, operation.op === 'update-widget'
      ? { forward: { event: 'widget_updated', widgetId: operation.widgetId, props: operation.props }, inverse: { event: 'widget_updated', widgetId: operation.widgetId, props: { color: 'yellow' } } }
      : { forward: { event: 'widget_moved', widgetId: operation.widgetId, position: operation.position }, inverse: { event: 'widget_moved', widgetId: operation.widgetId, position: previous.position } })
    return { ...operation, eventId }
  }) }))
  undoEvent.mockImplementation(invert)
  redoEvent.mockImplementation(invert)
})
afterEach(() => { delete window.__SB_LOCAL_DEV__; _resetCanvasConfig() })

describe('Autoplace through the actual shared group handle', () => {
  it('displaces a blocker on release without changing membership, then undoes/redoes all moves once', async () => {
    render(<CanvasPage canvasId="group-drop-test" />)
    selectGroup()
    const contentA = screen.getByTestId('content-source-a')
    const contentB = screen.getByTestId('content-source-b')
    dragGroup()
    expect(positionOf('source-a')).toEqual({ x: 400, y: 100 })
    expect(positionOf('source-b')).toEqual({ x: 560, y: 100 })
    expect(selectedIds()).toEqual(['source-a', 'source-b'])
    expect(screen.getByTestId('content-source-a')).toBe(contentA)
    expect(screen.getByTestId('content-source-b')).toBe(contentB)
    expect(contentA).toBeVisible()
    expect(contentB).toBeVisible()
    expect(batchOperations).not.toHaveBeenCalled()
    pointer(document, 'pointerup', 300, 0)
    // Browsers may synthesize a click at the release target after pointerup.
    // That collision target must remain an obstacle, never a new selection.
    fireEvent.click(document.getElementById('blocker'))
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    expect(positionOf('blocker')).not.toEqual({ x: 400, y: 100 })
    expectGap('source-a', 'blocker')
    expectGap('source-b', 'blocker')
    expect(positionOf('source-a')).toEqual({ x: 400, y: 100 })
    expect(positionOf('source-b')).toEqual({ x: 560, y: 100 })
    expect(positionOf('unrelated')).toEqual({ x: 1200, y: 1200 })
    expect(selectedIds()).toEqual(['source-a', 'source-b'])
    expect(document.getElementById('blocker').closest('article')).toHaveClass('tc-on-translation')
    await waitFor(() => expect(fixture.trackBatch).toHaveBeenCalledWith(['move-source-a', 'move-source-b', 'move-blocker']))
    expect(fixture.trackBatch).toHaveBeenCalledTimes(1)
    const blockerAfterDrop = positionOf('blocker')
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(positionOf('source-a')).toEqual({ x: 100, y: 100 }))
    expect(positionOf('source-b')).toEqual({ x: 260, y: 100 })
    expect(positionOf('blocker')).toEqual({ x: 400, y: 100 })
    expect(undoEvent).toHaveBeenCalledTimes(3)
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(positionOf('blocker')).toEqual(blockerAfterDrop))
    expect(positionOf('source-a')).toEqual({ x: 400, y: 100 })
    expect(positionOf('source-b')).toEqual({ x: 560, y: 100 })
    expect(selectedIds()).toEqual(['source-a', 'source-b'])
    expect(redoEvent).toHaveBeenCalledTimes(3)
    const actions = screen.getByRole('group', { name: 'Selection actions' })
    fireEvent.click(within(actions).getByRole('button', { name: 'Change color' }))
    fireEvent.click(within(actions).getByRole('button', { name: 'Set color to pink' }))
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(2))
    expect(batchOperations.mock.calls[1][1]).toEqual([
      { op: 'update-widget', widgetId: 'source-a', props: { color: 'pink' } },
      { op: 'update-widget', widgetId: 'source-b', props: { color: 'pink' } },
    ])
    await waitFor(() => expect(fixture.trackBatch).toHaveBeenCalledTimes(2))
    expect(fixture.trackBatch).toHaveBeenLastCalledWith(['color-source-a', 'color-source-b'])
  })

  it('clears multiple blockers and adjacent cascade geometry while preserving the dragged group and unrelated widget', async () => {
    fixture.canvas.widgets.splice(3, 0, widget('blocker-b', 560, 100), widget('cascade-peer', 400, 204))
    render(<CanvasPage canvasId="group-drop-test" />)
    selectGroup()
    dragGroup()
    pointer(document, 'pointerup', 300, 0)
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    expect(positionOf('blocker')).not.toEqual({ x: 400, y: 100 })
    expect(positionOf('blocker-b')).not.toEqual({ x: 560, y: 100 })
    const relevant = ['source-a', 'source-b', 'blocker', 'blocker-b', 'cascade-peer']
    for (let index = 0; index < relevant.length; index++) {
      for (const other of relevant.slice(index + 1)) expectGap(relevant[index], other)
    }
    expect(positionOf('source-a')).toEqual({ x: 400, y: 100 })
    expect(positionOf('source-b')).toEqual({ x: 560, y: 100 })
    expect(positionOf('unrelated')).toEqual({ x: 1200, y: 1200 })
    expect(selectedIds()).toEqual(['source-a', 'source-b'])
    expect(batchOperations.mock.calls[0][1].some((operation) => operation.widgetId === 'unrelated')).toBe(false)
  })

  it('preserves off-mode group dragging without stationary displacement or changed membership', async () => {
    fixture.canvas.autoPlace = false
    render(<CanvasPage canvasId="group-drop-test" />)
    selectGroup()
    dragGroup()
    pointer(document, 'pointerup', 300, 0)
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    expect(positionOf('source-a')).toEqual({ x: 400, y: 100 })
    expect(positionOf('source-b')).toEqual({ x: 560, y: 100 })
    expect(positionOf('blocker')).toEqual({ x: 400, y: 100 })
    expect(positionOf('unrelated')).toEqual({ x: 1200, y: 1200 })
    expect(selectedIds()).toEqual(['source-a', 'source-b'])
    expect(batchOperations.mock.calls[0][1].map((operation) => operation.widgetId)).toEqual(['source-a', 'source-b'])
    await waitFor(() => expect(fixture.trackBatch).toHaveBeenCalledWith(['move-source-a', 'move-source-b']))
  })
})
