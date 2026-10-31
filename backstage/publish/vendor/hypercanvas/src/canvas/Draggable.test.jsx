import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Draggable from './Draggable.jsx'

const { saveDrag } = vi.hoisted(() => ({ saveDrag: vi.fn() }))

vi.mock('./utils.js', () => ({ saveDrag }))

describe('Draggable callback freshness', () => {
  it('uses the latest drop resolver and drag-end callback from the real drag library', async () => {
    const oldDragEnd = vi.fn()
    const resolveDropPosition = vi.fn((id, position) => ({ x: position.x + 7, y: position.y + 9 }))
    const onDragEnd = vi.fn()
    const { rerender, getByRole } = render(
      <Draggable dragId="widget-1" initialPosition={{ x: 0, y: 0 }} onDragEnd={oldDragEnd}>
        <span>Widget</span>
      </Draggable>,
    )

    rerender(
      <Draggable
        dragId="widget-1"
        initialPosition={{ x: 0, y: 0 }}
        resolveDropPosition={resolveDropPosition}
        onDragEnd={onDragEnd}
      >
        <span>Widget</span>
      </Draggable>,
    )

    const article = getByRole('article')
    await act(async () => {
      fireEvent.pointerDown(article, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
      fireEvent.pointerMove(document, { pointerId: 1, clientX: 110, clientY: 70 })
      fireEvent.pointerUp(document, { pointerId: 1, clientX: 110, clientY: 70 })
    })

    expect(resolveDropPosition).toHaveBeenCalledWith('widget-1', expect.any(Object))
    expect(onDragEnd).toHaveBeenCalledWith('widget-1', expect.objectContaining({ x: 107, y: 69 }))
    expect(oldDragEnd).not.toHaveBeenCalled()
    expect(saveDrag).toHaveBeenCalledWith('widget-1', 107, 69)
  })

  it('locks iframe hit testing for the active drag and releases on pointerup', async () => {
    const { getByRole } = render(
      <>
        <iframe title="Preview" />
        <Draggable dragId="widget-1" initialPosition={{ x: 0, y: 0 }}>
          <span>Widget</span>
        </Draggable>
      </>,
    )

    const article = getByRole('article')
    await act(async () => {
      fireEvent.pointerDown(article, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
      fireEvent.pointerMove(document, { pointerId: 1, clientX: 40, clientY: 35 })
    })

    expect(document.querySelector('style[data-hypercanvas-iframe-pointer-lock]')).not.toBeNull()
    expect(document.querySelector('style[data-hypercanvas-widget-drag-cursor-style]')).not.toBeNull()
    expect(document.documentElement.getAttribute('data-hypercanvas-widget-drag-cursor')).toBe('active')
    expect(getComputedStyle(document.querySelector('iframe')).pointerEvents).toBe('none')

    await act(async () => {
      fireEvent.pointerUp(document, { pointerId: 1, clientX: 40, clientY: 35 })
    })

    expect(document.querySelector('style[data-hypercanvas-iframe-pointer-lock]')).toBeNull()
    expect(document.querySelector('style[data-hypercanvas-widget-drag-cursor-style]')).toBeNull()
    expect(document.documentElement.hasAttribute('data-hypercanvas-widget-drag-cursor')).toBe(false)
  })

  it.each(['pointercancel', 'blur', 'unmount'])('releases the drag lock on %s', async (interruption) => {
    const { getByRole, unmount } = render(
      <Draggable dragId="widget-1" initialPosition={{ x: 0, y: 0 }}>
        <span>Widget</span>
      </Draggable>,
    )

    await act(async () => {
      fireEvent.pointerDown(getByRole('article'), { pointerId: 2, button: 0, clientX: 10, clientY: 10 })
      fireEvent.pointerMove(document, { pointerId: 2, clientX: 35, clientY: 30 })
    })
    expect(document.querySelector('style[data-hypercanvas-iframe-pointer-lock]')).not.toBeNull()
    expect(document.querySelector('style[data-hypercanvas-widget-drag-cursor-style]')).not.toBeNull()

    await act(async () => {
      if (interruption === 'unmount') unmount()
      else if (interruption === 'blur') fireEvent.blur(window)
      else fireEvent.pointerCancel(document, { pointerId: 2 })
    })

    expect(document.querySelector('style[data-hypercanvas-iframe-pointer-lock]')).toBeNull()
    expect(document.querySelector('style[data-hypercanvas-widget-drag-cursor-style]')).toBeNull()
    expect(document.documentElement.hasAttribute('data-hypercanvas-widget-drag-cursor')).toBe(false)
  })
})
