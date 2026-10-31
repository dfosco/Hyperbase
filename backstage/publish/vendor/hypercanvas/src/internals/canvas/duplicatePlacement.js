import { AUTO_PLACE_DEFAULTS } from '../../core/stores/canvasConfig.js'
import { getAutoPlacePreview } from './autoPlace.js'
import { getSelectionBounds } from './selectionGeometry.js'

// Historical duplication advances by this offset only when a top-left position
// is already occupied. Rectangle overlap is intentional when Autoplace is off.
const LEGACY_DUPLICATE_OFFSET = 40

const point = (item) => item.position ?? item
const flat = (item) => ({ id: item.id, ...point(item), width: item.width, height: item.height })
const overlapArea = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))

/** Compare visible fit before occupancy: blocked peers can move, viewport edges cannot. */
function availableSpace(rects, blockers, viewport) {
  return rects.reduce((total, rect) => {
    const visible = viewport ? {
      x: Math.max(rect.x, viewport.left),
      y: Math.max(rect.y, viewport.top),
      width: Math.max(0, Math.min(rect.x + rect.width, viewport.right) - Math.max(rect.x, viewport.left)),
      height: Math.max(0, Math.min(rect.y + rect.height, viewport.bottom) - Math.max(rect.y, viewport.top)),
    } : rect
    const blocked = blockers.reduce((area, blocker) => area + overlapArea(visible, blocker), 0)
    total.visible += visible.width * visible.height
    total.free += Math.max(0, visible.width * visible.height - blocked)
    return total
  }, { visible: 0, free: 0 })
}

/**
 * Plan duplicate geometry without mutating sources. Autoplace copies stay rigid
 * and aligned beside the selection; only other stationary widgets make room.
 * Callers persist creation and stationary placements together as one command.
 */
export function planDuplicatePlacement({ moving, stationary = [], autoPlaceEnabled, nudgeOffsets, viewport, boundaryPad = 0 }) {
  const positions = new Map()
  const stationaryPlacements = new Map()
  if (!moving.length) return { positions, stationaryPlacements, direction: autoPlaceEnabled ? 'right' : 'offset' }
  const sourceIds = new Set(moving.map((item) => item.id))
  const blockers = stationary.filter((item) => !sourceIds.has(item.id)).map(flat)

  if (!autoPlaceEnabled) {
    const occupied = new Set(stationary.map((item) => `${point(item).x},${point(item).y}`))
    let offset = LEGACY_DUPLICATE_OFFSET
    while (moving.some((item) => occupied.has(`${item.position.x + offset},${item.position.y + offset}`))) offset += LEGACY_DUPLICATE_OFFSET
    for (const item of moving) positions.set(item.id, { x: item.position.x + offset, y: item.position.y + offset })
    return { positions, stationaryPlacements, direction: 'offset' }
  }

  const gap = nudgeOffsets?.overlap?.['overlap-nudge-offset'] ?? nudgeOffsets?.['overlap-nudge-offset'] ?? AUTO_PLACE_DEFAULTS.overlap['overlap-nudge-offset']
  const bounds = getSelectionBounds(moving)
  const candidate = (x, y) => {
    const dx = Math.max(x, boundaryPad - bounds.x)
    const dy = Math.max(y, boundaryPad - bounds.y)
    return moving.map((item) => ({ ...flat(item), x: item.position.x + dx, y: item.position.y + dy }))
  }
  const right = candidate(bounds.width + gap, 0)
  const below = candidate(0, bounds.height + gap)
  const rightSpace = availableSpace(right, blockers, viewport)
  const belowSpace = availableSpace(below, blockers, viewport)
  const direction = belowSpace.visible > rightSpace.visible ||
    (belowSpace.visible === rightSpace.visible && belowSpace.free > rightSpace.free) ? 'below' : 'right'
  const desired = direction === 'right' ? right : below
  const allIds = new Set([...sourceIds, ...stationary.map((item) => item.id)])
  const copies = desired.map((item, index) => {
    let id = `__duplicate-${index}`
    while (allIds.has(id)) id = `_${id}`
    allIds.add(id)
    return { id, position: { x: item.x, y: item.y }, width: item.width, height: item.height }
  })
  const result = getAutoPlacePreview({
    moving: copies,
    stationary: [...moving.map(flat), ...blockers],
    fixedStationaryIds: [...sourceIds],
    primaryId: copies[0].id,
    primaryPosition: copies[0].position,
    preserveMovingOffsets: true,
    boundaryPad,
    // Duplication has an explicit stationary-displacement policy. Proximity
    // alignment cannot pull an already aligned copy into a diagonal staircase.
    nudgeOffsets: {
      align: { 'top-edge-nudge-offset': 0, 'left-edge-nudge-offset': 0 },
      overlap: {
        'overlap-nudge-trigger': 0,
        'overlap-nudge-offset': gap,
        'overlap-place-stationary': true,
        'overlap-place-multiselection': true,
      },
    },
  })
  for (const [index, item] of moving.entries()) positions.set(item.id, result.placements.get(copies[index].id))
  for (const item of blockers) {
    const position = result.placements.get(item.id)
    if (position) stationaryPlacements.set(item.id, position)
  }
  return { positions, stationaryPlacements, direction }
}
