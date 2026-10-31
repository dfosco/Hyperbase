import { afterEach, describe, expect, it } from 'vitest'
import { acquireDragCursor, createDragCursorManager } from './dragCursor.js'

describe('widget drag cursor', () => {
  afterEach(() => {
    document.querySelectorAll('[data-hypercanvas-widget-drag-cursor-style]').forEach((style) => style.remove())
    document.documentElement.removeAttribute('data-hypercanvas-widget-drag-cursor')
  })

  it('shows grabbing document-wide while active and restores the previous cursor state', () => {
    document.documentElement.setAttribute('data-hypercanvas-widget-drag-cursor', 'previous')
    const release = acquireDragCursor(document)
    const style = document.querySelector('[data-hypercanvas-widget-drag-cursor-style]')

    expect(document.documentElement.getAttribute('data-hypercanvas-widget-drag-cursor')).toBe('active')
    expect(style.textContent).toContain('html[data-hypercanvas-widget-drag-cursor] * { cursor: grabbing !important; }')
    release()
    expect(document.querySelector('[data-hypercanvas-widget-drag-cursor-style]')).toBeNull()
    expect(document.documentElement.getAttribute('data-hypercanvas-widget-drag-cursor')).toBe('previous')
  })

  it('keeps the cursor active until every overlapping drag owner releases', () => {
    const acquire = createDragCursorManager()
    const releaseFirst = acquire(document)
    const releaseSecond = acquire(document)
    const style = document.querySelector('[data-hypercanvas-widget-drag-cursor-style]')

    releaseFirst()
    releaseFirst()
    expect(document.querySelector('[data-hypercanvas-widget-drag-cursor-style]')).toBe(style)
    expect(document.documentElement.getAttribute('data-hypercanvas-widget-drag-cursor')).toBe('active')

    releaseSecond()
    expect(document.querySelector('[data-hypercanvas-widget-drag-cursor-style]')).toBeNull()
    expect(document.documentElement.hasAttribute('data-hypercanvas-widget-drag-cursor')).toBe(false)
  })

  it('keeps separate documents independent', () => {
    const otherDocument = document.implementation.createHTMLDocument('other canvas')
    const acquire = createDragCursorManager()
    const releaseMain = acquire(document)
    const releaseOther = acquire(otherDocument)

    releaseMain()
    expect(document.documentElement.hasAttribute('data-hypercanvas-widget-drag-cursor')).toBe(false)
    expect(otherDocument.documentElement.getAttribute('data-hypercanvas-widget-drag-cursor')).toBe('active')
    releaseOther()
    expect(otherDocument.documentElement.hasAttribute('data-hypercanvas-widget-drag-cursor')).toBe(false)
  })
})
