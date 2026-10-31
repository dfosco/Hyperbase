import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CanvasPage from './CanvasPage.jsx'
import { batchOperations, updateCanvas } from './canvasApi.js'

const fixture = vi.hoisted(() => ({ canvas: null, trackBatch: vi.fn() }))

vi.mock('./useCanvas.js', () => ({
  useCanvas: () => ({ canvas: fixture.canvas, jsxExports: null, loading: false }),
}))

vi.mock('./widgets/ComponentWidget.jsx', () => ({ default: () => <div>JSX content</div> }))
vi.mock('./widgets/index.js', async () => {
  const actual = await vi.importActual('./widgets/index.js')
  function TestWidget({ id }) {
    return (
      <div data-testid={`content-${id}`}>
        <span>{`Visible widget ${id}`}</span>
        <textarea aria-label={`Edit ${id}`} data-testid={`editor-${id}`} defaultValue={`Text ${id}`} />
      </div>
    )
  }
  return {
    getWidgetComponent: (type) => type === 'sticky-note' ? actual.getWidgetComponent(type) : TestWidget,
  }
})

vi.mock('./canvasApi.js', async () => {
  const actual = await vi.importActual('./canvasApi.js')
  return {
    ...actual,
    batchOperations: vi.fn(),
    updateCanvas: vi.fn(),
    patchWidget: vi.fn(),
  }
})

vi.mock('./useUndoRedo.js', async () => {
  const actual = await vi.importActual('./useUndoRedo.js')
  return {
    default: () => {
      const history = actual.default()
      return {
        ...history,
        trackBatch: (ids) => {
          fixture.trackBatch(ids)
          history.trackBatch(ids)
        },
      }
    },
  }
})

const widget = (id, x, y, width = 100, height = 80) => ({
  id,
  type: 'test-widget',
  position: { x, y },
  props: { width, height, color: 'yellow' },
})

function pointer(target, type, x, y, pointerId = 11) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  fireEvent(target, event)
}

function selectGroup() {
  fireEvent.click(document.getElementById('a'))
  fireEvent.click(document.getElementById('b'), { shiftKey: true })
}

function positionOf(id) {
  const node = document.getElementById(id)
  return { x: Number(node.dataset.tcX), y: Number(node.dataset.tcY) }
}

beforeEach(() => {
  window.__SB_LOCAL_DEV__ = true
  fixture.canvas = {
    _route: 'group-interior-drag-test',
    title: 'Group interior drag',
    widgets: [widget('a', 100, 100), widget('b', 300, 180), widget('blocker', 500, 100), widget('other', 800, 100)],
    sources: [],
    gridSize: 18,
    autoPlace: true,
  }
  vi.clearAllMocks()
  batchOperations.mockImplementation(async (_id, operations) => ({
    success: true,
    results: operations.map((operation, index) => ({ ...operation, eventId: `group-move-${index}` })),
  }))
  updateCanvas.mockResolvedValue({ success: true })
})

afterEach(() => {
  delete window.__SB_LOCAL_DEV__
})

