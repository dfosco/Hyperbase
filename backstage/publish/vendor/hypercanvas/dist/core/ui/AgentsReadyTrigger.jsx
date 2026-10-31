/**
 * AgentsReadyTrigger — collab-bar button that shows count of `done` agents
 * on the active canvas and cycles through them on click. Always rendered
 * (shows `0` when no agents are ready) and styled to match the per-widget
 * toolbar `featureBtn`.
 *
 * Listens to `storyboard:done-agents-changed` (dispatched by CanvasPage) and
 * dispatches `storyboard:canvas:center-on-widget` to pan to the next agent.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import MessageCircleCode from '../../internals/lucide/icons/message-circle-code.js'

export default function AgentsReadyTrigger({ config = {}, tabIndex }) {
  const [doneAgents, setDoneAgents] = useState([])
  const [workingAgents, setWorkingAgents] = useState([])
  const cycleIndexRef = useRef(0)

  useEffect(() => {
    function handleChange(e) {
      const done = Array.isArray(e.detail?.doneAgents) ? e.detail.doneAgents : []
      const working = Array.isArray(e.detail?.workingAgents) ? e.detail.workingAgents : []
      setDoneAgents(done)
      setWorkingAgents(working)
    }
    document.addEventListener('storyboard:done-agents-changed', handleChange)
    document.dispatchEvent(new CustomEvent('storyboard:done-agents-request'))
    return () => document.removeEventListener('storyboard:done-agents-changed', handleChange)
  }, [])

  const doneCount = doneAgents.length
  const workingCount = workingAgents.length
  const ready = doneCount > 0
  const idle = doneCount === 0 && workingCount === 0
  const label = config.label || 'Agents ready'

  const handleClick = useCallback(() => {
    if (doneCount === 0) return
    const idx = cycleIndexRef.current % doneCount
    cycleIndexRef.current = (idx + 1) % doneCount
    const next = doneAgents[idx]
    if (!next?.id) return
    document.dispatchEvent(new CustomEvent('storyboard:canvas:center-on-widget', {
      detail: { widgetId: next.id },
    }))
  }, [doneCount, doneAgents])

  let aria = config.ariaLabel || label
  if (ready) aria = `${label} (${doneCount})`
  if (workingCount > 0) aria = `${aria} · ${workingCount} working`

  return (
    <button
      type="button"
      data-collab-bar-item="agents-ready"
      data-count={doneCount}
      data-working={workingCount}
      data-ready={ready || undefined}
      className="hc-inline-flex hc-h-[38px] hc-cursor-pointer hc-items-center hc-gap-2 hc-rounded-[10px] hc-border-[2.5px] hc-border-border hc-bg-primary hc-px-3 hc-text-[13px] hc-font-semibold hc-leading-none hc-text-primary-foreground hc-transition-colors hc-hover:bg-accent hc-disabled:cursor-default hc-data-[ready]:border-success hc-data-[ready]:bg-success hc-data-[ready]:text-success-foreground"
      aria-label={aria}
      tabIndex={tabIndex}
      onClick={handleClick}
      disabled={idle}
    >
      {workingCount > 0
        ? <span className="hc-inline-block hc-size-3.5 hc-shrink-0 hc-animate-spin hc-rounded-full hc-border-2 hc-border-current hc-border-t-transparent hc-[animation-duration:850ms]" aria-hidden="true" />
        : <MessageCircleCode size={14} aria-hidden="true" />}
      <span className="hc-whitespace-nowrap">{label}</span>
      <span className="hc-min-w-[1ch] hc-rounded-lg hc-bg-primary-foreground/20 hc-px-2 hc-py-0.5 hc-font-semibold hc-tabular-nums hc-text-inherit" aria-hidden="true">{doneCount}</span>
      {workingCount > 0 && (
        <span className="hc-inline-flex hc-items-center hc-gap-1 hc-rounded-lg hc-bg-primary-foreground/20 hc-px-2 hc-py-0.5 hc-font-semibold hc-tabular-nums hc-text-inherit" aria-hidden="true" title={`${workingCount} working`}>
          <span className="hc-leading-none">{workingCount}</span>
        </span>
      )}
    </button>
  )
}
