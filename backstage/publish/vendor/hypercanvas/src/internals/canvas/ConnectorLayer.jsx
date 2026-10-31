import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import styles from './ConnectorLayer.module.css'
import { getConnectorDefaults, getConnectorConfig } from './widgets/widgetConfig.js'
import { getAnchorPoint, getWidgetGap, buildPath } from './connectorGeometry.js'
import { buildOrthogonalPreview, getOrthogonalConnector } from './orthogonalRoutes.js'

const connectorConfig = getConnectorDefaults()

const VALID_ENDPOINT_STYLES = new Set(['circle', 'arrow-start', 'arrow-end', 'none'])

/**
 * Resolve the effective endpoint style for a connector end.
 * Precedence: per-connector override → per-widget-type override → global default.
 *
 * @param {Object} conn — connector object
 * @param {string} widgetType — widget type at this end
 * @param {'start'|'end'} side — which end of the connector
 */
function getEndpointStyle(conn, widgetType, side) {
  const override = side === 'start' ? conn.startEndpoint : conn.endEndpoint
  if (VALID_ENDPOINT_STYLES.has(override)) return override
  const key = side === 'start' ? 'startEndpoint' : 'endEndpoint'
  const widgetConnectors = getConnectorConfig(widgetType)
  if (widgetConnectors.defaults?.[key]) return widgetConnectors.defaults[key]
  return connectorConfig[key]
}

/**
 * Convert a connector's `data` object ({ variant: 'dashed' }) into JSX-spreadable
 * data-* attributes ({ 'data-variant': 'dashed' }). Values are coerced to strings;
 * null/undefined keys are skipped.
 */
function toDataAttrs(data) {
  if (!data || typeof data !== 'object') return null
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue
    const key = k.startsWith('data-') ? k : `data-${k}`
    out[key] = typeof v === 'string' ? v : String(v)
  }
  return out
}

/**
 * Render an endpoint shape (circle, arrow-start, arrow-end, or none) at the given point.
 * - "circle" (default): filled dot
 * - "arrow-start": arrowhead pointing toward the start widget
 * - "arrow-end": arrowhead pointing toward the end widget
 * - "none": invisible drag target only
 *
 * @param {number} x,y — position of this endpoint
 * @param {Object} startPt — position of the connector's start endpoint
 * @param {Object} endPt — position of the connector's end endpoint
 */
const ENDPOINT_HIT_PADDING = 8

function EndpointShape({ x, y, startPt, endPt, style, angle, onPointerDown }) {
  const passThrough = !onPointerDown ? { pointerEvents: 'none' } : {}
  const hitRadius = connectorConfig.endpointRadius + ENDPOINT_HIT_PADDING
  const hitTarget = onPointerDown ? (
    <circle cx={x} cy={y} r={hitRadius}
      className={styles.endpointHitArea}
      onPointerDown={onPointerDown}
    />
  ) : null
  if (style === 'none') {
    return (
      <>
        {hitTarget}
        <circle cx={x} cy={y} r={connectorConfig.endpointRadius}
          style={{ fill: 'transparent', stroke: 'none', ...(onPointerDown ? { pointerEvents: 'none' } : { pointerEvents: 'none' }) }}
        />
      </>
    )
  }
  if (style === 'arrow-start' || style === 'arrow-end') {
    const size = connectorConfig.endpointRadius * 2.2
    const target = style === 'arrow-start' ? startPt : endPt
    const dx = target.x - x
    const dy = target.y - y
    const rotation = angle ?? (Math.atan2(dy, dx) * 180 / Math.PI) + 90
    return (
      <>
        {hitTarget}
        <polygon
          points={`0,${-size} ${size * 0.6},${size * 0.5} ${-size * 0.6},${size * 0.5}`}
          transform={`translate(${x},${y}) rotate(${rotation})`}
          className={styles.connectorEndpoint}
          style={passThrough}
        />
      </>
    )
  }
  return (
    <>
      {hitTarget}
      <circle cx={x} cy={y} r={connectorConfig.endpointRadius}
        className={styles.connectorEndpoint}
        style={passThrough}
      />
    </>
  )
}

/** Shared inline style for both SVG layers (CSS vars for connector theming). */
const svgLayerStyle = {
  width: '100000px',
  height: '100000px',
  '--connector-stroke': connectorConfig.stroke,
  '--connector-stroke-width': `${connectorConfig.strokeWidth}px`,
  '--connector-hover-stroke': connectorConfig.hoverStroke,
  '--connector-hover-stroke-width': `${connectorConfig.hoverStrokeWidth}px`,
  '--connector-endpoint-fill': connectorConfig.endpointFill,
  '--connector-endpoint-stroke': connectorConfig.endpointStroke,
  '--connector-endpoint-stroke-width': `${connectorConfig.endpointStrokeWidth}px`,
  '--connector-hit-area-width': `${connectorConfig.hitAreaStrokeWidth}px`,
  '--connector-drag-stroke': connectorConfig.dragStroke,
  '--connector-drag-stroke-width': `${connectorConfig.dragStrokeWidth}px`,
  '--connector-drag-dasharray': connectorConfig.dragDasharray,
  '--connector-drag-opacity': connectorConfig.dragOpacity,
}

