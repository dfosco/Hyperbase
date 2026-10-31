import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CanvasPage from './CanvasPage.jsx'
import { addConnector, batchOperations, updateCanvas } from './canvasApi.js'

const fixture = vi.hoisted(() => ({ canvas: null, jsxExports: null }))

vi.mock('./useCanvas.js', () => ({
  useCanvas: () => ({ canvas: fixture.canvas, jsxExports: fixture.jsxExports, jsxError: null, loading: false }),
}))

vi.mock('./widgets/ComponentWidget.jsx', () => ({ default: () => <div>JSX content</div> }))
vi.mock('./widgets/useFrameSnapshot.js', () => ({
  useFrameSnapshot: () => ({ snapshot: { status: 'missing' }, reload: vi.fn() }),
}))
vi.mock('./widgets/index.js', async () => {
  const actual = await vi.importActual('./widgets/index.js')
  function TestWidget({ id }) {
    return <div data-testid={`content-${id}`}>Visible widget {id}</div>
  }
  return {
    ...actual,
    getWidgetComponent: (type) => type === 'test-widget' ? TestWidget : actual.getWidgetComponent(type),
  }
})

vi.mock('./canvasApi.js', async () => {
  const actual = await vi.importActual('./canvasApi.js')
  return {
    ...actual,
    addConnector: vi.fn(),
    batchOperations: vi.fn(),
    updateCanvas: vi.fn(),
    patchWidget: vi.fn(),
  }
})

const widget = (id, type, x, y, props = {}) => ({
  id,
  type,
  position: { x, y },
  props: { width: 100, height: 80, ...props },
})

