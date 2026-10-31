import { resolveNotebookView } from '../../core/session/notebookView.js'
/**
 * Only the top-level, same-origin prototype ContentFrame gets host shortcuts.
 * Canvas PrototypeEmbed, nested frames, stories, and sandboxed frames do not.
 */
export function isEligiblePrototypeShortcutFrame(frame, hostWindow, kind = 'prototype') {
  if (kind !== 'prototype' || !frame || !hostWindow) return false
  if (frame.getAttribute('data-hypercanvas-content') !== 'prototype') return false
  if (frame.hasAttribute('sandbox')) return false

  try {
    const child = frame.contentWindow
    const childDocument = frame.contentDocument
    const hostOrigin = hostWindow.location.origin
    return Boolean(
      child && childDocument && child.document === childDocument &&
      child.parent === hostWindow && child.top === hostWindow &&
      hostOrigin !== 'null' && child.location.origin === hostOrigin,
    )
  } catch {
    // Cross-origin and opaque documents are deliberately ineligible.
    return false
  }
}

export function isEligiblePrototypeShortcutEvent(event) {
  if (!event?.isTrusted || event.altKey || !(event.metaKey || event.ctrlKey)) return false
  return event.key === 'k' || event.key === 'K'
}

export function forwardPrototypeShortcutEvent(event, hostWindow) {
  if (!isEligiblePrototypeShortcutEvent(event)) return false
  const view = resolveNotebookView(hostWindow.location.search)
  if (view.embed || (event.shiftKey ? view.mode === 'removed' && !view.showTools : !view.paletteAvailable)) return false

  const forwarded = new hostWindow.KeyboardEvent('keydown', {
    key: event.shiftKey ? 'K' : 'k',
    code: 'KeyK',
    bubbles: true,
    cancelable: true,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    repeat: event.repeat,
  })
  hostWindow.document.dispatchEvent(forwarded)

  // The child keeps its normal shortcut unless an existing host handler
  // explicitly claims the forwarded event with preventDefault().
  if (forwarded.defaultPrevented) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return true
  }
  return false
}

/** Attach to the currently loaded child document and return its exact cleanup. */
export function bindPrototypeShortcutBridge(frame, hostWindow, kind = 'prototype') {
  if (!isEligiblePrototypeShortcutFrame(frame, hostWindow, kind)) return () => {}

  const childDocument = frame.contentDocument
  const forwardKeydown = event => forwardPrototypeShortcutEvent(event, hostWindow)

  childDocument.addEventListener('keydown', forwardKeydown, true)
  return () => childDocument.removeEventListener('keydown', forwardKeydown, true)
}
