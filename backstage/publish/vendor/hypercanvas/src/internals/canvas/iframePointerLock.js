/**
 * Temporarily makes iframe hit regions transparent to pointer input while a
 * canvas gesture is active. The injected stylesheet leaves each frame's
 * inline styles, attributes, browsing context, and existing gates intact.
 */
export function createIframePointerLockManager() {
  const documents = new WeakMap()

  function lockInlineImportantFrame(iframe, state) {
    if (!iframe?.style || iframe.style.getPropertyPriority('pointer-events') !== 'important') return
    if (!state.inlineFrames.has(iframe)) {
      state.inlineFrames.set(iframe, {
        value: iframe.style.getPropertyValue('pointer-events'),
        priority: iframe.style.getPropertyPriority('pointer-events'),
      })
    }
    if (iframe.style.getPropertyValue('pointer-events') !== 'none') {
      iframe.style.setProperty('pointer-events', 'none', 'important')
    }
  }

  return function acquireIframePointerLock(doc = globalThis.document) {
    if (!doc?.createElement) return () => {}

    let state = documents.get(doc)
    if (!state) {
      const style = doc.createElement('style')
      style.setAttribute('data-hypercanvas-iframe-pointer-lock', '')
      style.textContent = 'iframe { pointer-events: none !important; }'
      ;(doc.head || doc.documentElement).appendChild(style)
      state = { owners: new Set(), style, inlineFrames: new Map(), observer: null }
      documents.set(doc, state)
      const MutationObserverImpl = doc.defaultView?.MutationObserver || globalThis.MutationObserver
      if (MutationObserverImpl && doc.documentElement) {
        state.observer = new MutationObserverImpl((records) => {
          for (const record of records) {
            if (record.type === 'attributes' && record.target.localName === 'iframe') {
              lockInlineImportantFrame(record.target, state)
            }
            for (const node of record.addedNodes || []) {
              if (node.nodeType !== 1) continue
              if (node.localName === 'iframe') lockInlineImportantFrame(node, state)
              node.querySelectorAll?.('iframe').forEach((iframe) => lockInlineImportantFrame(iframe, state))
            }
          }
        })
        state.observer.observe(doc.documentElement, {
          attributes: true,
          attributeFilter: ['style'],
          childList: true,
          subtree: true,
        })
      }
      doc.querySelectorAll?.('iframe').forEach((iframe) => lockInlineImportantFrame(iframe, state))
    } else if (!state.style.isConnected) {
      ;(doc.head || doc.documentElement).appendChild(state.style)
    }

    const owner = Symbol('iframe-pointer-lock-owner')
    state.owners.add(owner)
    let released = false

    return () => {
      if (released) return
      released = true
      state.owners.delete(owner)
      if (state.owners.size !== 0) return
      state.observer?.disconnect()
      for (const [iframe, previous] of state.inlineFrames) {
        if (previous.value) iframe.style.setProperty('pointer-events', previous.value, previous.priority)
        else iframe.style.removeProperty('pointer-events')
      }
      state.inlineFrames.clear()
      state.style.remove()
      documents.delete(doc)
    }
  }
}

export const acquireIframePointerLock = createIframePointerLockManager()
