import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ConnectorLayer from './ConnectorLayer.jsx'
import { useVisualConnectors } from './useVisualConnectors.js'

const makeWidgets = (gap) => [
  { id: 'source', type: 'sticky-note', position: { x: 0, y: 0 }, props: { width: 100, height: 100 } },
  { id: 'target', type: 'sticky-note', position: { x: 100 + gap, y: 8 }, props: { width: 100, height: 100 } },
]

const connector = {
  id: 'proximity-connector',
  start: { widgetId: 'source', anchor: 'right' },
  end: { widgetId: 'target', anchor: 'left' },
  waypoints: [],
}
const defaultConnectors = [connector]

function MountedCanvas({ widgets, connectors = defaultConnectors, dragPreview, autoPlace = true, canvasId = 'connector-proximity-integration' }) {
  const visualConnectors = useVisualConnectors({
    canvasId,
    connectors,
    widgets,
    enabled: true,
  })

  return <ConnectorLayer
    connectors={visualConnectors}
    widgets={widgets}
    dragPreview={dragPreview}
    autoPlace={autoPlace}
  />
}

function renderedConnectorPath(container) {
  return container.querySelector('[data-connector-id="proximity-connector"] path')
}

describe('connector proximity integration', () => {
  it('renders a cubic for facing anchors across a small offset and edge gap', () => {
    const { container } = render(<MountedCanvas widgets={makeWidgets(24)} />)
    const path = renderedConnectorPath(container)

    expect(path).not.toBeNull()
    expect(path.getAttribute('d')).toMatch(/\bC\b/)
    expect(path.getAttribute('d')).not.toContain('Q ')
  })

  it('returns to configured orthogonal stems exactly at the threshold and beyond', () => {
    const { container, rerender } = render(<MountedCanvas widgets={makeWidgets(47)} />)
    expect(renderedConnectorPath(container).getAttribute('d')).toMatch(/\bC\b/)

    for (const gap of [48, 72]) {
      rerender(<MountedCanvas widgets={makeWidgets(gap)} />)
      const d = renderedConnectorPath(container).getAttribute('d')
      expect(d).not.toMatch(/\bC\b/)
      expect(d).toContain('Q 148 50')
    }
  })

  it('uses flexible geometry for a nearby known snap target, while preserving free-pointer orthogonal preview', () => {
    const widgets = makeWidgets(24)
    const snappedPreview = {
      startWidgetId: 'source',
      startPt: { x: 100, y: 50 },
      startAnchor: 'right',
      endPt: { x: 124, y: 58 },
      endAnchor: 'left',
      snapTarget: { widgetId: 'target', anchor: 'left', pt: { x: 124, y: 58 } },
    }
    const { container, rerender } = render(<MountedCanvas widgets={widgets} dragPreview={snappedPreview} />)
    let preview = container.querySelector('svg > path')
    expect(preview.getAttribute('d')).toMatch(/\bC\b/)

    rerender(<MountedCanvas
      widgets={widgets}
      dragPreview={{ ...snappedPreview, snapTarget: null }}
    />)
    preview = container.querySelector('svg > path')
    expect(preview.getAttribute('d')).toContain('Q 148 50')
  })

  it('keeps semantic connector type, anchors, and waypoints unchanged while deriving a visual route', () => {
    const saved = {
      ...connector,
      connectorType: 'custom',
      start: { ...connector.start, anchor: 'right' },
      end: { ...connector.end, anchor: 'left' },
      waypoints: [],
    }
    const before = structuredClone(saved)
    const manual = { ...connector, id: 'manual-connector', waypoints: [{ x: 130, y: 30 }] }
    const manualBefore = structuredClone(manual)
    const { container } = render(<MountedCanvas widgets={makeWidgets(24)} connectors={[saved, manual]} canvasId="connector-proximity-semantics" />)

    expect(renderedConnectorPath(container).getAttribute('d')).toMatch(/\bC\b/)
    expect(saved.connectorType).toBe(before.connectorType)
    expect(saved.start).toEqual(before.start)
    expect(saved.end).toEqual(before.end)
    expect(saved.waypoints).toEqual(before.waypoints)
    expect(manual.waypoints).toEqual(manualBefore.waypoints)
  })
})
