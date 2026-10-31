import { getAnchorPoint, getWidgetGap } from './connectorGeometry.js'
import { DEFAULT_ORTHOGONAL_PROXIMITY_THRESHOLD } from './widgets/widgetConfig.js'

const ANCHORS = ['top', 'right', 'bottom', 'left']
const VECTOR = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] }
// Keep enough straight line visible beyond the endpoint marker and before the
// rounded corner. With a 10px fillet and 6px endpoint, 36px leaves about 20px
// of visible stem between the widget and the first bend.
const DEFAULT_STEM_LENGTH = 36

function getStemLength(options) {
  return Number.isFinite(options?.stemLength) ? Math.max(0, options.stemLength) : DEFAULT_STEM_LENGTH
}

// Keep obstacle routing based on authored metadata, as before. Anchor points
// and proximity decisions use DOM-aware bounds from connectorGeometry.js.
function obstacleBounds(widget) {
  return {
    x: widget.position?.x ?? 0,
    y: widget.position?.y ?? 0,
    width: widget.props?.width ?? widget.bounds?.width ?? 270,
    height: widget.props?.height ?? widget.bounds?.height ?? 170,
  }
}

function segmentHitsRect(a, b, rect, padding = 8) {
  const left = rect.x - padding
  const right = rect.x + rect.width + padding
  const top = rect.y - padding
  const bottom = rect.y + rect.height + padding
  if (a.x === b.x) return a.x > left && a.x < right && Math.max(Math.min(a.y, b.y), top) < Math.min(Math.max(a.y, b.y), bottom)
  if (a.y === b.y) return a.y > top && a.y < bottom && Math.max(Math.min(a.x, b.x), left) < Math.min(Math.max(a.x, b.x), right)
  return true
}

function intersects(points, obstacles) {
  for (let i = 1; i < points.length; i++) {
    if (obstacles.some((rect) => segmentHitsRect(points[i - 1], points[i], rect))) return true
  }
  return false
}

function simplify(points, preserveIndices = new Set()) {
  const result = []
  for (let index = 0; index < points.length; index++) {
    const point = points[index]
    const previous = result[result.length - 1]
    const before = result[result.length - 2]
    if (previous && point.x === previous.point.x && point.y === previous.point.y) continue
    const continuesStraight = before && (
      (before.point.x === previous.point.x && previous.point.x === point.x) ||
      (before.point.y === previous.point.y && previous.point.y === point.y)
    )
    if (continuesStraight && !preserveIndices.has(index) && !preserveIndices.has(previous.index)) {
      result[result.length - 1] = { point, index }
    } else {
      result.push({ point, index })
    }
  }
  return result.map(({ point }) => point)
}

function routePoints(start, startAnchor, end, endAnchor, obstacles, stemLength = DEFAULT_STEM_LENGTH) {
  const [sx, sy] = VECTOR[startAnchor]
  const [ex, ey] = VECTOR[endAnchor]
  const a = { x: start.x + sx * stemLength, y: start.y + sy * stemLength }
  const b = { x: end.x + ex * stemLength, y: end.y + ey * stemLength }
  const candidates = [
    [start, a, { x: b.x, y: a.y }, b, end],
    [start, a, { x: a.x, y: b.y }, b, end],
    [start, a, { x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }, b, end],
    [start, a, { x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 }, b, end],
  ].map((points) => simplify(points, new Set([1, points.length - 2])))
  return candidates.map((points) => ({
    points,
    blocked: intersects(points, obstacles),
    length: points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - points[i].x) + Math.abs(p.y - points[i].y), 0),
  })).sort((a, b) => Number(a.blocked) - Number(b.blocked) || a.length - b.length || a.points.length - b.points.length)
}