function pointer(target, type, x, y, pointerId = 31) {
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

function altPointerClick(target, x, y, pointerId = 41) {
  fireEvent.pointerDown(target, { altKey: true, button: 0, pointerId, clientX: x, clientY: y })
  fireEvent.pointerUp(target, { altKey: true, button: 0, pointerId, clientX: x, clientY: y })
  fireEvent.click(target, { altKey: true })
}

function positionOf(id) {
  const node = document.getElementById(id)
  return { x: Number(node.dataset.tcX), y: Number(node.dataset.tcY) }
}

beforeEach(() => {
  window.__SB_LOCAL_DEV__ = true
  fixture.jsxExports = null
  fixture.canvas = {
    _route: 'gated-iframe-group-drag-test',
    title: 'Gated iframe group drag',
    widgets: [
      widget('frame', 'site-frame', 100, 100, { siteId: 'docs', title: 'Docs', width: 320, height: 220 }),
      widget('member', 'test-widget', 500, 300),
      widget('source', 'test-widget', 900, 100),
    ],
    sources: [],
    connectors: [],
    gridSize: 18,
    autoPlace: false,
  }
  vi.clearAllMocks()
  batchOperations.mockImplementation(async (_id, operations) => ({
    success: true,
    results: operations.map((operation, index) => ({ ...operation, eventId: `iframe-group-${index}` })),
  }))
  updateCanvas.mockResolvedValue({ success: true })
  addConnector.mockResolvedValue({
    success: true,
    connector: {
      id: 'connector-frame',
      start: { widgetId: 'source', anchor: 'right' },
      end: { widgetId: 'frame', anchor: 'left' },
    },
  })
})

afterEach(() => {
  delete window.__SB_LOCAL_DEV__
})

describe('CanvasPage iframe widget interactions', () => {
  it('drags the entire selection from the real Site Frame interaction gate body', async () => {
    const { container } = render(<CanvasPage canvasId="gated-iframe-group-drag-test" />)
    fireEvent.click(document.getElementById('frame'))
    fireEvent.click(document.getElementById('member'), { shiftKey: true })

    const frame = document.querySelector('#frame [data-testid="site-frame"]')
    const gate = screen.getByRole('button', { name: 'Click to interact' })
    expect(frame).toBeInTheDocument()
    expect(frame.querySelector('header')).toBeInTheDocument()
    expect(frame.querySelector('iframe')).toBeNull()
    expect(gate).toBeInTheDocument()
    expect(gate.closest('[data-widget-type="site-frame"]')).toBeInTheDocument()

    const before = { frame: positionOf('frame'), member: positionOf('member'), source: positionOf('source') }
    act(() => {
      pointer(gate, 'pointerdown', 130, 125)
      pointer(document, 'pointermove', 138, 125)
    })
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 160)))
    act(() => pointer(document, 'pointermove', 178, 155))

    expect(document.documentElement).toHaveAttribute('data-hypercanvas-widget-drag-cursor')
    expect(positionOf('frame')).toEqual({ x: before.frame.x + 48, y: before.frame.y + 30 })
    expect(positionOf('member')).toEqual({ x: before.member.x + 48, y: before.member.y + 30 })
    expect(positionOf('source')).toEqual(before.source)
    expect(document.getElementById('frame')).toHaveAttribute('data-widget-raised')
    expect(document.getElementById('member')).toHaveAttribute('data-widget-raised')
    expect(document.getElementById('source')).not.toHaveAttribute('data-widget-raised')
    expect(container.querySelector('[aria-label="Selected widgets"]')).toBeInTheDocument()
    expect(frame).toBeVisible()
    expect(frame.querySelector('header')).toBeVisible()

    await act(async () => {
      pointer(document, 'pointerup', 178, 155)
      await Promise.resolve()
      await Promise.resolve()
    })
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
    expect(document.documentElement).not.toHaveAttribute('data-hypercanvas-widget-drag-cursor')
    expect(document.getElementById('frame')).toHaveAttribute('data-widget-raised')
    expect(document.getElementById('member')).toHaveAttribute('data-widget-raised')
  })

  it('drags a selected Prototype Frame group from its real iframe interaction overlay', async () => {
    fixture.canvas.widgets = [
      widget('frame', 'prototype', 100, 100, { src: '/Demo', label: 'Demo', width: 320, height: 220 }),
      widget('member', 'test-widget', 500, 300),
      widget('unrelated', 'test-widget', 1000, 800),
    ]
    render(<CanvasPage canvasId="gated-iframe-group-drag-test" />)
    fireEvent.click(document.getElementById('frame'))
    fireEvent.click(document.getElementById('member'), { shiftKey: true })

    const overlay = screen.getByRole('button', { name: 'Click to interact with prototype' })
    expect(overlay).toHaveAttribute('data-canvas-interact-gate', 'true')
    const before = { frame: positionOf('frame'), member: positionOf('member'), unrelated: positionOf('unrelated') }
    act(() => {
      pointer(overlay, 'pointerdown', 130, 125)
      pointer(document, 'pointermove', 138, 125)
    })
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 160)))
    act(() => pointer(document, 'pointermove', 178, 155))

    expect(positionOf('frame')).toEqual({ x: before.frame.x + 48, y: before.frame.y + 30 })
    expect(positionOf('member')).toEqual({ x: before.member.x + 48, y: before.member.y + 30 })
    expect(positionOf('unrelated')).toEqual(before.unrelated)
    expect(document.getElementById('frame')).toHaveAttribute('data-widget-raised')
    expect(document.getElementById('member')).toHaveAttribute('data-widget-raised')
    expect(document.querySelector('[data-widget-interacting="true"]')).toBeNull()

    await act(async () => {
      pointer(document, 'pointerup', 178, 155)
      await Promise.resolve()
      await Promise.resolve()
    })
    await waitFor(() => expect(batchOperations).toHaveBeenCalledTimes(1))
  })

  it('drags a selected Component frame group from its actual body content', async () => {
    fixture.canvas.widgets = [widget('member', 'test-widget', 500, 300), widget('unrelated', 'test-widget', 1000, 800)]
    fixture.canvas.sources = [{ export: 'Preview', position: { x: 100, y: 100 }, width: 320, height: 220 }]
    fixture.jsxExports = { Preview: () => <div>Component frame content</div> }
    render(<CanvasPage canvasId="gated-iframe-group-drag-test" />)
    fireEvent.click(document.getElementById('jsx-Preview'))
    fireEvent.click(document.getElementById('member'), { shiftKey: true })

    const body = screen.getByText('JSX content')
    const before = { frame: positionOf('jsx-Preview'), member: positionOf('member'), unrelated: positionOf('unrelated') }
    act(() => {
      pointer(body, 'pointerdown', 130, 125)
      pointer(document, 'pointermove', 138, 125)
    })
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 160)))
    act(() => pointer(document, 'pointermove', 178, 155))

    expect(positionOf('jsx-Preview')).toEqual({ x: before.frame.x + 48, y: before.frame.y + 30 })
    expect(positionOf('member')).toEqual({ x: before.member.x + 48, y: before.member.y + 30 })
    expect(positionOf('unrelated')).toEqual(before.unrelated)
    expect(body).toBeVisible()
    expect(document.getElementById('jsx-Preview')).toHaveAttribute('data-widget-raised')
    expect(document.getElementById('member')).toHaveAttribute('data-widget-raised')

    await act(async () => {
      pointer(document, 'pointerup', 178, 155)
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  it('keeps an ordinary selected widget as the connector source on Alt-click of the real Prototype Frame body', async () => {
    fixture.canvas.widgets = [
      widget('source', 'test-widget', 100, 100),
      widget('frame', 'prototype', 360, 100, { src: '/Demo', label: 'Demo', width: 320, height: 220 }),
    ]
    render(<CanvasPage canvasId="gated-iframe-group-drag-test" />)
    fireEvent.click(document.getElementById('source'))

    const frame = document.getElementById('frame')
    const overlay = screen.getByRole('button', { name: 'Click to interact with prototype' })
    expect(frame.querySelector('[data-testid="site-frame"]')).toBeNull()
    expect(overlay).toBeInTheDocument()
    expect(overlay).toBeInTheDocument()

    altPointerClick(overlay, 390, 130)

    await waitFor(() => expect(addConnector).toHaveBeenCalledTimes(1))
    expect(addConnector).toHaveBeenCalledWith('gated-iframe-group-drag-test', expect.objectContaining({
      startWidgetId: 'source',
      startAnchor: 'right',
      endWidgetId: 'frame',
      endAnchor: 'left',
    }))
    expect(frame).not.toHaveAttribute('data-widget-raised')
    expect(document.getElementById('source')).toHaveAttribute('data-widget-raised')
    expect(document.querySelector('[data-widget-interacting="true"]')).toBeNull()
  })

  it('keeps the existing selection as connector source on Alt-pointer click of the Site Frame interaction gate', async () => {
    fixture.canvas.widgets = [
      widget('source', 'test-widget', 100, 100),
      widget('frame', 'site-frame', 360, 100, { siteId: 'docs', title: 'Docs', width: 320, height: 220 }),
    ]
    addConnector.mockResolvedValue({
      success: true,
      connector: {
        id: 'connector-site-frame',
        start: { widgetId: 'source', anchor: 'right' },
        end: { widgetId: 'frame', anchor: 'left' },
      },
    })
    render(<CanvasPage canvasId="gated-iframe-group-drag-test" />)
    fireEvent.click(document.getElementById('source'))

    const frame = document.getElementById('frame')
    const gate = screen.getByRole('button', { name: 'Click to interact' })
    expect(gate.closest('[data-canvas-interact-gate]')).toBe(gate)
    altPointerClick(gate, 390, 130, 19)

    await waitFor(() => expect(addConnector).toHaveBeenCalledWith('gated-iframe-group-drag-test', expect.objectContaining({
      startWidgetId: 'source',
      startAnchor: 'right',
      endWidgetId: 'frame',
      endAnchor: 'left',
    })))
    expect(frame).not.toHaveAttribute('data-widget-raised')
    expect(document.getElementById('source')).toHaveAttribute('data-widget-raised')
    expect(document.querySelector('[data-widget-interacting="true"]')).toBeNull()
  })

  it('leaves an ordinary Site Frame gate click available for iframe interaction', async () => {
    fixture.canvas.widgets = [
      widget('source', 'test-widget', 100, 100),
      widget('frame', 'site-frame', 360, 100, { siteId: 'docs', title: 'Docs', width: 320, height: 220 }),
    ]
    render(<CanvasPage canvasId="gated-iframe-group-drag-test" />)
    fireEvent.click(document.getElementById('source'))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Click to interact' }))
      await Promise.resolve()
    })

    expect(addConnector).not.toHaveBeenCalled()
    expect(document.getElementById('frame')).toHaveAttribute('data-widget-raised')
    expect(document.querySelector('[data-widget-interacting="true"]')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Click to interact' })).toBeNull()
  })

  it('connects the existing selection to a component frame without replacing it', async () => {
    fixture.canvas.widgets = [widget('source', 'test-widget', 100, 100)]
    fixture.canvas.sources = [{ export: 'Preview', position: { x: 360, y: 100 }, width: 320, height: 220 }]
    fixture.jsxExports = { Preview: () => <div data-testid="component-frame-body">Preview frame body</div> }
    addConnector.mockResolvedValue({
      success: true,
      connector: {
        id: 'connector-component-frame',
        start: { widgetId: 'source', anchor: 'right' },
        end: { widgetId: 'jsx-Preview', anchor: 'left' },
      },
    })
    render(<CanvasPage canvasId="gated-iframe-group-drag-test" />)
    fireEvent.click(document.getElementById('source'))

    const frameBody = screen.getByText('JSX content')
    altPointerClick(frameBody, 390, 130)

    await waitFor(() => expect(addConnector).toHaveBeenCalledWith('gated-iframe-group-drag-test', expect.objectContaining({
      startWidgetId: 'source',
      startAnchor: 'right',
      endWidgetId: 'jsx-Preview',
      endAnchor: 'left',
    })))
    expect(document.getElementById('jsx-Preview')).not.toHaveAttribute('data-widget-raised')
    expect(document.getElementById('source')).toHaveAttribute('data-widget-raised')
  })

  it('keeps the established Alt-click behavior for an ordinary widget target', async () => {
    fixture.canvas.widgets = [
      widget('source', 'test-widget', 100, 100),
      widget('target', 'test-widget', 360, 100),
    ]
    render(<CanvasPage canvasId="gated-iframe-group-drag-test" />)
    fireEvent.click(document.getElementById('source'))
    fireEvent.click(screen.getByTestId('content-target'), { altKey: true })

    await waitFor(() => expect(addConnector).toHaveBeenCalledWith('gated-iframe-group-drag-test', expect.objectContaining({
      startWidgetId: 'source',
      startAnchor: 'right',
      endWidgetId: 'target',
      endAnchor: 'left',
    })))
    expect(document.getElementById('source')).toHaveAttribute('data-widget-raised')
    expect(document.getElementById('target')).not.toHaveAttribute('data-widget-raised')
  })
})
