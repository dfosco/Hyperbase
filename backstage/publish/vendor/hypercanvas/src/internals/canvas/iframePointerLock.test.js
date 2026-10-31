import { afterEach, describe, expect, it } from 'vitest'
import { acquireIframePointerLock, createIframePointerLockManager } from './iframePointerLock.js'

describe('iframe pointer lock', () => {
  afterEach(() => {
    document.querySelectorAll('[data-hypercanvas-iframe-pointer-lock]').forEach((style) => style.remove())
  })

  it('locks existing and newly-mounted iframes without changing their own styles or frame state', () => {
    const iframe = document.createElement('iframe')
    iframe.style.pointerEvents = 'auto'
    iframe.src = 'about:blank'
    document.body.appendChild(iframe)
    const originalStyle = iframe.getAttribute('style')
    const originalWindow = iframe.contentWindow
    const release = acquireIframePointerLock()

    const rule = document.querySelector('[data-hypercanvas-iframe-pointer-lock]')
    expect(rule.textContent).toContain('iframe { pointer-events: none !important; }')

    const mountedWhileLocked = document.createElement('iframe')
    document.body.appendChild(mountedWhileLocked)
    expect(document.querySelectorAll('[data-hypercanvas-iframe-pointer-lock]')).toHaveLength(1)
    expect(iframe.getAttribute('style')).toBe(originalStyle)
    expect(iframe.contentWindow).toBe(originalWindow)

    release()
    expect(document.querySelector('[data-hypercanvas-iframe-pointer-lock]')).toBeNull()
    expect(iframe.getAttribute('style')).toBe(originalStyle)
    expect(iframe.contentWindow).toBe(originalWindow)
    iframe.remove()
    mountedWhileLocked.remove()
  })

  it('keeps the lock active until every overlapping owner releases', () => {
    const acquire = createIframePointerLockManager()
    const releaseFirst = acquire(document)
    const releaseSecond = acquire(document)
    const rule = document.querySelector('[data-hypercanvas-iframe-pointer-lock]')

    expect(rule).not.toBeNull()
    releaseFirst()
    releaseFirst()
    expect(document.querySelector('[data-hypercanvas-iframe-pointer-lock]')).toBe(rule)

    releaseSecond()
    expect(document.querySelector('[data-hypercanvas-iframe-pointer-lock]')).toBeNull()
  })

  it('temporarily overrides and restores inline important pointer styles', () => {
    const iframe = document.createElement('iframe')
    iframe.style.setProperty('pointer-events', 'auto', 'important')
    document.body.appendChild(iframe)
    const before = iframe.getAttribute('style')
    const release = acquireIframePointerLock()

    expect(iframe.style.getPropertyValue('pointer-events')).toBe('none')
    expect(iframe.style.getPropertyPriority('pointer-events')).toBe('important')

    release()
    expect(iframe.getAttribute('style')).toBe(before)
    iframe.remove()
  })

  it('covers dynamically mounted iframes with inline important pointer styles', async () => {
    const release = acquireIframePointerLock()
    const iframe = document.createElement('iframe')
    iframe.style.setProperty('pointer-events', 'auto', 'important')
    const before = iframe.getAttribute('style')
    document.body.appendChild(iframe)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(iframe.style.getPropertyValue('pointer-events')).toBe('none')
    expect(iframe.style.getPropertyPriority('pointer-events')).toBe('important')

    release()
    expect(iframe.getAttribute('style')).toBe(before)
    iframe.remove()
  })

  it('scopes lock owners to their document', () => {
    const otherDocument = document.implementation.createHTMLDocument('iframe lock')
    const acquire = createIframePointerLockManager()
    const releaseMain = acquire(document)
    const releaseOther = acquire(otherDocument)

    expect(document.querySelectorAll('[data-hypercanvas-iframe-pointer-lock]')).toHaveLength(1)
    expect(otherDocument.querySelectorAll('[data-hypercanvas-iframe-pointer-lock]')).toHaveLength(1)

    releaseMain()
    expect(document.querySelector('[data-hypercanvas-iframe-pointer-lock]')).toBeNull()
    expect(otherDocument.querySelector('[data-hypercanvas-iframe-pointer-lock]')).not.toBeNull()
    releaseOther()
  })
})
