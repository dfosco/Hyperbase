import { describe, expect, it, vi } from 'vitest'
import { canvasViewportStorageKey, parseCanvasViewportState, createCanvasViewportSession } from './viewportState.js'

describe('Canvas viewport state', () => {
  it('uses the existing per-Canvas storage key and ignores old timestamps', () => {
    expect(canvasViewportStorageKey('canvas-a')).toBe('sb-canvas-viewport:canvas-a')
    expect(parseCanvasViewportState(JSON.stringify({ zoom: 125, scrollLeft: 40, scrollTop: 90, timestamp: 1 }), {
      zoomMin: 25,
      zoomMax: 200,
    })).toEqual({ zoom: 125, scrollLeft: 40, scrollTop: 90 })
  })

  it('clamps finite zoom values and rejects invalid stored state', () => {
    expect(parseCanvasViewportState('{"zoom":500,"scrollLeft":0,"scrollTop":0}', { zoomMin: 25, zoomMax: 200 }).zoom).toBe(200)
    expect(parseCanvasViewportState('{"zoom":null,"scrollLeft":0,"scrollTop":0}', { zoomMin: 25, zoomMax: 200 })).toBeNull()
    expect(parseCanvasViewportState('{"zoom":100,"scrollLeft":-1,"scrollTop":0}', { zoomMin: 25, zoomMax: 200 })).toBeNull()
    expect(parseCanvasViewportState('{broken')).toBeNull()
  })
})