function sharedLength(points, preferredRoutes = []) {
  let total = 0
  for (const route of preferredRoutes) {
    const otherPoints = route?.points || route
    if (!otherPoints?.length) continue
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]
      const b = points[i]
      for (let j = 1; j < otherPoints.length; j++) {
        const c = otherPoints[j - 1]
        const d = otherPoints[j]
        if (a.y === b.y && c.y === d.y && a.y === c.y) {
          total += Math.max(0, Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)))
        } else if (a.x === b.x && c.x === d.x && a.x === c.x) {
          total += Math.max(0, Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)))
        }
      }
    }
  }
  return Math.min(total, 240)
}

function roundedPath(points, radius = 10) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1]
    const current = points[i]
    const next = points[i + 1]
    const beforeLength = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)
    const afterLength = Math.abs(next.x - current.x) + Math.abs(next.y - current.y)
    const r = Math.min(radius, beforeLength / 2, afterLength / 2)
    const before = { x: current.x + Math.sign(previous.x - current.x) * r, y: current.y + Math.sign(previous.y - current.y) * r }
    const after = { x: current.x + Math.sign(next.x - current.x) * r, y: current.y + Math.sign(next.y - current.y) * r }
    d += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

export function buildOrthogonalPreview(startPt, startAnchor, endPt, endAnchor, options) {
  if (!endAnchor) {
    const dx = startPt.x - endPt.x
    const dy = startPt.y - endPt.y
    endAnchor = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'top' : 'bottom')
  }
  return roundedPath(routePoints(startPt, startAnchor, endPt, endAnchor, [], getStemLength(options))[0].points)
}

export function getOrthogonalConnector(connector, widgetMap, preferredAnchors, fixedAnchors = false, preferredRoutes = [], options) {
  const startWidget = widgetMap.get(connector.start?.widgetId)
  const endWidget = widgetMap.get(connector.end?.widgetId)
  if (!startWidget || !endWidget || startWidget.id === endWidget.id || connector.waypoints?.length) return null
  const configuredThreshold = options?.proximityThreshold
  const proximityThreshold = Number.isFinite(configuredThreshold) && configuredThreshold >= 0
    ? configuredThreshold
    : DEFAULT_ORTHOGONAL_PROXIMITY_THRESHOLD
  if (getWidgetGap(startWidget, endWidget) < proximityThreshold) return null
  const obstacles = [...widgetMap.values()]
    .filter((widget) => widget.id !== startWidget.id && widget.id !== endWidget.id)
    .map(obstacleBounds)
  const cached = preferredAnchors
  const candidates = []
  for (const startAnchor of ANCHORS) {
    for (const endAnchor of ANCHORS) {
      if (fixedAnchors && (startAnchor !== connector.start.anchor || endAnchor !== connector.end.anchor)) continue
      const startPt = getAnchorPoint(startWidget, startAnchor)
      const endPt = getAnchorPoint(endWidget, endAnchor)
      const routes = routePoints(startPt, startAnchor, endPt, endAnchor, obstacles, getStemLength(options))
      const cachedPenalty = cached && (cached.startAnchor !== startAnchor || cached.endAnchor !== endAnchor) ? 8 : 0
      const facingPenalty = VECTOR[startAnchor][0] * (endPt.x - startPt.x) + VECTOR[startAnchor][1] * (endPt.y - startPt.y) < 0 ? 40 : 0
      const endFacingPenalty = VECTOR[endAnchor][0] * (startPt.x - endPt.x) + VECTOR[endAnchor][1] * (startPt.y - endPt.y) < 0 ? 40 : 0
      for (const route of routes) {
        const trunkReward = sharedLength(route.points, preferredRoutes) * 0.4
        candidates.push({ startAnchor, endAnchor, startPt, endPt, ...route, score: (route.blocked ? 100000 : 0) + route.length + (route.points.length - 2) * 22 + facingPenalty + endFacingPenalty + cachedPenalty - trunkReward })
      }
    }
  }
  candidates.sort((a, b) => a.score - b.score)
  const best = candidates[0]
  return {
    startAnchor: best.startAnchor,
    endAnchor: best.endAnchor,
    startPt: best.startPt,
    endPt: best.endPt,
    points: best.points,
    d: roundedPath(best.points),
  }
}
