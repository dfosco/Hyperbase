import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import useUndoRedo from './useUndoRedo.js'

describe('useUndoRedo (canvas)', () => {
  it('starts with canUndo and canRedo as false', () => {
    const { result } = renderHook(() => useUndoRedo())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('track pushes an event id and enables undo', () => {
    const { result } = renderHook(() => useUndoRedo())
    act(() => result.current.track('evt_a'))
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('popUndo returns the most recent tracked id; pushRedo enables redo', () => {
    const { result } = renderHook(() => useUndoRedo())
    act(() => result.current.track('evt_a'))
    act(() => result.current.track('evt_b'))

    let popped
    act(() => { popped = result.current.popUndo() })

    expect(popped).toBe('evt_b')
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)

    act(() => result.current.pushRedo('evt_b_inv'))
    expect(result.current.canRedo).toBe(true)
  })

  it('popRedo returns the most recent redo id; pushUndo restores undo availability', () => {
    const { result } = renderHook(() => useUndoRedo())
    act(() => result.current.track('evt_a'))
    act(() => { result.current.popUndo() })
    act(() => result.current.pushRedo('evt_a_inv'))

    expect(result.current.canRedo).toBe(true)

    let popped
    act(() => { popped = result.current.popRedo() })
    expect(popped).toBe('evt_a_inv')
    expect(result.current.canRedo).toBe(false)

    act(() => result.current.pushUndo('evt_a_inv_inv'))
    expect(result.current.canUndo).toBe(true)
  })

  it('new track call after undo clears the redo stack', () => {
    const { result } = renderHook(() => useUndoRedo())
    act(() => result.current.track('evt_a'))
    act(() => { result.current.popUndo() })
    act(() => result.current.pushRedo('evt_a_inv'))
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.track('evt_b'))
    expect(result.current.canRedo).toBe(false)
    expect(result.current.canUndo).toBe(true)
  })

  it('trackMany pushes multiple ids and clears redo', () => {
    const { result } = renderHook(() => useUndoRedo())
    act(() => result.current.trackMany(['evt_a', 'evt_b', 'evt_c']))
    expect(result.current.canUndo).toBe(true)
    let popped
    act(() => { popped = result.current.popUndo() })
    expect(popped).toBe('evt_c')
  })

  it('ignores empty / non-string ids', () => {
    const { result } = renderHook(() => useUndoRedo())
    act(() => result.current.track(null))
    act(() => result.current.track(undefined))
    act(() => result.current.track(''))
    act(() => result.current.track(42))
    expect(result.current.canUndo).toBe(false)
  })

  it('reset clears both stacks', () => {
    const { result } = renderHook(() => useUndoRedo())
    act(() => result.current.track('evt_a'))
    act(() => { result.current.popUndo() })
    act(() => result.current.pushRedo('evt_a_inv'))

    act(() => result.current.reset())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('popUndo on empty stack returns null', () => {
    const { result } = renderHook(() => useUndoRedo())
    let popped
    act(() => { popped = result.current.popUndo() })
    expect(popped).toBeNull()
  })
  it('keeps a batch as one history entry through Undo and Redo', () => {
    const { result } = renderHook(() => useUndoRedo())
    act(() => result.current.track('prior'))
    act(() => result.current.trackBatch(['move-a', null, 'move-b', 'source-c']))
    let entry
    act(() => { entry = result.current.popUndo() })
    expect(entry).toEqual(['move-a', 'move-b', 'source-c'])
    act(() => result.current.pushRedo(['inverse-c', 'inverse-b', 'inverse-a']))
    act(() => { entry = result.current.popRedo() })
    expect(entry).toEqual(['inverse-c', 'inverse-b', 'inverse-a'])
    act(() => result.current.pushUndo(['redo-a', 'redo-b', 'redo-c']))
    act(() => { entry = result.current.popUndo() })
    expect(entry).toEqual(['redo-a', 'redo-b', 'redo-c'])
    act(() => { entry = result.current.popUndo() })
    expect(entry).toBe('prior')
    expect(result.current.canUndo).toBe(false)
  })

  it('groups only token-tagged events from a shared action dispatch', () => {
    const { result } = renderHook(() => useUndoRedo())
    act(() => result.current.track('before'))
    let token
    act(() => { token = result.current.beginBatch() })
    act(() => result.current.trackMany(['widget-a', 'widget-b'], token))
    act(() => result.current.track('unrelated-widget'))
    act(() => result.current.trackBatch(['source-c'], token))
    act(() => result.current.track('widget-d', token))
    act(() => result.current.endBatch(token))
    act(() => result.current.track('after'))

    let entries
    act(() => { entries = Array.from({ length: 5 }, () => result.current.popUndo()) })
    expect(entries).toEqual([
      'after',
      ['widget-a', 'widget-b', 'source-c', 'widget-d'],
      'unrelated-widget',
      'before',
      null,
    ])
  })

  it('persists bounded history per canvas and restores it after a remount', () => {
    const canvasId = 'undo-persistence-test'
    const key = `__hypercanvas_canvas_undo_redo_v1:${canvasId}`
    localStorage.removeItem(key)
    const first = renderHook(() => useUndoRedo(canvasId))
    act(() => first.result.current.trackMany(['evt_a', 'evt_b']))
    expect(JSON.parse(localStorage.getItem(key))).toEqual({ undo: ['evt_a', 'evt_b'], redo: [] })
    first.unmount()

    const second = renderHook(() => useUndoRedo(canvasId))
    expect(second.result.current.canUndo).toBe(true)
    let popped
    act(() => { popped = second.result.current.popUndo() })
    expect(popped).toBe('evt_b')
    expect(JSON.parse(localStorage.getItem(key))).toEqual({ undo: ['evt_a'], redo: [] })
    second.unmount()
    localStorage.removeItem(key)
  })

  it('keeps histories isolated when switching canvas ids', () => {
    const { result, rerender } = renderHook(({ canvasId }) => useUndoRedo(canvasId), { initialProps: { canvasId: 'canvas-a' } })
    act(() => result.current.track('evt_a'))
    rerender({ canvasId: 'canvas-b' })
    expect(result.current.canUndo).toBe(false)
    act(() => result.current.track('evt_b'))
    rerender({ canvasId: 'canvas-a' })
    expect(result.current.canUndo).toBe(true)
    let popped
    act(() => { popped = result.current.popUndo() })
    expect(popped).toBe('evt_a')
    localStorage.removeItem('__hypercanvas_canvas_undo_redo_v1:canvas-a')
    localStorage.removeItem('__hypercanvas_canvas_undo_redo_v1:canvas-b')
  })
})
