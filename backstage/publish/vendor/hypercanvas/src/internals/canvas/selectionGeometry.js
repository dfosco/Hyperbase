/** Bounds of the actual selected widgets, including any existing overlap. */
export function getSelectionBounds(items) {
  if (!items.length) return null
  const x = Math.min(...items.map((item) => item.position.x))
  const y = Math.min(...items.map((item) => item.position.y))
  return {
    x,
    y,
    width: Math.max(...items.map((item) => item.position.x + item.width)) - x,
    height: Math.max(...items.map((item) => item.position.y + item.height)) - y,
  }
}

/**
 * Explicit row/column arrangement in document order. Every row starts at the
 * selection's left edge; shared column/row sizes leave each widget unchanged.
 */
export function arrangeSelectionGrid(items, { gap = 40, boundaryPad = 0 } = {}) {
  const placements = new Map()
  const bounds = getSelectionBounds(items)
  if (!bounds) return placements
  const columns = Math.ceil(Math.sqrt(items.length))
  const columnWidths = Array(columns).fill(0)
  const rowHeights = Array(Math.ceil(items.length / columns)).fill(0)
  for (const [index, item] of items.entries()) {
    columnWidths[index % columns] = Math.max(columnWidths[index % columns], item.width)
    rowHeights[Math.floor(index / columns)] = Math.max(rowHeights[Math.floor(index / columns)], item.height)
  }
  const spacing = Math.max(0, gap)
  const xs = [Math.ceil(Math.max(bounds.x, boundaryPad))]
  const ys = [Math.ceil(Math.max(bounds.y, boundaryPad))]
  for (let column = 1; column < columns; column++) xs.push(xs[column - 1] + Math.ceil(columnWidths[column - 1] + spacing))
  for (let row = 1; row < rowHeights.length; row++) ys.push(ys[row - 1] + Math.ceil(rowHeights[row - 1] + spacing))
  for (const [index, item] of items.entries()) {
    placements.set(item.id, { x: xs[index % columns], y: ys[Math.floor(index / columns)] })
  }
  return placements
}