describe('Canvas viewport session restoration', () => {
  const scroller = () => ({ isConnected: true, clientWidth: 800, clientHeight: 600, scrollWidth: 20000, scrollHeight: 20000, scrollLeft: 0, scrollTop: 0 })

  it('isolates canvas IDs and Notebook IDs, including ambiguous delimiter names', () => {
    expect(canvasViewportStorageKey('overview', 'one')).not.toBe(canvasViewportStorageKey('overview', 'two'))
    expect(canvasViewportStorageKey('overview', 'one')).not.toBe(canvasViewportStorageKey('details', 'one'))
    expect(canvasViewportStorageKey('b:canvas:c', 'a')).not.toBe(canvasViewportStorageKey('c', 'a:canvas:b'))
  })

  it('waits for measurable layout without consuming the saved viewport', () => {
    const saved = { zoom: 125, scrollLeft: 1400, scrollTop: 1900 }
    const session = createCanvasViewportSession(saved)
    const element = { ...scroller(), clientWidth: 0, clientHeight: 0 }
    const initialize = vi.fn()
    expect(session.restore(element, { initialize })).toBeNull()
    expect(session.isInitialized()).toBe(false)
    expect(session.getState()).toEqual(saved)
    element.clientWidth = 800
    element.clientHeight = 600
    const applyZoom = vi.fn()
    expect(session.restore(element, { applyZoom, initialize })).toEqual(saved)
    expect(applyZoom).toHaveBeenCalledWith(125)
    expect(initialize).not.toHaveBeenCalled()
    expect(element.scrollLeft).toBe(1400)
    expect(element.scrollTop).toBe(1900)
  })

  it('restores the live pan and zoom after delayed hydration replaces the scroller', () => {
    const session = createCanvasViewportSession({ zoom: 125, scrollLeft: 1400, scrollTop: 1900 })
    const initial = scroller()
    session.restore(initial)
    initial.scrollLeft = 1600
    initial.scrollTop = 2100
    session.capture(initial, 150)
    initial.isConnected = false
    initial.scrollLeft = 0
    initial.scrollTop = 0
    // Teardown cannot replace the last live position with a detached DOM zero.
    expect(session.capture(initial, 150)).toEqual({ zoom: 150, scrollLeft: 1600, scrollTop: 2100 })
    const replacement = scroller()
    const initialize = vi.fn()
    session.restore(replacement, { initialize })
    expect(initialize).not.toHaveBeenCalled()
    expect(replacement.scrollLeft).toBe(1600)
    expect(replacement.scrollTop).toBe(2100)
    expect(session.getState().zoom).toBe(150)
  })

  it('keeps desired pan pending while a measured viewport still has insufficient scroll extent', () => {
    const saved = { zoom: 125, scrollLeft: 1400, scrollTop: 1900 }
    const session = createCanvasViewportSession(saved)
    const element = { ...scroller(), scrollWidth: 800, scrollHeight: 600 }
    expect(session.restore(element)).toBeNull()
    expect(session.isInitialized()).toBe(false)
    expect(session.capture(element, 125)).toBeNull()
    expect(session.getState()).toEqual(saved)
    expect(element.scrollLeft).toBe(0)
    element.scrollWidth = 2400
    expect(session.restore(element)).toBeNull()
    expect(session.getState()).toEqual(saved)
    element.scrollHeight = 3000
    expect(session.restore(element)).toEqual(saved)
    expect(element.scrollLeft).toBe(1400)
    expect(element.scrollTop).toBe(1900)
  })

  it('does not replace a previously initialized session with clamped scroll during rehydration', () => {
    const saved = { zoom: 150, scrollLeft: 1400, scrollTop: 1900 }
    const session = createCanvasViewportSession(saved)
    session.restore(scroller())
    const replacement = { ...scroller(), scrollWidth: 800, scrollHeight: 600 }
    expect(session.restore(replacement)).toBeNull()
    expect(session.capture(replacement, 150)).toEqual(saved)
    replacement.scrollWidth = 3000
    replacement.scrollHeight = 3000
    expect(session.restore(replacement)).toEqual(saved)
  })

  it('ignores a transient browser clamp after restore instead of persisting zero pan', () => {
    const saved = { zoom: 125, scrollLeft: 1400, scrollTop: 1900 }
    const session = createCanvasViewportSession(saved)
    const live = scroller()
    session.restore(live)
    live.scrollWidth = live.clientWidth
    live.scrollHeight = live.clientHeight
    live.scrollLeft = 0
    live.scrollTop = 0

    expect(session.capture(live, 125)).toEqual(saved)
    live.isConnected = false
    expect(session.capture(live, 125)).toEqual(saved)

    const replacement = scroller()
    expect(session.restore(replacement)).toEqual(saved)
    expect(replacement.scrollLeft).toBe(saved.scrollLeft)
    expect(replacement.scrollTop).toBe(saved.scrollTop)
  })

  it('lets an intentional reset replace a pending unreachable viewport', () => {
    const session = createCanvasViewportSession({ zoom: 150, scrollLeft: 1400, scrollTop: 1900 })
    const element = { ...scroller(), scrollWidth: 1800, scrollHeight: 1600 }
    expect(session.restore(element)).toBeNull()
    element.scrollLeft = 30
    element.scrollTop = 40
    expect(session.capture(element, 100, { overridePending: true })).toEqual({ zoom: 100, scrollLeft: 30, scrollTop: 40 })
    expect(session.restore(element)).toEqual({ zoom: 100, scrollLeft: 30, scrollTop: 40 })
  })

  it('keeps independent session snapshots when navigating away and back', () => {
    const first = createCanvasViewportSession({ zoom: 75, scrollLeft: 1100, scrollTop: 1300 })
    const second = createCanvasViewportSession({ zoom: 150, scrollLeft: 2100, scrollTop: 2300 })
    const firstElement = scroller()
    first.restore(firstElement)
    firstElement.scrollTop = 1700
    const firstSaved = first.capture(firstElement, 80)
    second.restore(scroller())
    const reopened = createCanvasViewportSession(parseCanvasViewportState(JSON.stringify(firstSaved)))
    const reopenedElement = scroller()
    reopened.restore(reopenedElement)
    expect(reopened.getState()).toEqual({ zoom: 80, scrollLeft: 1100, scrollTop: 1700 })
    expect(second.getState()).toEqual({ zoom: 150, scrollLeft: 2100, scrollTop: 2300 })
  })

  it('uses initial framing once and preserves an explicit later reset', () => {
    const session = createCanvasViewportSession()
    const element = scroller()
    const initialize = vi.fn(() => {
      element.scrollLeft = 300
      element.scrollTop = 400
      return 60
    })
    expect(session.restore(element, { initialize })).toEqual({ zoom: 60, scrollLeft: 300, scrollTop: 400 })
    session.restore(scroller(), { initialize })
    expect(initialize).toHaveBeenCalledTimes(1)
    // Explicit zoom-to-fit/reset remains a deliberate new viewport.
    element.scrollLeft = 30
    element.scrollTop = 40
    const reset = session.capture(element, 100)
    expect(reset).toEqual({ zoom: 100, scrollLeft: 30, scrollTop: 40 })
    const reloaded = createCanvasViewportSession(parseCanvasViewportState(JSON.stringify(reset)))
    expect(reloaded.restore(scroller(), { initialize })).toEqual(reset)
    expect(initialize).toHaveBeenCalledTimes(1)
  })

  it('does not reapply an old snapshot when the same live surface resizes during a zoom', () => {
    const session = createCanvasViewportSession({ zoom: 100, scrollLeft: 300, scrollTop: 500 })
    const element = scroller()
    session.restore(element)
    // A wheel zoom updates DOM before its debounced storage write.
    element.scrollLeft = 700
    element.scrollTop = 900
    const applyZoom = vi.fn()
    session.restore(element, { applyZoom })
    expect(applyZoom).not.toHaveBeenCalled()
    expect(element.scrollLeft).toBe(700)
    expect(element.scrollTop).toBe(900)
    expect(session.capture(element, 150)).toEqual({ zoom: 150, scrollLeft: 700, scrollTop: 900 })
  })

  it('does not save an uninitialized or hidden viewport as zero', () => {
    const saved = { zoom: 150, scrollLeft: 300, scrollTop: 500 }
    const session = createCanvasViewportSession(saved)
    const hidden = { ...scroller(), clientWidth: 0 }
    expect(session.capture(hidden, 100)).toBeNull()
    expect(session.getState()).toEqual(saved)
  })
})
