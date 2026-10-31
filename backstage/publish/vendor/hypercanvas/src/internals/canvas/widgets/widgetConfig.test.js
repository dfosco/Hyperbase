import { describe, expect, it, afterEach } from 'vitest'
import { isResizable, getFeatures, getMultiSelectionFeatures, getWidgetMeta, getConnectorDefaults, isEditableInProduction, normalizeOrthogonalProximityThreshold } from './widgetConfig.js'
import { initCanvasConfig, _resetCanvasConfig } from '../../../core/stores/canvasConfig.js'
import { registerWidget, _resetWidgetRegistry } from '../../../core/stores/widgetRegistry.js'

describe('isResizable', () => {
  // Vitest runs in dev mode by default (import.meta.env.PROD = false)
  // In dev mode, all resize-enabled widgets are resizable
  it('returns true for resize-enabled widgets in dev mode', () => {
    expect(isResizable('sticky-note')).toBe(true)
    expect(isResizable('prototype')).toBe(true)
    expect(isResizable('figma-embed')).toBe(true)
    expect(isResizable('image')).toBe(true)
    expect(isResizable('component')).toBe(true)
  })

  it('returns false for link-preview (resize disabled)', () => {
    expect(isResizable('link-preview')).toBe(false)
  })

  it('returns true for markdown (resize enabled, dev only)', () => {
    expect(isResizable('markdown')).toBe(true)
  })

  it('returns false for unknown widget types', () => {
    expect(isResizable('nonexistent')).toBe(false)
  })
})

describe('getFeatures', () => {
  it('returns features array for known widget types', () => {
    const features = getFeatures('sticky-note')
    expect(Array.isArray(features)).toBe(true)
    expect(features.length).toBeGreaterThan(0)
  })

  it('returns empty array for unknown widget types', () => {
    expect(getFeatures('nonexistent')).toEqual([])
  })

  it('returns only prod features when isLocalDev is false', () => {
    const features = getFeatures('figma-embed', { isLocalDev: false })
    expect(features.length).toBeGreaterThan(0)
    expect(features.every(f => f.prod === true)).toBe(true)
  })

  it('returns all features when isLocalDev is true (default)', () => {
    const allFeatures = getFeatures('figma-embed')
    const prodFeatures = getFeatures('figma-embed', { isLocalDev: false })
    expect(allFeatures.length).toBeGreaterThan(prodFeatures.length)
  })

  it('includes menu-only prod features when isLocalDev is false', () => {
    const features = getFeatures('figma-embed', { isLocalDev: false })
    const menuFeature = features.find(f => f.menu)
    expect(menuFeature).toBeDefined()
    expect(menuFeature.prod).toBe(true)
  })
})

describe('getWidgetMeta', () => {
  it('returns label and icon for known types', () => {
    const meta = getWidgetMeta('sticky-note')
    expect(meta).toEqual({ label: 'Sticky Note', icon: 'sticky-note' })
  })

  it('returns null for unknown types', () => {
    expect(getWidgetMeta('nonexistent')).toBeNull()
  })
})

describe('getConnectorDefaults', () => {
  it('exposes the configured orthogonal stem length', () => {
    expect(getConnectorDefaults().orthogonalStemLength).toBe(48)
  })

  it('exposes the configured proximity fallback threshold', () => {
    expect(getConnectorDefaults().orthogonalProximityThreshold).toBe(48)
  })

  it('defaults missing or invalid proximity thresholds and allows zero to disable fallback', () => {
    expect(normalizeOrthogonalProximityThreshold(undefined)).toBe(96)
    expect(normalizeOrthogonalProximityThreshold(Number.NaN)).toBe(96)
    expect(normalizeOrthogonalProximityThreshold(-1)).toBe(96)
    expect(normalizeOrthogonalProximityThreshold(0)).toBe(0)
    expect(normalizeOrthogonalProximityThreshold(72)).toBe(72)
  })
})

