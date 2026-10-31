import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CanvasPage from './CanvasPage.jsx'
import { batchOperations, undoEvent, redoEvent } from './canvasApi.js'
import { initCanvasConfig, _resetCanvasConfig } from '../../core/stores/canvasConfig.js'

const fixture = vi.hoisted(() => ({ canvas: null, events: null, trackBatch: vi.fn() }))
const originalPointerEvent = window.PointerEvent

vi.mock('./useCanvas.js', () => ({ useCanvas: () => ({ canvas: fixture.canvas, jsxExports: null, loading: false }) }))
vi.mock('./widgets/index.js', () => ({
  getWidgetComponent: () => function TestWidget({ id }) {
    return <div data-testid={`content-${id}`}>Visible {id}</div>
  },
}))
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

const widget = (id, x, y) => ({
  id,
  type: 'sticky-note',
  position: { x, y },
  props: { width: 100, height: 80, color: 'yellow', text: `Content ${id}` },
})

const positionOf = (id) => {
  const node = document.getElementById(id)
  return { x: Number(node.dataset.tcX), y: Number(node.dataset.tcY) }
}

function expectGap(aId, bId) {
  const a = positionOf(aId)
  const b = positionOf(bId)
  expect(
    a.x + 100 + 24 <= b.x || b.x + 100 + 24 <= a.x ||
    a.y + 80 + 24 <= b.y || b.y + 80 + 24 <= a.y,
    `${aId} and ${bId} must retain the configured 24px gap`,
  ).toBe(true)
}

function pointer(type, target, x, y) {
  const eventName = type.replace(/^pointer([a-z])/, (_, letter) => `pointer${letter.toUpperCase()}`)
  fireEvent[eventName](target, { pointerId: 17, button: 0, clientX: x, clientY: y })
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
  const PointerEventPolyfill = class TestPointerEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init)
      Object.defineProperties(this, {
        pointerId: { value: init.pointerId ?? 0 },
        pointerType: { value: init.pointerType ?? 'mouse' },
      })
    }
  }
  vi.stubGlobal('PointerEvent', PointerEventPolyfill)
  window.PointerEvent = PointerEventPolyfill
  fixture.canvas = {
    _route: 'single-drop-priority-test',
    title: 'Single drop priority test',
    autoPlace: true,
    gridSize: 18,
    widgets: [
      widget('moving', 100, 100),
      // Four stationary widgets cover the requested drop point. They also
      // overlap one another, so clearing the drop requires a placement cascade.
      widget('blocker-a', 500, 500),
      widget('blocker-b', 500, 500),
      widget('blocker-c', 500, 500),
      widget('blocker-d', 500, 500),
      widget('unrelated', 1200, 1200),
    ],
    sources: [],
    connectors: [],
  }
  fixture.events = new Map()
  vi.clearAllMocks()
  // Legacy configuration can still opt out of moving stationary widgets.
  // t13 requires Autoplace-on user drops to keep the dragged rectangle fixed.
  initCanvasConfig({ autoPlace: { overlap: {
    'overlap-nudge-trigger': 0,
    'overlap-nudge-offset': 24,
    'overlap-place-stationary': false,
    'overlap-place-multiselection': false,
  } } })
  batchOperations.mockImplementation(async (_id, operations) => ({
    success: true,
    results: operations.map((operation) => {
      const eventId = `move-${operation.widgetId}`
      const previous = fixture.canvas.widgets.find((entry) => entry.id === operation.widgetId)
      fixture.events.set(eventId, {
        forward: { event: 'widget_moved', widgetId: operation.widgetId, position: operation.position },
        inverse: { event: 'widget_moved', widgetId: operation.widgetId, position: previous.position },
      })
      return { ...operation, eventId }
    }),
  }))
  undoEvent.mockImplementation(invert)
  redoEvent.mockImplementation(invert)
})

