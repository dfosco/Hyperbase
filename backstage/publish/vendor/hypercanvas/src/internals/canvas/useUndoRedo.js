import { useRef, useState, useCallback, useEffect } from 'react'

const MAX_HISTORY = 100
const STORAGE_PREFIX = '__hypercanvas_canvas_undo_redo_v1:'

function normalizeEntry(entry) {
  if (typeof entry === 'string' && entry) return entry
  if (Array.isArray(entry)) {
    const ids = entry.filter((id) => typeof id === 'string' && id)
    return ids.length ? ids : null
  }
  return null
}

function readHistory(canvasId) {
  if (!canvasId || typeof window === 'undefined') return { undo: [], redo: [] }
  try {
    const value = JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}${canvasId}`) || 'null')
    if (!value || !Array.isArray(value.undo) || !Array.isArray(value.redo)) return { undo: [], redo: [] }
    return {
      undo: value.undo.map(normalizeEntry).filter(Boolean).slice(-MAX_HISTORY),
      redo: value.redo.map(normalizeEntry).filter(Boolean).slice(-MAX_HISTORY),
    }
  } catch {
    return { undo: [], redo: [] }
  }
}

function persistHistory(canvasId, undo, redo) {
  if (!canvasId || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${canvasId}`, JSON.stringify({
      undo: undo.slice(-MAX_HISTORY),
      redo: redo.slice(-MAX_HISTORY),
    }))
  } catch { /* storage can be unavailable in private or quota-limited contexts */ }
}

/** Per-canvas event-id history, persisted so reloads retain undo/redo. */
export default function useUndoRedo(canvasId) {
  const historyRef = useRef({ canvasId, ...readHistory(canvasId) })
  const batchSequenceRef = useRef(0)
  const batchStackRef = useRef([])
  const [counts, setCounts] = useState(() => {
    const history = readHistory(canvasId)
    return { undo: history.undo.length, redo: history.redo.length }
  })

  const stacks = useCallback(() => {
    if (historyRef.current.canvasId !== canvasId) {
      historyRef.current = { canvasId, ...readHistory(canvasId) }
    }
    return historyRef.current
  }, [canvasId])

  useEffect(() => {
    const history = stacks()
    setCounts({ undo: history.undo.length, redo: history.redo.length })
  }, [canvasId, stacks])

  const syncCounts = useCallback(() => {
    const history = stacks()
    persistHistory(canvasId, history.undo, history.redo)
    setCounts({ undo: history.undo.length, redo: history.redo.length })
  }, [canvasId, stacks])

  const record = useCallback((entry, batchToken) => {
    const normalized = normalizeEntry(entry)
    if (!normalized) return
    const batch = batchToken
      ? batchStackRef.current.find((candidate) => candidate.token === batchToken)
      : null
    if (batch) {
      batch.eventIds.push(...(Array.isArray(normalized) ? normalized : [normalized]))
      return
    }
    const history = stacks()
    history.undo.push(normalized)
    if (history.undo.length > MAX_HISTORY) history.undo.shift()
    history.redo = []
    syncCounts()
  }, [stacks, syncCounts])

  const track = useCallback((eventId, batchToken) => {
    if (!eventId || typeof eventId !== 'string') return
    record(eventId, batchToken)
  }, [record])

  const trackMany = useCallback((eventIds, batchToken) => {
    if (!Array.isArray(eventIds)) return
    const ids = eventIds.filter((id) => typeof id === 'string' && id)
    if (!ids.length) return
    if (batchToken) {
      record(ids, batchToken)
      return
    }
    const history = stacks()
    for (const id of ids) {
      history.undo.push(id)
      if (history.undo.length > MAX_HISTORY) history.undo.shift()
    }
    history.redo = []
    syncCounts()
  }, [record, stacks, syncCounts])

  const trackBatch = useCallback((eventIds, batchToken) => {
    const ids = Array.isArray(eventIds) ? eventIds.filter((id) => typeof id === 'string' && id) : []
    if (ids.length) record(ids, batchToken)
  }, [record])

  const beginBatch = useCallback(() => {
    const token = ++batchSequenceRef.current
    batchStackRef.current.push({ token, eventIds: [] })
    return token
  }, [])

  const endBatch = useCallback((token) => {
    const batch = batchStackRef.current.at(-1)
    if (!batch || batch.token !== token) return
    batchStackRef.current.pop()
    if (!batch.eventIds.length) return
    const parent = batchStackRef.current.at(-1)
    if (parent) {
      parent.eventIds.push(...batch.eventIds)
      return
    }
    const history = stacks()
    history.undo.push(batch.eventIds.length === 1 ? batch.eventIds[0] : batch.eventIds)
    if (history.undo.length > MAX_HISTORY) history.undo.shift()
    history.redo = []
    syncCounts()
  }, [stacks, syncCounts])

  const popUndo = useCallback(() => {
    const entry = stacks().undo.pop()
    syncCounts()
    return entry ?? null
  }, [stacks, syncCounts])

  const popRedo = useCallback(() => {
    const entry = stacks().redo.pop()
    syncCounts()
    return entry ?? null
  }, [stacks, syncCounts])

  const pushRedo = useCallback((entry) => {
    const normalized = normalizeEntry(entry)
    if (!normalized) return
    const stack = stacks().redo
    stack.push(normalized)
    if (stack.length > MAX_HISTORY) stack.shift()
    syncCounts()
  }, [stacks, syncCounts])

  const pushUndo = useCallback((entry) => {
    const normalized = normalizeEntry(entry)
    if (!normalized) return
    const stack = stacks().undo
    stack.push(normalized)
    if (stack.length > MAX_HISTORY) stack.shift()
    syncCounts()
  }, [stacks, syncCounts])

  const reset = useCallback(() => {
    const history = stacks()
    history.undo = []
    history.redo = []
    batchStackRef.current = []
    persistHistory(canvasId, history.undo, history.redo)
    setCounts((prev) => prev.undo === 0 && prev.redo === 0 ? prev : { undo: 0, redo: 0 })
  }, [canvasId, stacks])

  return {
    track,
    trackMany,
    trackBatch,
    beginBatch,
    endBatch,
    popUndo,
    popRedo,
    pushRedo,
    pushUndo,
    reset,
    canUndo: counts.undo > 0,
    canRedo: counts.redo > 0,
  }
}
