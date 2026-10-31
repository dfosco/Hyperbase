/**
 * Shows the grabbing cursor over the whole document while a widget drag owns
 * the pointer. The cursor is inherited through normal canvas surfaces and
 * iframe input is separately held by iframePointerLock. Overlapping gestures
 * share one stylesheet and restore the prior document attribute on release.
 */
export function createDragCursorManager() {
  const documents = new WeakMap()

  return function acquireDragCursor(doc = globalThis.document) {
    if (!doc?.createElement || !doc.documentElement) return () => {}

    let state = documents.get(doc)
    if (!state) {
      const root = doc.documentElement
      const style = doc.createElement('style')
      style.setAttribute('data-hypercanvas-widget-drag-cursor-style', '')
      style.textContent = 'html[data-hypercanvas-widget-drag-cursor], html[data-hypercanvas-widget-drag-cursor] * { cursor: grabbing !important; }'
      ;(doc.head || root).appendChild(style)
      state = {
        owners: new Set(),
        style,
        hadAttribute: root.hasAttribute('data-hypercanvas-widget-drag-cursor'),
        previousAttribute: root.getAttribute('data-hypercanvas-widget-drag-cursor'),
      }
      documents.set(doc, state)
      root.setAttribute('data-hypercanvas-widget-drag-cursor', 'active')
    } else if (!state.style.isConnected) {
      ;(doc.head || doc.documentElement).appendChild(state.style)
    }

    const owner = Symbol('widget-drag-cursor-owner')
    state.owners.add(owner)
    let released = false
    return () => {
      if (released) return
      released = true
      state.owners.delete(owner)
      if (state.owners.size) return
      state.style.remove()
      const root = doc.documentElement
      if (state.hadAttribute) root.setAttribute('data-hypercanvas-widget-drag-cursor', state.previousAttribute ?? '')
      else root.removeAttribute('data-hypercanvas-widget-drag-cursor')
      documents.delete(doc)
    }
  }
}

export const acquireDragCursor = createDragCursorManager()
