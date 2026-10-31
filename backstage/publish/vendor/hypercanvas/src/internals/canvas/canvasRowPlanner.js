const DEFAULT_PADDING = 24
const DEFAULT_GAP = 24
const DEFAULT_MIN_ROW_WIDTH = 160

const isFinitePositive = (value) => Number.isFinite(value) && value > 0

const assertGeometry = (item, identity) => {
  if (!item || !item.position || !Number.isFinite(item.position.x) || !Number.isFinite(item.position.y)) {
    throw new Error(`Canvas row planner received invalid position for ${identity}`)
  }
  if (!isFinitePositive(item.width) || !isFinitePositive(item.height)) {
    throw new Error(`Canvas row planner received invalid size for ${identity}`)
  }
}

const compareReadingOrder = (a, b) => {
  const byPosition = a.position.y - b.position.y || a.position.x - b.position.x
  if (byPosition) return byPosition
  return a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0
}

/**
 * Plan a complete, deterministic vertical row snapshot without mutating canvas state.
 *
 * `sourceDiscovery` must come from the resolver for `currentBinding`. This planner
 * deliberately accepts resolved source descriptors, not export names from an
 * event or client snapshot. The authoring writer remains responsible for resolving
 * and revalidating the binding before committing the returned snapshot.
 */
export function planCanvasRows({
  widgets,
  storedSources,
  sourceDiscovery,
  currentBinding,
  viewportWidth,
  sidebarWidth = 0,
  zoom = 1,
  padding = DEFAULT_PADDING,
  gap = DEFAULT_GAP,
  minRowWidth = DEFAULT_MIN_ROW_WIDTH,
}) {
  if (!Array.isArray(widgets) || !Array.isArray(storedSources)) {
    throw new Error('Canvas row planner requires widget and stored source arrays')
  }
  if (!sourceDiscovery || sourceDiscovery.complete !== true
    || !Array.isArray(sourceDiscovery.sources) || !sourceDiscovery.binding) {
    throw new Error('Canvas row planner requires resolved source discovery for the current binding')
  }
  if (sourceDiscovery.binding !== currentBinding) {
    throw new Error('Canvas source discovery does not match the current canvas/module/importer binding')
  }
  if (!isFinitePositive(viewportWidth) || !Number.isFinite(sidebarWidth) || sidebarWidth < 0
    || !isFinitePositive(zoom) || !Number.isFinite(padding) || padding < 0
    || !Number.isFinite(gap) || gap < 0 || !isFinitePositive(minRowWidth)) {
    throw new Error('Canvas row planner received impossible viewport constraints')
  }

  const availableScreenWidth = viewportWidth - sidebarWidth - 2 * padding
  const maxRowWidth = availableScreenWidth / zoom
  if (!Number.isFinite(maxRowWidth) || maxRowWidth < minRowWidth) {
    throw new Error('Canvas row planner cannot fit the minimum row width in the available viewport')
  }

  const widgetIds = new Set()
  const sourceExports = new Set()
  const entries = []

  for (const widget of widgets) {
    const identity = `widget:${widget?.id ?? '<missing>'}`
    if (typeof widget?.id !== 'string' || !widget.id || widgetIds.has(widget.id)) {
      throw new Error(`Canvas row planner received a missing or duplicate widget identity: ${identity}`)
    }
    widgetIds.add(widget.id)
    assertGeometry(widget, identity)
    entries.push({
      kind: 'widget',
      key: widget.id,
      identity,
      position: widget.position,
      width: widget.width,
      height: widget.height,
    })
  }

  const sourceByExport = new Map()
  for (const source of storedSources) {
    const identity = `source:${source?.export ?? '<missing>'}`
    if (typeof source?.export !== 'string' || !source.export || sourceByExport.has(source.export)) {
      throw new Error(`Canvas row planner received a missing or duplicate source identity: ${identity}`)
    }
    if (source.position !== undefined
      && (!source.position || !Number.isFinite(source.position.x) || !Number.isFinite(source.position.y))) {
      throw new Error(`Canvas row planner received invalid position for ${identity}`)
    }
    if (source.width !== undefined && !isFinitePositive(source.width)) {
      throw new Error(`Canvas row planner received invalid size for ${identity}`)
    }
    if (source.height !== undefined && !isFinitePositive(source.height)) {
      throw new Error(`Canvas row planner received invalid size for ${identity}`)
    }
    sourceByExport.set(source.export, source)
  }

  for (const discovered of sourceDiscovery.sources) {
    const identity = `source:${discovered?.export ?? '<missing>'}`
    if (typeof discovered?.export !== 'string' || !discovered.export || sourceExports.has(discovered.export)) {
      throw new Error(`Canvas source discovery is missing or ambiguous: ${identity}`)
    }
    sourceExports.add(discovered.export)
    assertGeometry(discovered, identity)
    const stored = sourceByExport.get(discovered.export)
    const source = stored
      ? {
        ...discovered,
        ...stored,
        position: stored.position ?? discovered.position,
        width: stored.width ?? discovered.width,
        height: stored.height ?? discovered.height,
      }
      : discovered
    entries.push({
      kind: 'source',
      key: discovered.export,
      identity,
      position: source.position,
      width: source.width,
      height: source.height,
    })
  }

  for (const source of storedSources) {
    if (!sourceExports.has(source.export)) {
      throw new Error(`Canvas source discovery omitted required stored export: ${source.export}`)
    }
  }

  entries.sort(compareReadingOrder)

  const planned = { widgets: [], sources: [] }
  const left = padding / zoom
  let y = padding / zoom
  const rowGap = gap / zoom

  for (const entry of entries) {
    const item = {
      [entry.kind === 'widget' ? 'id' : 'export']: entry.key,
      position: { x: left, y },
      width: Math.min(entry.width, maxRowWidth),
      height: entry.height,
    }
    planned[entry.kind === 'widget' ? 'widgets' : 'sources'].push(item)
    y += entry.height + rowGap
  }

  return planned
}
