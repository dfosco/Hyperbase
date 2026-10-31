/**
 * CanvasUndoRedo — grouped undo/redo button bar.
 */
import { useState, useEffect, useRef } from 'react'
import * as Tooltip from '../lib/components/ui/tooltip/index.js'

export default function CanvasUndoRedo({ config = {}, data, tabindex = -1 }) {
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const activeCanvasIdRef = useRef(typeof window !== 'undefined' && window.__storyboardCanvasBridgeState?.active
    ? window.__storyboardCanvasBridgeState.canvasId
    : null)
  const requestIdRef = useRef(null)

  useEffect(() => {
    requestIdRef.current = Symbol('canvas-undo-redo-state')

    function handleUndoRedoState(e) {
      const detail = e.detail || {}
      if (detail.requestId && detail.requestId !== requestIdRef.current) return
      if (detail.canvasId && activeCanvasIdRef.current && detail.canvasId !== activeCanvasIdRef.current) return
      if (detail.canvasId) activeCanvasIdRef.current = detail.canvasId
      setCanUndo(!!e.detail?.canUndo)
      setCanRedo(!!e.detail?.canRedo)
    }

    function handleCanvasMounted(e) {
      const canvasId = e.detail?.canvasId
      if (typeof canvasId === 'string' && canvasId) activeCanvasIdRef.current = canvasId
    }

    function handleCanvasUnmounted(e) {
      const canvasId = e.detail?.canvasId
      if (!canvasId || canvasId === activeCanvasIdRef.current) activeCanvasIdRef.current = null
    }

    document.addEventListener('storyboard:canvas:undo-redo-state', handleUndoRedoState)
    document.addEventListener('storyboard:canvas:mounted', handleCanvasMounted)
    document.addEventListener('storyboard:canvas:unmounted', handleCanvasUnmounted)
    document.dispatchEvent(new CustomEvent('storyboard:canvas:undo-redo-state-request', {
      detail: {
        canvasId: activeCanvasIdRef.current,
        requestId: requestIdRef.current,
      },
    }))
    return () => {
      document.removeEventListener('storyboard:canvas:undo-redo-state', handleUndoRedoState)
      document.removeEventListener('storyboard:canvas:mounted', handleCanvasMounted)
      document.removeEventListener('storyboard:canvas:unmounted', handleCanvasUnmounted)
    }
  }, [])

  if (!data) return null

  return (
    <div className="hc-flex hc-items-center hc-overflow-hidden hc-rounded-[10px] hc-border-[2.5px] hc-border-border hc-bg-background hc-text-foreground" role="group" aria-label={config.ariaLabel || 'Undo and redo'}>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            className="hc-flex hc-h-[38px] hc-w-9 hc-cursor-pointer hc-items-center hc-justify-center hc-text-foreground hc-transition-colors hc-hover:bg-accent hc-disabled:cursor-default hc-disabled:opacity-30"
            onClick={() => data.undo()}
            disabled={!canUndo}
            aria-label="Undo"
            tabIndex={tabindex}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M6.78 1.97a.75.75 0 0 1 0 1.06L3.81 6h6.44A4.75 4.75 0 0 1 15 10.75v2.5a.75.75 0 0 1-1.5 0v-2.5a3.25 3.25 0 0 0-3.25-3.25H3.81l2.97 2.97a.75.75 0 1 1-1.06 1.06L1.47 7.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" />
            </svg>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top">Undo (⌘Z)</Tooltip.Content>
      </Tooltip.Root>
      <span className="hc-h-10 hc-w-0.5 hc-shrink-0 hc-bg-border"></span>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            className="hc-flex hc-h-[38px] hc-w-9 hc-cursor-pointer hc-items-center hc-justify-center hc-text-foreground hc-transition-colors hc-hover:bg-accent hc-disabled:cursor-default hc-disabled:opacity-30"
            onClick={() => data.redo()}
            disabled={!canRedo}
            aria-label="Redo"
            tabIndex={-1}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M9.22 1.97a.75.75 0 0 0 0 1.06L12.19 6H5.75A4.75 4.75 0 0 0 1 10.75v2.5a.75.75 0 0 0 1.5 0v-2.5a3.25 3.25 0 0 1 3.25-3.25h6.44l-2.97 2.97a.75.75 0 1 0 1.06 1.06l4.25-4.25a.75.75 0 0 0 0-1.06l-4.25-4.25a.75.75 0 0 0-1.06 0Z" />
            </svg>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content side="top">Redo (⌘⇧Z)</Tooltip.Content>
      </Tooltip.Root>
    </div>
  )
}
