import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./widgets/widgetConfig.js', () => ({
  DEFAULT_ORTHOGONAL_PROXIMITY_THRESHOLD: 96,
  getConnectorDefaults: () => ({ orthogonalStemLength: 52, orthogonalProximityThreshold: 64, controlOffset: 80 }),
  getConnectorConfig: () => ({ defaults: {} }),
}))

import ConnectorLayer from './ConnectorLayer.jsx'

const widgets = [
  { id: 'start', type: 'sticky-note', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } },
  { id: 'end', type: 'sticky-note', position: { x: 200, y: 100 }, props: { width: 100, height: 100 } },
]
const connector = {
  id: 'connector',
  start: { widgetId: 'start', anchor: 'right' },
  end: { widgetId: 'end', anchor: 'left' },
  _visualRoute: { points: [] },
}

describe('ConnectorLayer orthogonal stem config', () => {
  it('uses the configured stem when refreshing rendered connector geometry', () => {
    const { container } = render(<ConnectorLayer connectors={[connector]} widgets={widgets} />)
    const path = container.querySelector('[data-connector-id="connector"] path')

    expect(path.getAttribute('d')).toContain('152 50')
    expect(path.getAttribute('d')).toContain('148 150')
  })

  it('uses the configured stem for a live orthogonal drag preview', () => {
    const { container } = render(<ConnectorLayer
      autoPlace
      dragPreview={{
        startPt: { x: 0, y: 0 },
        startAnchor: 'right',
        endPt: { x: 200, y: 100 },
        endAnchor: 'left',
      }}
    />)
    const preview = container.querySelector('svg path')

    expect(preview.getAttribute('d')).toContain('Q 52 0')
  })

  it('uses the flexible cubic fallback for nearby widget routes', () => {
    const nearbyWidgets = [
      { id: 'start', type: 'sticky-note', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } },
      { id: 'end', type: 'sticky-note', position: { x: 120, y: 0 }, props: { width: 100, height: 100 } },
    ]
    const { container } = render(<ConnectorLayer
      connectors={[{ ...connector, _visualRoute: { points: [{ x: 100, y: 50 }, { x: 120, y: 50 }] } }]}
      widgets={nearbyWidgets}
    />)
    const path = container.querySelector('[data-connector-id="connector"] path')

    expect(path.getAttribute('d')).toContain(' C ')
    expect(path.getAttribute('d')).not.toContain(' Q ')
  })

  it('uses the configured threshold when refreshing an existing route', () => {
    const widgetsWithConfiguredGap = [
      { id: 'start', type: 'sticky-note', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } },
      { id: 'end', type: 'sticky-note', position: { x: 180, y: 0 }, props: { width: 100, height: 100 } },
    ]
    const { container } = render(<ConnectorLayer
      connectors={[connector]}
      widgets={widgetsWithConfiguredGap}
    />)
    const path = container.querySelector('[data-connector-id="connector"] path')

    expect(path.getAttribute('d')).not.toContain(' C ')
    expect(path.getAttribute('d')).toContain('Q 152 50')
  })

  it('uses widget bounds to choose the snapped drag preview route', () => {
    const nearbyWidgets = [
      { id: 'start', type: 'sticky-note', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } },
      { id: 'end', type: 'sticky-note', position: { x: 120, y: 0 }, props: { width: 100, height: 100 } },
    ]
    const preview = (endX) => {
      const widgets = [nearbyWidgets[0], {
        ...nearbyWidgets[1],
        position: { ...nearbyWidgets[1].position, x: endX },
      }]
      return render(<ConnectorLayer
        autoPlace
        widgets={widgets}
        dragPreview={{
          startWidgetId: 'start',
          startPt: { x: 100, y: 50 },
          startAnchor: 'right',
          endPt: { x: endX, y: 50 },
          endAnchor: 'left',
          snapTarget: { widgetId: 'end' },
        }}
      />).container.querySelector('svg path')
    }

    expect(preview(120).getAttribute('d')).toContain(' C ')
    expect(preview(180).getAttribute('d')).toContain(' Q ')
    expect(preview(300).getAttribute('d')).toContain(' Q ')
  })
})
