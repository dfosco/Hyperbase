import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CanvasPage from './CanvasPage.jsx'

const fixture = vi.hoisted(() => ({ canvas: null }))
let iframeFixture

vi.mock('./useCanvas.js', () => ({
  useCanvas: () => ({ canvas: fixture.canvas, jsxExports: null, loading: false }),
}))

vi.mock('./widgets/ComponentWidget.jsx', () => ({ default: () => <div>JSX content</div> }))
vi.mock('./widgets/index.js', () => ({
  getWidgetComponent: () => ({ id }) => <div>Visible widget {id}</div>,
}))
vi.mock('./canvasApi.js', async () => {
  const actual = await vi.importActual('./canvasApi.js')
  return {
    ...actual,
    batchOperations: vi.fn(async (_id, operations) => ({
      success: true,
      results: operations.map((operation, index) => ({ ...operation, eventId: `lock-${index}` })),
    })),
    updateCanvas: vi.fn(async () => ({ success: true })),
    patchWidget: vi.fn(async () => ({ success: true })),
  }
})

function pointer(target, type, x, y, pointerId = 17) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  fireEvent(target, event)
}

function selectGroup() {
  fireEvent.click(document.getElementById('a'))
  fireEvent.click(document.getElementById('b'), { shiftKey: true })
}

beforeEach(() => {
  window.__SB_LOCAL_DEV__ = true
  iframeFixture = document.createElement('iframe')
  iframeFixture.id = 'group-drag-lock-iframe'
  iframeFixture.style.setProperty('pointer-events', 'auto', 'important')
  document.body.appendChild(iframeFixture)
  fixture.canvas = {
    _route: 'iframe-pointer-lock-test',
    title: 'Iframe pointer lock',
    widgets: [
      { id: 'a', type: 'test-widget', position: { x: 100, y: 100 }, props: { width: 100, height: 80 } },
      { id: 'b', type: 'test-widget', position: { x: 300, y: 180 }, props: { width: 100, height: 80 } },
    ],
    sources: [],
    gridSize: 18,
  }
})

afterEach(() => {
  delete window.__SB_LOCAL_DEV__
  iframeFixture?.remove()
  iframeFixture = null
  document.querySelectorAll('[data-hypercanvas-iframe-pointer-lock]').forEach((style) => style.remove())
})

describe('CanvasPage multi-selection iframe pointer lock', () => {
  it('locks iframe hit testing for the active group drag and releases it on pointerup', async () => {
    render(<CanvasPage canvasId="iframe-pointer-lock-test" />)
    selectGroup()

    act(() => {
      pointer(screen.getByText('Visible widget a'), 'pointerdown', 130, 125)
      pointer(document, 'pointermove', 138, 125)
    })

    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 160)))
    expect(document.querySelector('[data-hypercanvas-iframe-pointer-lock]')).not.toBeNull()
    expect(iframeFixture.style.getPropertyValue('pointer-events')).toBe('none')

    act(() => pointer(document, 'pointermove', 188, 145))
    act(() => pointer(document, 'pointerup', 188, 145))
    expect(document.querySelector('[data-hypercanvas-iframe-pointer-lock]')).toBeNull()
    expect(iframeFixture.style.getPropertyValue('pointer-events')).toBe('auto')
    expect(iframeFixture.style.getPropertyPriority('pointer-events')).toBe('important')
  })

  it('releases the group drag lock on pointercancel and unmount', async () => {
    const view = render(<CanvasPage canvasId="iframe-pointer-lock-test" />)
    selectGroup()

    act(() => {
      pointer(screen.getByText('Visible widget a'), 'pointerdown', 130, 125, 18)
      pointer(document, 'pointermove', 138, 125, 18)
    })
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 160)))
    expect(document.querySelector('[data-hypercanvas-iframe-pointer-lock]')).not.toBeNull()
    expect(iframeFixture.style.getPropertyValue('pointer-events')).toBe('none')
    act(() => pointer(document, 'pointercancel', 138, 125, 18))
    expect(document.querySelector('[data-hypercanvas-iframe-pointer-lock]')).toBeNull()
    expect(iframeFixture.style.getPropertyValue('pointer-events')).toBe('auto')
    expect(iframeFixture.style.getPropertyPriority('pointer-events')).toBe('important')

    act(() => {
      pointer(screen.getByText('Visible widget a'), 'pointerdown', 130, 125, 19)
      pointer(document, 'pointermove', 138, 125, 19)
    })
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 160)))
    expect(document.querySelector('[data-hypercanvas-iframe-pointer-lock]')).not.toBeNull()
    view.unmount()
    expect(document.querySelector('[data-hypercanvas-iframe-pointer-lock]')).toBeNull()
    expect(iframeFixture.style.getPropertyValue('pointer-events')).toBe('auto')
    expect(iframeFixture.style.getPropertyPriority('pointer-events')).toBe('important')
  })
})
