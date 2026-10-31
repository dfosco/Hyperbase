import { createRef } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ResizeHandle from './ResizeHandle.jsx'

function renderResizeHandle(onResizeEnd = vi.fn()) {
  const targetRef = createRef()
  const result = render(
    <div ref={targetRef}>
      <ResizeHandle targetRef={targetRef} onResize={vi.fn()} onResizeEnd={onResizeEnd} />
      <iframe title="Preview" />
    </div>,
  )
  Object.defineProperty(targetRef.current, 'offsetWidth', { configurable: true, value: 320 })
  Object.defineProperty(targetRef.current, 'offsetHeight', { configurable: true, value: 180 })
  return { ...result, onResizeEnd }
}

describe('ResizeHandle iframe pointer lock', () => {
  it('holds the lock during resize and releases it on mouseup', () => {
    const onResizeEnd = vi.fn()
    const { getByRole } = renderResizeHandle(onResizeEnd)
    const handle = getByRole('separator')

    fireEvent.mouseDown(handle, { button: 0, clientX: 10, clientY: 10 })
    expect(document.querySelector('style[data-hypercanvas-iframe-pointer-lock]')).not.toBeNull()

    fireEvent.mouseMove(document, { clientX: 35, clientY: 30 })
    fireEvent.mouseUp(document, { clientX: 35, clientY: 30 })

    expect(document.querySelector('style[data-hypercanvas-iframe-pointer-lock]')).toBeNull()
    expect(onResizeEnd).toHaveBeenCalledWith(345, 200)
  })

  it.each(['pointercancel', 'blur', 'unmount'])('releases on %s', (interruption) => {
    const { getByRole, unmount } = renderResizeHandle()

    fireEvent.mouseDown(getByRole('separator'), { button: 0, clientX: 10, clientY: 10 })
    expect(document.querySelector('style[data-hypercanvas-iframe-pointer-lock]')).not.toBeNull()

    if (interruption === 'unmount') unmount()
    else if (interruption === 'blur') fireEvent.blur(window)
    else fireEvent.pointerCancel(document, { pointerId: 1 })

    expect(document.querySelector('style[data-hypercanvas-iframe-pointer-lock]')).toBeNull()
  })
})
