import { useEffect, useMemo, useState } from 'react'
import { getOrthogonalConnector } from './orthogonalRoutes.js'
import { getConnectorDefaults } from './widgets/widgetConfig.js'

const connectorConfig = getConnectorDefaults()

function storageKey(canvasId) {
  return `sb-canvas-visual-anchors:${canvasId}`
}

function readCache(canvasId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(canvasId)) || '{}')
  } catch {
    return {}
  }
}

/** Derive visual connector anchors and routes without mutating semantic connectors. */
export function useVisualConnectors({ canvasId, connectors = [], widgets = [], enabled = false, paused = false }) {
  const [lastComplete, setLastComplete] = useState(connectors)
  const widgetMap = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget])), [widgets])
  const cache = useMemo(() => readCache(canvasId), [canvasId, connectors, widgets])
  const result = useMemo(() => {
    const nextCache = { ...cache }
    const visual = connectors.map((connector) => {
      if (connector.waypoints?.length) return connector
      const signature = JSON.stringify([connector.start?.widgetId, connector.start?.anchor, connector.end?.widgetId, connector.end?.anchor])
      const previous = cache[connector.id]
      const preferred = previous?.signature === signature ? previous : null
      if (!enabled || paused) {
        if (!preferred) return connector
        return {
          ...connector,
          start: { ...connector.start, anchor: preferred.startAnchor },
          end: { ...connector.end, anchor: preferred.endAnchor },
        }
      }
      const route = getOrthogonalConnector(connector, widgetMap, preferred, false, [], {
        stemLength: connectorConfig.orthogonalStemLength,
        proximityThreshold: connectorConfig.orthogonalProximityThreshold,
      })
      if (!route) return connector
      const saved = { signature, startAnchor: route.startAnchor, endAnchor: route.endAnchor }
      nextCache[connector.id] = saved
      return {
        ...connector,
        start: { ...connector.start, anchor: route.startAnchor },
        end: { ...connector.end, anchor: route.endAnchor },
        _visualRoute: route,
      }
    })
    // Two deterministic passes allow later routes to establish useful lanes,
    // then let earlier routes reuse those settled trunks.
    for (let pass = 0; pass < 2; pass++) {
      for (const connector of visual) {
        if (!connector._visualRoute) continue
        const siblings = visual.filter((candidate) => candidate.id !== connector.id && candidate._visualRoute && (
          (candidate.start?.widgetId === connector.start?.widgetId && candidate.start?.anchor === connector.start?.anchor) ||
          (candidate.end?.widgetId === connector.end?.widgetId && candidate.end?.anchor === connector.end?.anchor)
        ))
        if (!siblings.length) continue
        const route = getOrthogonalConnector(
          connector,
          widgetMap,
          { startAnchor: connector.start.anchor, endAnchor: connector.end.anchor },
          true,
          siblings.map((sibling) => sibling._visualRoute),
          {
            stemLength: connectorConfig.orthogonalStemLength,
            proximityThreshold: connectorConfig.orthogonalProximityThreshold,
          },
        )
        if (route) connector._visualRoute = route
      }
    }
    return { connectors: visual, cache: nextCache }
  }, [cache, connectors, enabled, paused, widgetMap])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve the last complete routes when an update pauses rendering.
    if (!paused) setLastComplete(result.connectors)
  }, [paused, result.connectors])

  useEffect(() => {
    if (!enabled || paused || typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(storageKey(canvasId), JSON.stringify(result.cache))
    } catch {
      // Visual routing remains available if browser storage is full or disabled.
    }
  }, [canvasId, enabled, paused, result.cache])

  return paused ? lastComplete : result.connectors
}