/**
 * Two-layer SVG overlay for connector lines and endpoints.
 *
 * Stacking (bottom → top):
 *   connectorLayer  (z-index 1) — paths, hit areas, broadcast animations
 *   widgets         (z-index 2/3) — normal / selected
 *   endpointLayer   (z-index 4) — anchor dots & drag targets
 *
 * Must be placed inside the same zoom-transformed container as widgets.
 */
export default function ConnectorLayer({
  connectors = [],
  widgets = [],
  selectedWidgetIds,
  onRemove,
  onEndpointDrag,
  dragPreview,
  hidden = false,
  autoPlace = false,
}) {
  const widgetMap = useMemo(() => {
    const map = new Map()
    for (const w of widgets) {
      map.set(w.id, w)
    }
    return map
  }, [widgets])

  const [displayConnectors, setDisplayConnectors] = useState(connectors)
  const [routingTransition, setRoutingTransition] = useState(false)
  const latestConnectors = useRef(connectors)
  const previousMode = useRef(autoPlace)
  const transitioningRef = useRef(false)
  const transitionTimer = useRef(null)
  useEffect(() => {
    if (previousMode.current === autoPlace) return
    previousMode.current = autoPlace
    clearTimeout(transitionTimer.current)
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      transitioningRef.current = false
      setRoutingTransition(false)
      setDisplayConnectors(latestConnectors.current)
      return
    }
    transitioningRef.current = true
    setRoutingTransition(true)
    transitionTimer.current = setTimeout(() => {
      setDisplayConnectors(latestConnectors.current)
      transitionTimer.current = setTimeout(() => {
        transitioningRef.current = false
        setRoutingTransition(false)
      }, 200)
    }, 200)
    return () => clearTimeout(transitionTimer.current)
  }, [autoPlace])
  useEffect(() => {
    latestConnectors.current = connectors
    if (!transitioningRef.current) setDisplayConnectors(connectors)
  }, [connectors])
  useEffect(() => () => clearTimeout(transitionTimer.current), [])

  // Bumps when any widget's DOM bounds change so connector anchors re-resolve.
  // Without this, terminal/agent widgets (ghostty WASM, async-mounted terminal
  // sessions) anchor connectors to their initial small bounds — when the
  // widget grows to its final size, anchors render inside the widget chrome
  // until something else triggers a re-render (selection, drag, etc.).
  const [geometryVersion, setGeometryVersion] = useState(0)
  const rafRef = useRef(null)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const scheduleBump = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setGeometryVersion((v) => v + 1)
      })
    }
    const observer = new ResizeObserver(scheduleBump)
    const observed = []
    for (const w of widgets) {
      const wrapper = document.getElementById(w.id)
      if (!wrapper) continue
      const inner = wrapper.querySelector('[data-widget-id]') || wrapper.firstElementChild
      const target = inner || wrapper
      observer.observe(target)
      observed.push(target)
    }
    return () => {
      observer.disconnect()
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      observed.length = 0
    }
  }, [widgets])

  const handleClick = useCallback((e, connectorId) => {
    e.stopPropagation()
    onRemove?.(connectorId)
  }, [onRemove])

  const dragPreviewIsOrthogonal = autoPlace && (!dragPreview?.snapTarget || (() => {
    const startWidget = widgetMap.get(dragPreview.startWidgetId)
    const endWidget = widgetMap.get(dragPreview.snapTarget.widgetId)
    return !!startWidget && !!endWidget && getWidgetGap(startWidget, endWidget) >= connectorConfig.orthogonalProximityThreshold
  })())

  // Pre-compute connector geometry once, shared by both SVG layers
  const resolved = useMemo(() => displayConnectors.map((conn) => {
    const startWidget = widgetMap.get(conn.start?.widgetId)
    const endWidget = widgetMap.get(conn.end?.widgetId)
    if (!startWidget || !endWidget) return null
    const refreshedRoute = conn._visualRoute
      ? getOrthogonalConnector(conn, widgetMap, { startAnchor: conn.start.anchor, endAnchor: conn.end.anchor }, true, [], {
        stemLength: connectorConfig.orthogonalStemLength,
        proximityThreshold: connectorConfig.orthogonalProximityThreshold,
      })
      : null
    const startPt = refreshedRoute?.startPt || getAnchorPoint(startWidget, conn.start.anchor)
    const endPt = refreshedRoute?.endPt || getAnchorPoint(endWidget, conn.end.anchor)
    const d = refreshedRoute?.d || buildPath(startPt, conn.start.anchor, endPt, conn.end.anchor)
    const routePoints = refreshedRoute?.points
    const startArrowAngle = routePoints?.length > 1
      ? Math.atan2(routePoints[0].y - routePoints[1].y, routePoints[0].x - routePoints[1].x) * 180 / Math.PI + 90
      : undefined
    const endArrowAngle = routePoints?.length > 1
      ? Math.atan2(routePoints.at(-1).y - routePoints.at(-2).y, routePoints.at(-1).x - routePoints.at(-2).x) * 180 / Math.PI + 90
      : undefined
    const startStyle = getEndpointStyle(conn, startWidget.type, 'start')
    const endStyle = getEndpointStyle(conn, endWidget.type, 'end')
    // Per-connector presentational overrides authored in JSONL.
    const customClassName = typeof conn.className === 'string' ? conn.className : ''
    const customStyle = conn.style && typeof conn.style === 'object' ? conn.style : null
    const customDataAttrs = toDataAttrs(conn.data)
    return {
      conn, startPt, endPt, d, startStyle, endStyle,
      startArrowAngle, endArrowAngle,
      customClassName, customStyle, customDataAttrs,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }).filter(Boolean), [displayConnectors, widgetMap, selectedWidgetIds, geometryVersion])

  const hiddenClass = (hidden ? styles.connectorLayerHidden : '') + (routingTransition ? ' ' + styles.connectorLayerTransitioning : '')

  return (
    <>
      {/* Back layer: connector paths (behind widgets) */}
      <svg
        className={`${styles.connectorLayer} ${hiddenClass}`}
        style={svgLayerStyle}
      >
        {resolved.map(({ conn, d, customClassName, customStyle, customDataAttrs }) => (
          <g
            key={conn.id}
            data-connector-id={conn.id}
            data-connector-type={conn.connectorType || 'default'}
            className={customClassName || undefined}
            style={customStyle || undefined}
            {...(customDataAttrs || {})}
          >
            <path d={d} className={styles.connectorPathHitArea}
              onClick={(e) => handleClick(e, conn.id)} />
            <path d={d} className={styles.connectorPath}
              onClick={(e) => handleClick(e, conn.id)} />
          </g>
        ))}

        {dragPreview && (
          <path
            d={dragPreviewIsOrthogonal
              ? buildOrthogonalPreview(dragPreview.startPt, dragPreview.startAnchor, dragPreview.endPt, dragPreview.endAnchor, { stemLength: connectorConfig.orthogonalStemLength })
              : buildPath(dragPreview.startPt, dragPreview.startAnchor, dragPreview.endPt, dragPreview.endAnchor || dragPreview.startAnchor, !dragPreview.snapTarget)}
            className={styles.dragPreviewPath}
          />
        )}
      </svg>

      {/* Front layer: endpoint anchors (above widgets) */}
      <svg
        className={`${styles.endpointLayer} ${hiddenClass}`}
        style={svgLayerStyle}
      >
        {resolved.map(({ conn, startPt, endPt, startStyle, endStyle, startArrowAngle, endArrowAngle, customClassName, customStyle, customDataAttrs }) => (
          <g
            key={conn.id}
            data-connector-id={conn.id}
            data-connector-type={conn.connectorType || 'default'}
            className={customClassName || undefined}
            style={customStyle || undefined}
            {...(customDataAttrs || {})}
          >
            <EndpointShape x={startPt.x} y={startPt.y} startPt={startPt} endPt={endPt} style={startStyle}
              angle={startArrowAngle}
              onPointerDown={onEndpointDrag ? (e) => { e.stopPropagation(); e.preventDefault(); onEndpointDrag(conn, 'start', e) } : undefined} />
            <EndpointShape x={endPt.x} y={endPt.y} startPt={startPt} endPt={endPt} style={endStyle}
              angle={endArrowAngle}
              onPointerDown={onEndpointDrag ? (e) => { e.stopPropagation(); e.preventDefault(); onEndpointDrag(conn, 'end', e) } : undefined} />
          </g>
        ))}

        {dragPreview?.snapTarget && (
          <EndpointShape x={dragPreview.endPt.x} y={dragPreview.endPt.y}
            startPt={dragPreview.startPt} endPt={dragPreview.endPt} style={connectorConfig.endEndpoint} />
        )}
      </svg>
    </>
  )
}

export { getAnchorPoint, buildPath }
