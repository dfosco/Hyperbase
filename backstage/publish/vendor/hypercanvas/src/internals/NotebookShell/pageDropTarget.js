const DROP_EDGE_SIZE = 6

/** Return an insertion edge only when the pointer is near a page row boundary. */
export function getPageDropSide(clientY, bounds, edgeSize = DROP_EDGE_SIZE) {
  if (clientY >= bounds.top && clientY <= bounds.top + edgeSize) return 'before'
  if (clientY <= bounds.bottom && clientY >= bounds.bottom - edgeSize) return 'after'
  return null
}