afterEach(() => {
  delete window.__SB_LOCAL_DEV__
  if (originalPointerEvent) window.PointerEvent = originalPointerEvent
  else delete window.PointerEvent
  vi.unstubAllGlobals()
  _resetCanvasConfig()
})

describe('Autoplace single-widget moving priority', () => {
  it('keeps the dragged widget at its requested center-drop and cascades every intersecting blocker in one undo batch', async () => {
    render(<CanvasPage canvasId="single-drop-priority-test" />)
    expect(screen.getByTestId('content-moving')).toHaveTextContent('Visible moving')
    expect(screen.getByTestId('content-unrelated')).toHaveTextContent('Visible unrelated')
    const originalPositions = Object.fromEntries(['moving', 'blocker-a', 'blocker-b', 'blocker-c', 'blocker-d', 'unrelated'].map((id) => [id, positionOf(id)]))

    // Use the actual Canvas/Draggable path. CanvasPage's delay gate requires
    // both 8px of travel and 150ms before it redispatches to neodrag.
    vi.useFakeTimers()
    try {
      await act(async () => {
        pointer('pointerdown', screen.getByText('Visible moving'), 120, 120)
        pointer('pointermove', document, 130, 130)
        await vi.advanceTimersByTimeAsync(151)
        pointer('pointermove', document, 520, 520)
        expect(document.getElementById('moving').closest('article')).toHaveStyle({ transform: 'translate3d(500px, 500px, 0)' })
        for (const id of ['blocker-a', 'blocker-b', 'blocker-c', 'blocker-d']) {
          expect(positionOf(id)).toEqual(originalPositions[id])
        }
        expect(screen.getByTestId('content-moving')).toBeVisible()
        pointer('pointerup', document, 520, 520)
      })
    } finally {
      vi.useRealTimers()
    }

    expect(screen.getByTestId('content-moving')).toHaveTextContent('Visible moving')
    expect(screen.getByTestId('content-unrelated')).toHaveTextContent('Visible unrelated')
    expect(screen.getByTestId('content-moving')).toBeVisible()
    expect(screen.getByTestId('content-unrelated')).toBeVisible()

    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    expect(positionOf('moving')).toEqual({ x: 500, y: 500 })
    for (const blockerId of ['blocker-a', 'blocker-b', 'blocker-c', 'blocker-d']) {
      expect(positionOf(blockerId)).not.toEqual(originalPositions[blockerId])
      expectGap('moving', blockerId)
    }
    const collisionSet = ['moving', 'blocker-a', 'blocker-b', 'blocker-c', 'blocker-d']
    for (let index = 0; index < collisionSet.length; index++) {
      for (const otherId of collisionSet.slice(index + 1)) expectGap(collisionSet[index], otherId)
    }
    expect(positionOf('unrelated')).toEqual(originalPositions.unrelated)
    expect(batchOperations.mock.calls[0][1].map((operation) => operation.widgetId).sort()).toEqual(collisionSet.slice().sort())
    await waitFor(() => expect(fixture.trackBatch).toHaveBeenCalledTimes(1))
    const finalPositions = Object.fromEntries(collisionSet.map((id) => [id, positionOf(id)]))
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:undo')))
    await waitFor(() => expect(positionOf('moving')).toEqual(originalPositions.moving))
    for (const id of collisionSet.slice(1)) expect(positionOf(id)).toEqual(originalPositions[id])
    act(() => document.dispatchEvent(new CustomEvent('storyboard:canvas:redo')))
    await waitFor(() => expect(positionOf('moving')).toEqual(finalPositions.moving))
    for (const id of collisionSet.slice(1)) expect(positionOf(id)).toEqual(finalPositions[id])
    expect(undoEvent).toHaveBeenCalledTimes(collisionSet.length)
    expect(redoEvent).toHaveBeenCalledTimes(collisionSet.length)
    expect(positionOf('unrelated')).toEqual(originalPositions.unrelated)
  })
})
