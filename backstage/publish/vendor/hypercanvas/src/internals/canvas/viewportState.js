export function canvasViewportStorageKey(canvasId, notebookId = null) {
  return notebookId
    ? `hypercanvas:notebook:${encodeURIComponent(notebookId)}:canvas:${encodeURIComponent(canvasId)}:viewport`
    : `sb-canvas-viewport:${canvasId}`
}

export function parseCanvasViewportState(raw, { zoomMin, zoomMax } = {}) {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const state = JSON.parse(raw)
    if (!state || typeof state !== 'object' || Array.isArray(state)) return null
    const hasZoom = Object.hasOwn(state, 'zoom')
    const hasScrollLeft = Object.hasOwn(state, 'scrollLeft')
    const hasScrollTop = Object.hasOwn(state, 'scrollTop')
    if (!hasZoom && !hasScrollLeft && !hasScrollTop) return null
    if (hasZoom && (!Number.isFinite(state.zoom) || state.zoom <= 0)) return null
    if (hasScrollLeft && (!Number.isFinite(state.scrollLeft) || state.scrollLeft < 0)) return null
    if (hasScrollTop && (!Number.isFinite(state.scrollTop) || state.scrollTop < 0)) return null
    const zoom = hasZoom && Number.isFinite(zoomMin) && Number.isFinite(zoomMax)
      ? Math.min(zoomMax, Math.max(zoomMin, state.zoom))
      : hasZoom ? state.zoom : null
    return {
      zoom,
      scrollLeft: hasScrollLeft ? state.scrollLeft : null,
      scrollTop: hasScrollTop ? state.scrollTop : null,
    }
  } catch {
    return null
  }
}

/** Keep the live viewport when hydration temporarily replaces its scroller. */
export function createCanvasViewportSession(savedState = null) {
  let state = savedState
  let initialized = false
  let restoring = false
  let restoredElement = null
  const measurable = (element) => element && element.isConnected !== false && element.clientWidth > 0 && element.clientHeight > 0
  const snapshot = (element, zoom) => ({ zoom, scrollLeft: element.scrollLeft, scrollTop: element.scrollTop })
  return {
    getState: () => state,
    isInitialized: () => initialized,
    restore(element, { zoom = 100, applyZoom, initialize } = {}) {
      if (!measurable(element)) return null
      if (state) {
        if (element === restoredElement && initialized && !restoring) {
          const currentMaxLeft = Math.max(0, element.scrollWidth - element.clientWidth)
          const currentMaxTop = Math.max(0, element.scrollHeight - element.clientHeight)
          const currentOutOfRange = (state.scrollLeft != null && state.scrollLeft > currentMaxLeft) ||
            (state.scrollTop != null && state.scrollTop > currentMaxTop)
          if (!currentOutOfRange) return state
        }
        zoom = state.zoom ?? zoom
        applyZoom?.(zoom)
        // Hydration can mount the viewport before its scrollable surface.
        // Keep the requested pan until the content can actually contain it.
        const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth)
        const maxTop = Math.max(0, element.scrollHeight - element.clientHeight)
        const outOfRange = (state.scrollLeft != null && state.scrollLeft > maxLeft) ||
          (state.scrollTop != null && state.scrollTop > maxTop)
        restoring = true
        restoredElement = null
        if (outOfRange) return null
        if (state.scrollLeft != null) element.scrollLeft = state.scrollLeft
        if (state.scrollTop != null) element.scrollTop = state.scrollTop
      } else {
        restoring = true
        zoom = initialize?.() ?? zoom
      }
      state = snapshot(element, zoom)
      initialized = true
      restoring = false
      restoredElement = element
      return state
    },
    capture(element, zoom, { overridePending = false } = {}) {
      if (measurable(element) && (overridePending || initialized)) {
        let pending = false
        if (!overridePending && state) {
          const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth)
          const maxTop = Math.max(0, element.scrollHeight - element.clientHeight)
          // Preserve positions clamped to either edge of a temporarily smaller
          // range. User input is passed as overridePending by CanvasPage, so an
          // intentional pan to an edge still replaces the saved position.
          const keepLeft = state.scrollLeft != null && state.scrollLeft > maxLeft &&
            (element.scrollLeft === 0 || element.scrollLeft === maxLeft)
          const keepTop = state.scrollTop != null && state.scrollTop > maxTop &&
            (element.scrollTop === 0 || element.scrollTop === maxTop)
          pending = keepLeft || keepTop
          state = {
            zoom,
            scrollLeft: keepLeft ? state.scrollLeft : element.scrollLeft,
            scrollTop: keepTop ? state.scrollTop : element.scrollTop,
          }
        } else {
          state = snapshot(element, zoom)
        }
        initialized = true
        restoring = pending
        restoredElement = pending ? null : element
      }
      return initialized ? state : null
    },
  }
}
