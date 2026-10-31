import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./widgets/widgetConfig.js', () => ({
  DEFAULT_ORTHOGONAL_PROXIMITY_THRESHOLD: 96,
  getConnectorDefaults: () => ({ orthogonalStemLength: 52, orthogonalProximityThreshold: 64 }),
}))

import { useVisualConnectors } from './useVisualConnectors.js'

const widgets = [
  { id: 'start', type: 'sticky-note', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } },
  { id: 'end', type: 'sticky-note', position: { x: 300, y: 0 }, props: { width: 100, height: 100 } },
  { id: 'end-2', type: 'sticky-note', position: { x: 300, y: 200 }, props: { width: 100, height: 100 } },
]
const connectors = [
  {
    id: 'connector',
    start: { widgetId: 'start', anchor: 'right' },
    end: { widgetId: 'end', anchor: 'left' },
  },
  {
    id: 'connector-2',
    start: { widgetId: 'start', anchor: 'right' },
    end: { widgetId: 'end-2', anchor: 'left' },
  },
]

describe('useVisualConnectors orthogonal stem config', () => {
  it('uses the configured stem for automatic and shared-trunk routes', () => {
    const { result } = renderHook(() => useVisualConnectors({
      canvasId: 'stem-config-test',
      connectors,
      widgets,
      enabled: true,
    }))

    const routes = result.current.map((connector) => connector._visualRoute)
    expect(routes[0].startAnchor).toBe(routes[1].startAnchor)
    for (const route of routes) {
      const startStem = Math.hypot(route.points[1].x - route.startPt.x, route.points[1].y - route.startPt.y)
      expect(startStem).toBe(52)
    }
  })

  it('keeps nearby connector anchors render-only and uses the flexible route fallback', () => {
    const nearbyWidgets = [
      { id: 'near-start', type: 'sticky-note', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } },
      { id: 'near-end', type: 'sticky-note', position: { x: 120, y: 0 }, props: { width: 100, height: 100 } },
    ]
    const source = {
      id: 'near-connector',
      connectorType: 'default',
      start: { widgetId: 'near-start', anchor: 'right' },
      end: { widgetId: 'near-end', anchor: 'left' },
    }
    const sibling = { ...source, id: 'near-sibling' }
    const sourceConnectors = [source, sibling]
    const { result } = renderHook(() => useVisualConnectors({
      canvasId: 'nearby-connectors-test',
      connectors: sourceConnectors,
      widgets: nearbyWidgets,
      enabled: true,
    }))

    expect(result.current).toEqual(sourceConnectors)
    expect(sourceConnectors).toEqual([
      {
      id: 'near-connector',
      connectorType: 'default',
      start: { widgetId: 'near-start', anchor: 'right' },
      end: { widgetId: 'near-end', anchor: 'left' },
      },
      {
        id: 'near-sibling',
        connectorType: 'default',
        start: { widgetId: 'near-start', anchor: 'right' },
        end: { widgetId: 'near-end', anchor: 'left' },
      },
    ])
    expect(result.current.every((connector) => connector._visualRoute === undefined)).toBe(true)
  })

  it('uses the configured threshold rather than the safe default', () => {
    const source = {
      id: 'configured-threshold',
      start: { widgetId: 'threshold-start', anchor: 'right' },
      end: { widgetId: 'threshold-end', anchor: 'left' },
    }
    const sourceConnectors = [source]
    const thresholdWidgets = [
      { id: 'threshold-start', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } },
      { id: 'threshold-end', position: { x: 180, y: 0 }, props: { width: 100, height: 100 } },
    ]
    const { result } = renderHook(() => useVisualConnectors({
      canvasId: 'configured-connector-threshold-test',
      connectors: sourceConnectors,
      widgets: thresholdWidgets,
      enabled: true,
    }))

    expect(result.current[0]._visualRoute).toBeDefined()
    expect(result.current[0]._visualRoute.points[1].x - result.current[0]._visualRoute.startPt.x).toBe(52)
  })
})