describe('multi-selection interior drag', () => {
  it('drags from widget content, keeps the original members and offsets, and displaces a collision blocker on drop', async () => {
    const { container } = render(<CanvasPage canvasId="group-interior-drag-test" />)
    selectGroup()

    const contentA = screen.getByTestId('content-a')
    const contentB = screen.getByTestId('content-b')
    const contentOther = screen.getByTestId('content-other')
    const aStart = positionOf('a')
    const bStart = positionOf('b')
    const blockerStart = positionOf('blocker')
    const otherStart = positionOf('other')

    // Start on the actual content surface, away from the shared outline handle.
    act(() => {
      pointer(screen.getByText('Visible widget a'), 'pointerdown', 130, 125)
      pointer(document, 'pointermove', 138, 125)
    })

    // Match Draggable's 150ms hold and 8px travel gate before moving the group.
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 160)))
    act(() => pointer(document, 'pointermove', 530, 125))

    expect(positionOf('a')).toEqual({ x: aStart.x + 400, y: aStart.y })
    expect(positionOf('b')).toEqual({ x: bStart.x + 400, y: bStart.y })
    expect(positionOf('blocker')).toEqual(blockerStart)
    expect(positionOf('other')).toEqual(otherStart)
    expect(screen.getByTestId('content-a')).toBe(contentA)
    expect(screen.getByTestId('content-b')).toBe(contentB)
    expect(screen.getByTestId('content-other')).toBe(contentOther)
    expect(contentA).toBeVisible()
    expect(contentB).toBeVisible()
    expect(contentOther).toBeVisible()
    expect(document.getElementById('a').closest('article')).toHaveStyle({ transform: 'translate3d(500px, 100px, 0)' })
    expect(document.getElementById('b').closest('article')).toHaveStyle({ transform: 'translate3d(700px, 180px, 0)' })

    await act(async () => {
      pointer(document, 'pointerup', 530, 125)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(positionOf('a')).toEqual({ x: aStart.x + 400, y: aStart.y })
    expect(positionOf('b')).toEqual({ x: bStart.x + 400, y: bStart.y })
    expect(positionOf('blocker')).not.toEqual(blockerStart)
    expect(positionOf('other')).toEqual(otherStart)
    expect(document.getElementById('a')).toHaveAttribute('data-widget-raised')
    expect(document.getElementById('b')).toHaveAttribute('data-widget-raised')
    expect(document.getElementById('blocker')).not.toHaveAttribute('data-widget-raised')
    expect([...container.querySelectorAll('[data-widget-raised]')].map((node) => node.id)).toEqual(['a', 'b'])
    expect(container.querySelector('[aria-label="Selected widgets"]')).toBeInTheDocument()
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    expect(fixture.trackBatch).toHaveBeenCalledWith(expect.arrayContaining([
      'group-move-0', 'group-move-1', 'group-move-2',
    ]))
  })

  it('drags the whole group from an actual inactive StickyNote body when the group handle is above the viewport', async () => {
    fixture.canvas.widgets = [
      { ...widget('a', 120, 100), type: 'sticky-note', props: { width: 100, height: 80, color: 'yellow', text: 'Top note' } },
      { ...widget('b', 320, 1000), type: 'sticky-note', props: { width: 100, height: 80, color: 'blue', text: 'Second note body' } },
      widget('other', 800, 100),
    ]
    const { container } = render(<CanvasPage canvasId="group-interior-drag-test" />)
    selectGroup()

    const scroll = container.querySelector('[data-storyboard-canvas-scroll]')
    scroll.scrollTop = 900
    const outline = screen.getByRole('region', { name: 'Selected widgets' })
    expect(Number.parseFloat(outline.style.top)).toBeLessThan(scroll.scrollTop)
    const body = screen.getByText('Second note body').closest('[data-canvas-group-drag-preview]')
    expect(body).toBeInTheDocument()
    const starts = { a: positionOf('a'), b: positionOf('b') }

    act(() => {
      pointer(body, 'pointerdown', 340, 1020, 23)
      pointer(document, 'pointermove', 348, 1020, 23)
    })
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 160)))
    act(() => pointer(document, 'pointermove', 388, 1050, 23))

    expect(positionOf('a')).toEqual({ x: starts.a.x + 48, y: starts.a.y + 30 })
    expect(positionOf('b')).toEqual({ x: starts.b.x + 48, y: starts.b.y + 30 })
    expect(document.getElementById('a')).toHaveAttribute('data-widget-raised')
    expect(document.getElementById('b')).toHaveAttribute('data-widget-raised')
    expect(document.getElementById('other')).not.toHaveAttribute('data-widget-raised')
    pointer(document, 'pointerup', 388, 1050, 23)
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
  })

  it('does not start a group drag from an action button', () => {
    render(<CanvasPage canvasId="group-interior-drag-test" />)
    selectGroup()
    const before = ['a', 'b', 'blocker', 'other'].map((id) => positionOf(id))
    const action = screen.getByRole('button', { name: 'Align to grid' })

    pointer(action, 'pointerdown', 0, 0)
    pointer(document, 'pointermove', 90, 75)
    pointer(document, 'pointerup', 90, 75)

    expect(['a', 'b', 'blocker', 'other'].map((id) => positionOf(id))).toEqual(before)
    expect(batchOperations).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Selected widgets' })).toBeInTheDocument()
  })

  it('keeps active text editing and input selection out of group dragging', () => {
    render(<CanvasPage canvasId="group-interior-drag-test" />)
    selectGroup()
    const before = ['a', 'b', 'blocker', 'other'].map((id) => positionOf(id))
    const editor = screen.getByRole('textbox', { name: 'Edit a' })
    editor.focus()
    editor.setSelectionRange(0, 4)

    act(() => {
      pointer(editor, 'pointerdown', 125, 125)
      pointer(document, 'pointermove', 225, 200)
      pointer(document, 'pointerup', 225, 200)
    })

    expect(document.activeElement).toBe(editor)
    expect(editor.selectionStart).toBe(0)
    expect(editor.selectionEnd).toBe(4)
    expect(['a', 'b', 'blocker', 'other'].map((id) => positionOf(id))).toEqual(before)
    expect(batchOperations).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Selected widgets' })).toBeInTheDocument()
  })
})