describe('getMultiSelectionFeatures', () => {
  const selected = [{ id: 'a', type: 'first' }, { id: 'b', type: 'second' }]
  const feature = { id: 'color', type: 'color-picker', prop: 'color', multiSelection: {} }
  const register = (first, second = first) => {
    registerWidget('first', { features: first })
    registerWidget('second', { features: second })
  }

  afterEach(() => _resetWidgetRegistry())

  it('opts in built-in sticky color exclusively and never offers individual controls', () => {
    expect(getMultiSelectionFeatures([{ id: 'a', type: 'sticky-note' }, { id: 'b', type: 'sticky-note' }]))
      .toEqual([{ feature: expect.objectContaining({ id: 'color', multiSelection: {} }), widgetIds: ['a', 'b'] }])
    expect(getMultiSelectionFeatures([{ id: 'a', type: 'sticky-note' }, { id: 'm', type: 'markdown' }])).toEqual([])
    expect(getMultiSelectionFeatures([{ id: 'a', type: 'sticky-note' }])).toEqual([])
  })

  it('offers non-exclusive frame Theme and Device actions only to their declared frame kinds', () => {
    const prototype = { id: 'p', type: 'prototype' }
    const component = { id: 'c', type: 'component' }
    const site = { id: 's', type: 'site-frame' }

    const theme = getMultiSelectionFeatures([prototype, component]).find(entry => entry.feature.id === 'frame-theme')
    expect(theme?.feature.multiSelection).toEqual({ exclusive: false })
    expect(theme?.widgetIds).toEqual(['p', 'c'])
    expect(getMultiSelectionFeatures([prototype, site]).find(entry => entry.feature.id === 'frame-theme')?.widgetIds).toEqual(['p'])

    const device = getMultiSelectionFeatures([prototype, site]).find(entry => entry.feature.id === 'frame-device')
    expect(device?.feature.multiSelection).toEqual({ exclusive: false })
    expect(device?.widgetIds).toEqual(['p', 's'])
    expect(getMultiSelectionFeatures([prototype, component]).find(entry => entry.feature.id === 'frame-device')?.widgetIds).toEqual(['p'])

    const story = { id: 'story', type: 'story' }
    const set = { id: 'set', type: 'component-set' }
    expect(getMultiSelectionFeatures([prototype, component, story, set, site]).find(entry => entry.feature.id === 'frame-theme')?.widgetIds).toEqual(['p', 'c', 'story', 'set'])

    const mixed = getMultiSelectionFeatures([prototype, component, site])
    expect(mixed.find(entry => entry.feature.id === 'frame-theme')?.widgetIds).toEqual(['p', 'c'])
    expect(mixed.find(entry => entry.feature.id === 'frame-device')?.widgetIds).toEqual(['p', 's'])
  })

  it('requires explicit opt-in, including for otherwise matching controls', () => {
    register([{ ...feature, multiSelection: undefined }])
    expect(getMultiSelectionFeatures(selected)).toEqual([])
  })

  it('defaults omitted exclusive to true and accepts explicit true', () => {
    register([feature], [{ ...feature, multiSelection: { exclusive: true } }])
    expect(getMultiSelectionFeatures(selected)[0].widgetIds).toEqual(['a', 'b'])
    register([feature], [])
    expect(getMultiSelectionFeatures(selected)).toEqual([])
  })

  it('allows only supporting selected targets when exclusive is false', () => {
    const subset = { ...feature, multiSelection: { exclusive: false } }
    register([subset], [])
    registerWidget('unselected', { features: [subset] })
    expect(getMultiSelectionFeatures(selected)).toEqual([{ feature: subset, widgetIds: ['a'] }])
  })

  it('preserves toolbar and production guards', () => {
    register([
      feature,
      { ...feature, id: 'public', prod: true },
      { ...feature, id: 'fullbar', prod: true, surfaces: ['fullbar'] },
    ])
    expect(getMultiSelectionFeatures(selected, { isLocalDev: false }).map(item => item.feature.id)).toEqual(['public'])
    expect(getMultiSelectionFeatures(selected).map(item => item.feature.id)).toEqual(['color', 'public'])
  })

  it.each([{ disabled: true }, { enabled: false }])('does not target an unavailable control: %j', guard => {
    register([feature], [{ ...feature, ...guard }])
    expect(getMultiSelectionFeatures(selected)).toEqual([])
    register([{ ...feature, multiSelection: { exclusive: false } }], [{ ...feature, ...guard }])
    expect(getMultiSelectionFeatures(selected)[0].widgetIds).toEqual(['a'])
  })

  it.each([
    { prop: 'background' },
    { type: 'action', action: 'color' },
    { options: ['red'] },
  ])('does not merge matching labels with incompatible behavior: %j', override => {
    register([feature], [{ ...feature, ...override }])
    expect(getMultiSelectionFeatures(selected)).toEqual([])
  })

  it('compares static dropdown item actions and alt actions, regardless of key order', () => {
    const menu = { id: 'commands', type: 'dropdown', multiSelection: {}, items: [{ label: 'Run', action: 'run', alt: { label: 'Stop', action: 'stop' } }] }
    register([menu], [{ ...menu, items: [{ action: 'run', label: 'Run', alt: { action: 'stop', label: 'Stop' } }] }])
    expect(getMultiSelectionFeatures(selected)[0].widgetIds).toEqual(['a', 'b'])
    register([menu], [{ ...menu, items: [{ label: 'Run', action: 'remove' }] }])
    expect(getMultiSelectionFeatures(selected)).toEqual([])
  })

  it('leaves widget-owned runtime menus and unsupported render types individual', () => {
    register([
      { id: 'runtime', type: 'dropdown', content: 'widget', multiSelection: {} },
      { id: 'roles', type: 'role-selector', multiSelection: {} },
    ])
    expect(getMultiSelectionFeatures(selected)).toEqual([])
  })

  it('keeps different subset action signatures separate and deduplicates targets', () => {
    const action = { id: 'run', label: 'Run', type: 'action', action: 'run', multiSelection: { exclusive: false } }
    register([action, action], [{ ...action, action: 'stop' }])
    expect(getMultiSelectionFeatures([...selected, selected[0]]).map(({ feature, widgetIds }) => [feature.action, widgetIds]))
      .toEqual([['run', ['a']], ['stop', ['b']]])
  })
})

describe('isEditableInProduction', () => {
  afterEach(() => {
    _resetCanvasConfig()
  })

  it('returns false by default for markdown and sticky-note', () => {
    expect(isEditableInProduction('markdown')).toBe(false)
    expect(isEditableInProduction('sticky-note')).toBe(false)
  })

  it('returns false for unrelated widget types regardless of config', () => {
    initCanvasConfig({ production: { editMarkdown: true, editSticky: true } })
    expect(isEditableInProduction('prototype')).toBe(false)
    expect(isEditableInProduction('image')).toBe(false)
    expect(isEditableInProduction('unknown')).toBe(false)
  })

  it('opts markdown into production editing when editMarkdown is true', () => {
    initCanvasConfig({ production: { editMarkdown: true } })
    expect(isEditableInProduction('markdown')).toBe(true)
    expect(isEditableInProduction('sticky-note')).toBe(false)
  })

  it('opts sticky-note into production editing when editSticky is true', () => {
    initCanvasConfig({ production: { editSticky: true } })
    expect(isEditableInProduction('sticky-note')).toBe(true)
    expect(isEditableInProduction('markdown')).toBe(false)
  })
})
