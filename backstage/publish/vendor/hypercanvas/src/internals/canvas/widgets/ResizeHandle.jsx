import { useCallback, useEffect, useRef } from 'react'
import styles from './ResizeHandle.module.css'
import { acquireIframePointerLock } from '../iframePointerLock.js'

/**
 * Shared resize handle for canvas widgets.
 *
 * Renders a small drag handle in the bottom-right corner of the parent.
 * On drag, calls `onResize(width, height)` with new dimensions.
 *
 * The parent must have `position: relative` for correct positioning.
 *
 * @param {Object} props
 * @param {React.RefObject} props.targetRef - ref to the element being resized (reads offsetWidth/Height)
 * @param {number} [props.minWidth=180]  - minimum allowed width
 * @param {number} [props.minHeight=60]  - minimum allowed height
 * @param {'both'|'vertical'|'horizontal'} [props.axis='both'] - constrain resize to a single axis
 * @param {Function} props.onResize - callback: (width, height) => void
 * @param {Function} [props.onResizeStart] - called when drag begins
 * @param {Function} [props.onResizeEnd] - called with final (width, height) on drag end
 */
export default function ResizeHandle({ targetRef, minWidth = 180, minHeight = 60, axis = 'both', onResize, onResizeStart, onResizeEnd }) {
  const activeCleanupRef = useRef(null)

  useEffect(() => () => {
    activeCleanupRef.current?.(false)
  }, [])

  const handleMouseDown = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()

    if (activeCleanupRef.current) return

    const el = targetRef?.current
    if (!el) return

    const doc = el.ownerDocument || globalThis.document
    if (!doc) return
    const win = doc.defaultView

    const startX = e.clientX
    const startY = e.clientY
    const startW = el.offsetWidth
    const startH = el.offsetHeight
    let lastW = startW
    let lastH = startH

    const releaseIframePointerLock = acquireIframePointerLock(doc)

    let finished = false
    function finish(commit = true) {
      if (finished) return
      finished = true
      doc.removeEventListener('mousemove', onMove)
      doc.removeEventListener('mouseup', onMouseUp)
      doc.removeEventListener('pointercancel', onCancel, true)
      win?.removeEventListener('blur', onCancel)
      activeCleanupRef.current = null
      releaseIframePointerLock()
      if (commit) onResizeEnd?.(lastW, lastH)
    }

    function onMouseUp() {
      finish(true)
    }

    function onCancel() {
      finish(true)
    }

    // Capture zoom at drag start so resizing stays consistent mid-drag.
    // Derive scale from the element's rendered size vs offsetWidth, which
    // accounts for the canvas's CSS transform regardless of zoom plumbing.
    const rect = el.getBoundingClientRect()
    const scale = startW > 0 && rect.width > 0 ? rect.width / startW : 1

    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      lastW = axis === 'vertical' ? startW : Math.max(minWidth, startW + dx)
      lastH = axis === 'horizontal' ? startH : Math.max(minHeight, startH + dy)
      onResize?.(lastW, lastH)
    }

    activeCleanupRef.current = finish
    doc.addEventListener('mousemove', onMove)
    doc.addEventListener('mouseup', onMouseUp)
    doc.addEventListener('pointercancel', onCancel, true)
    win?.addEventListener('blur', onCancel)

    try {
      onResizeStart?.()
    } catch (error) {
      finish(false)
      throw error
    }
  }, [targetRef, minWidth, minHeight, axis, onResize, onResizeStart, onResizeEnd])

  const cursor = axis === 'vertical' ? 'ns-resize' : axis === 'horizontal' ? 'ew-resize' : 'nwse-resize'

  return (
    <div
      className={styles.handle}
      style={axis !== 'both' ? { cursor } : undefined}
      onMouseDown={handleMouseDown}
      onPointerDown={(e) => e.stopPropagation()}
      role="separator"
      aria-orientation={axis === 'vertical' ? 'vertical' : 'horizontal'}
      aria-label="Resize"
    />
  )
}
