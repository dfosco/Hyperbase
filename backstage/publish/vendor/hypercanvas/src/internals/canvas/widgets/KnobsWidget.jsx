/**
 * KnobsWidget — canvas surface for connected target knob schemas.
 *
 * Discovers widgets connected to this Knobs widget, resolves each target's
 * schema, and renders the shared live KnobsForm without touching iframe srcs.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import KnobsForm from '../../Knobs/KnobsForm.jsx'
import WidgetWrapper from './WidgetWrapper.jsx'
import ResizeHandle from './ResizeHandle.jsx'
import Icon from '../../../core/ui/Icon.jsx'
import { readProp, schemas } from './widgetProps.js'
import {
  isExternalWidgetTarget,
  resolveKnobsTargets,
} from './knobsTargetResolver.js'
import { connectorEndpoint, useCanvasBridge } from './canvasBridge.js'
import { detectKnobRoute } from '../../hooks/useKnob.js'
import styles from './KnobsWidget.module.css'

const knobsWidgetSchema = schemas.knobs || {}
const EMPTY_MESSAGE = 'Connect this widget to a prototype, component, or canvas widget to expose its knobs.'

function connectedTargetsForWidget(widgetId, widgets, connectors) {
  const widgetMap = new Map((widgets || []).map(widget => [widget.id, widget]))
  const seen = new Set()
  const result = []

  for (const connector of connectors || []) {
    const startId = connectorEndpoint(connector, 'start')
    const endId = connectorEndpoint(connector, 'end')
    const otherId = startId === widgetId ? endId : endId === widgetId ? startId : null
    if (!otherId || seen.has(otherId)) continue

    const widget = widgetMap.get(otherId)
    if (!widget) continue

    seen.add(otherId)
    result.push({ id: otherId, widget })
  }

  return result
}

function EmptyState({ externalOnly }) {
  return (
    <div className={styles.emptyState}>
      <p>{EMPTY_MESSAGE}</p>
      {externalOnly && (
        <p className={styles.emptyNote}>
          Connected external embeds are hidden because their cross-origin hash cannot be mutated safely.
        </p>
      )}
    </div>
  )
}

function WaitingForTarget({ label }) {
  return (
    <div className={styles.emptyState}>
      <p>Waiting for {label || 'the connected target'} to finish loading before writing knobs.</p>
    </div>
  )
}

export default forwardRef(function KnobsWidget({ id, props, onUpdate, resizable }, ref) {
  useImperativeHandle(ref, () => ({}), [])

  const width = readProp(props, 'width', knobsWidgetSchema) ?? 360
  const height = readProp(props, 'height', knobsWidgetSchema) ?? 420
  const propActiveTarget = readProp(props, 'activeTarget', knobsWidgetSchema) || ''
  const containerRef = useRef(null)
  const { widgets, connectors } = useCanvasBridge()
  const [localSelection, setLocalSelection] = useState(null)
  const [targetRevision, setTargetRevision] = useState(0)
  const localActiveTarget = localSelection?.baseProp === propActiveTarget ? localSelection.id : ''

  const connectedTargets = useMemo(
    () => connectedTargetsForWidget(id, widgets, connectors),
    [id, widgets, connectors],
  )

  const externalConnectionCount = useMemo(
    () => connectedTargets.filter(target => isExternalWidgetTarget(target.widget)).length,
    [connectedTargets],
  )

  const targets = useMemo(
    () => {
      // A frame-ready event bumps this revision so the resolver rereads the
      // target window after an initially missing iframe has loaded.
      void targetRevision
      return resolveKnobsTargets(connectedTargets)
    },
    [connectedTargets, targetRevision],
  )

  const activeTargetId = useMemo(() => {
    if (targets.length === 0) return ''
    const preferred = localActiveTarget || propActiveTarget
    if (preferred && targets.some(target => target.id === preferred)) return preferred
    return targets[0].id
  }, [localActiveTarget, propActiveTarget, targets])

  const activeTarget = targets.find(target => target.id === activeTargetId) || targets[0] || null
  const hasTabs = targets.length > 1

  useEffect(() => {
    if (!propActiveTarget || !activeTargetId || propActiveTarget === activeTargetId) return
    onUpdate?.({ activeTarget: activeTargetId })
  }, [activeTargetId, onUpdate, propActiveTarget])

  const handleResize = useCallback((nextWidth, nextHeight) => {
    onUpdate?.({ width: nextWidth, height: nextHeight })
  }, [onUpdate])

  const handleTabClick = useCallback((targetId) => {
    setLocalSelection({ id: targetId, baseProp: propActiveTarget })
    onUpdate?.({ activeTarget: targetId })
  }, [onUpdate, propActiveTarget])

  const activeTargetWindow = activeTarget?.getTargetWindow?.() ?? null
  useEffect(() => {
    if (!activeTargetId) return undefined
    const frameReady = event => {
      if (event.detail?.widgetId === activeTargetId) setTargetRevision(revision => revision + 1)
    }
    const knobsChanged = () => setTargetRevision(revision => revision + 1)
    document.addEventListener('storyboard:canvas:iframe-ready', frameReady)
    document.addEventListener('storyboard:knobs-index-changed', knobsChanged)
    return () => {
      document.removeEventListener('storyboard:canvas:iframe-ready', frameReady)
      document.removeEventListener('storyboard:knobs-index-changed', knobsChanged)
    }
  }, [activeTargetId])
  // A target can be admitted after this panel rendered. Re-read the ref on
  // its load notification so Waiting transitions to the live controls.
  const waitingForTargetWindow = !!activeTarget?.requiresTargetWindow && !activeTargetWindow
  let targetRoute
  try {
    targetRoute = activeTargetWindow
      ? detectKnobRoute(activeTargetWindow.location.pathname).route
      : undefined
  } catch { targetRoute = undefined }
  const externalOnly = connectedTargets.length > 0 &&
    targets.length === 0 &&
    externalConnectionCount === connectedTargets.length

  return (
    <WidgetWrapper className={styles.wrapper}>
      <article
        ref={containerRef}
        className={styles.card}
        data-knobs-widget
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <header className={`${styles.header} tc-drag-surface`}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Icon name="iconoir/select-point-3d" size={14} />
          </span>
          <span className={styles.headerTitle}>
            Knobs
            {activeTarget?.label && (
              <>
                <span className={styles.headerSeparator}> · </span>
                <span className={styles.headerTarget}>{activeTarget.label}</span>
              </>
            )}
          </span>
        </header>

        {hasTabs && (
          <nav className={`${styles.tabs} tc-drag-surface`} aria-label="Connected knob targets">
            {targets.map(target => {
              const selected = target.id === activeTarget?.id
              return (
                <button
                  key={target.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`${styles.tab} ${selected ? styles.tabActive : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleTabClick(target.id)
                  }}
                  onPointerDown={event => event.stopPropagation()}
                >
                  {target.label}
                </button>
              )
            })}
          </nav>
        )}

        <section
          className={styles.body}
          data-canvas-allow-text-selection
          onPointerDown={event => event.stopPropagation()}
          onMouseDown={event => event.stopPropagation()}
        >
          {waitingForTargetWindow ? (
            <WaitingForTarget label={activeTarget?.label} />
          ) : activeTarget ? (
            <KnobsForm
              knobs={activeTarget.knobs}
              target={activeTargetWindow}
              route={targetRoute}
              className={styles.form}
              emptyMessage="This target does not declare any knobs yet."
            />
          ) : (
            <EmptyState externalOnly={externalOnly} />
          )}
        </section>

        {resizable && (
          <ResizeHandle
            targetRef={containerRef}
            minWidth={280}
            minHeight={200}
            onResize={handleResize}
          />
        )}
      </article>
    </WidgetWrapper>
  )
})
