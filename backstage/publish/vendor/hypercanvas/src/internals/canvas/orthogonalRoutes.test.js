import { describe, expect, it } from 'vitest'
import { buildOrthogonalPreview, getOrthogonalConnector } from './orthogonalRoutes.js'
import { getWidgetGap } from './connectorGeometry.js'

describe('buildOrthogonalPreview', () => {
  it('keeps visible straight stems before rounded bends at both ends', () => {
    const path = buildOrthogonalPreview(
      { x: 0, y: 0 },
      'right',
      { x: 40, y: 100 },
      'left',
    )

    // The 36px anchor exit, less the 10px corner radius, leaves a 26px
    // straight segment before the first bend.
    expect(path).toContain('M 0 0 L 26 0 Q 36 0')
    expect(path).toContain('Q 4 100 14 100 L 40 100')
  })

  it('uses the default 36px stem for resolved connectors', () => {
    const widgets = new Map([
      ['start', { id: 'start', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } }],
      ['end', { id: 'end', position: { x: 200, y: 100 }, props: { width: 100, height: 100 } }],
    ])
    const connector = getOrthogonalConnector(
      { start: { widgetId: 'start', anchor: 'right' }, end: { widgetId: 'end', anchor: 'left' } },
      widgets,
      null,
      true,
    )

    expect(connector.points[1]).toEqual({ x: 136, y: 50 })
    expect(connector.points.at(-2)).toEqual({ x: 164, y: 150 })
  })

  it('accepts a custom stem length for previews and resolved connectors', () => {
    const preview = buildOrthogonalPreview(
      { x: 0, y: 0 },
      'right',
      { x: 200, y: 100 },
      'left',
      { stemLength: 52 },
    )
    expect(preview).toContain('M 0 0 L 42 0 Q 52 0')
    expect(preview).toContain('Q 148 100 158 100 L 200 100')

    const widgets = new Map([
      ['start', { id: 'start', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } }],
      ['end', { id: 'end', position: { x: 200, y: 100 }, props: { width: 100, height: 100 } }],
    ])
    const connector = getOrthogonalConnector(
      { start: { widgetId: 'start', anchor: 'right' }, end: { widgetId: 'end', anchor: 'left' } },
      widgets,
      null,
      true,
      [],
      { stemLength: 52 },
    )

    expect(connector.points[1]).toEqual({ x: 152, y: 50 })
    expect(connector.points.at(-2)).toEqual({ x: 148, y: 150 })
  })

  it('uses edge-to-edge gap with a strict configured proximity threshold', () => {
    const widgets = new Map([
      ['start', { id: 'start', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } }],
      ['end', { id: 'end', position: { x: 195, y: 0 }, props: { width: 100, height: 100 } }],
    ])
    const connector = {
      start: { widgetId: 'start', anchor: 'right' },
      end: { widgetId: 'end', anchor: 'left' },
    }

    expect(getOrthogonalConnector(connector, widgets, null, false, [], { proximityThreshold: 96 })).toBeNull()

    widgets.get('end').position.x = 196
    expect(getOrthogonalConnector(connector, widgets, null, false, [], { proximityThreshold: 96 })).not.toBeNull()
  })

  it('measures diagonal separation between rectangle edges, not widget centers', () => {
    const widgets = new Map([
      ['start', { id: 'start', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } }],
      ['end', { id: 'end', position: { x: 160, y: 160 }, props: { width: 100, height: 100 } }],
    ])
    const connector = {
      start: { widgetId: 'start', anchor: 'right' },
      end: { widgetId: 'end', anchor: 'left' },
    }

    expect(getWidgetGap(widgets.get('start'), widgets.get('end'))).toBeCloseTo(Math.hypot(60, 60))
    expect(getOrthogonalConnector(connector, widgets, null)).toBeNull()
    expect(getOrthogonalConnector(connector, widgets, null, false, [], { proximityThreshold: 80 })).not.toBeNull()
  })

  it('allows an explicit zero proximity threshold and preserves manual waypoint routes', () => {
    const widgets = new Map([
      ['start', { id: 'start', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } }],
      ['end', { id: 'end', position: { x: 110, y: 0 }, props: { width: 100, height: 100 } }],
    ])
    const connector = {
      start: { widgetId: 'start', anchor: 'right' },
      end: { widgetId: 'end', anchor: 'left' },
    }

    expect(getOrthogonalConnector(connector, widgets, null, false, [], { proximityThreshold: 0 })).not.toBeNull()
    expect(getOrthogonalConnector({ ...connector, waypoints: [{ x: 105, y: 50 }] }, widgets, null, false, [], { proximityThreshold: 0 })).toBeNull()
  })
})
