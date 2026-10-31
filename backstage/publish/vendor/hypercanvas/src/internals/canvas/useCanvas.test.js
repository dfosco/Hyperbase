import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { getCanvasData } from '../../core/index.js'
import { storyboardWs } from '../storyboard-ws.js'
import { resolveCanvasModuleImport, useCanvas } from './useCanvas.js'

const { subscribers } = vi.hoisted(() => ({ subscribers: new Map() }))
vi.mock('../../core/index.js', () => ({ getCanvasData: vi.fn() }))
vi.mock('../storyboard-ws.js', () => ({ storyboardWs: {
  on: vi.fn((event, callback) => subscribers.set(event, callback)),
  off: vi.fn((event, callback) => {
    if (subscribers.get(event) === callback) subscribers.delete(event)
  }),
} }))

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
function response(data) {
  return { ok: true, headers: { get: () => 'application/json' }, json: async () => data }
}

beforeEach(() => {
  subscribers.clear()
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())

describe('resolveCanvasModuleImport', () => {
  it('prefixes root-relative module paths with BASE_URL', () => {
    expect(resolveCanvasModuleImport('/src/canvas/button-patterns.story.jsx', '/feature-branch/')).toBe(
      '/feature-branch/src/canvas/button-patterns.story.jsx',
    )
  })

  it('keeps root-relative paths unchanged when BASE_URL is root', () => {
    expect(resolveCanvasModuleImport('/src/canvas/button-patterns.story.jsx', '/')).toBe(
      '/src/canvas/button-patterns.story.jsx',
    )
  })

  it('returns relative paths as-is', () => {
    expect(resolveCanvasModuleImport('./local-module.js', '/feature-branch/')).toBe('./local-module.js')
  })

  it('returns absolute URLs as-is', () => {
    expect(resolveCanvasModuleImport('https://cdn.example.com/module.js', '/feature-branch/')).toBe(
      'https://cdn.example.com/module.js',
    )
  })
})

describe('useCanvas async cleanup', () => {
  it.each(['before', 'after'])('ignores an obsolete StrictMode response arriving %s the active response', async (order) => {
    const obsolete = deferred()
    const current = deferred()
    const build = { _route: '/one', widgets: [], autoPlace: false }
    getCanvasData.mockReturnValue(build)
    const fetchMock = vi.fn().mockReturnValueOnce(obsolete.promise).mockReturnValueOnce(current.promise)
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useCanvas('one'), { reactStrictMode: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    if (order === 'before') {
      await act(async () => { obsolete.resolve(response({ widgets: [{ id: 'obsolete' }], autoPlace: false })) })
      // The cleaned-up mount cannot make the UI interactive while the live
      // mount is still loading its own response.
      expect(result.current.loading).toBe(true)
      expect(result.current.canvas).toBe(build)
    }
    await act(async () => { current.resolve(response({ widgets: [{ id: 'current' }], autoPlace: true })) })
    expect(result.current.loading).toBe(false)
    expect(result.current.canvas).toEqual({ ...build, widgets: [{ id: 'current' }], autoPlace: true })
    if (order === 'after') {
      await act(async () => { obsolete.resolve(response({ widgets: [{ id: 'obsolete' }], autoPlace: false })) })
      expect(result.current.canvas.autoPlace).toBe(true)
      expect(result.current.canvas.widgets).toEqual([{ id: 'current' }])
    }
  })

  it('ignores an old canvas bootstrap response after switching canvas IDs', async () => {
    const old = deferred()
    const current = deferred()
    const builds = { one: { _route: '/one', widgets: [] }, two: { _route: '/two', widgets: [] } }
    getCanvasData.mockImplementation((id) => builds[id])
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise))
    const { result, rerender } = renderHook(({ id }) => useCanvas(id), { initialProps: { id: 'one' } })
    rerender({ id: 'two' })
    await act(async () => { current.resolve(response({ widgets: [{ id: 'two' }] })) })
    await act(async () => { old.resolve(response({ widgets: [{ id: 'one' }] })) })
    expect(result.current.canvas).toEqual({ ...builds.two, widgets: [{ id: 'two' }] })
    expect(result.current.loading).toBe(false)
  })

  it('ignores an old canvas file-change fetch after switching canvas IDs', async () => {
    const obsoleteRefresh = deferred()
    const builds = { one: { _route: '/one', widgets: [] }, two: { _route: '/two', widgets: [] } }
    getCanvasData.mockImplementation((id) => builds[id])
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ widgets: [{ id: 'one' }] }))
      .mockReturnValueOnce(obsoleteRefresh.promise)
      .mockResolvedValueOnce(response({ widgets: [{ id: 'two' }] })))
    const { result, rerender } = renderHook(({ id }) => useCanvas(id), { initialProps: { id: 'one' } })
    await act(async () => {})
    act(() => subscribers.get('storyboard:canvas-file-changed')({ canvasId: 'one' }))
    rerender({ id: 'two' })
    await act(async () => {})
    await act(async () => { obsoleteRefresh.resolve(response({ widgets: [{ id: 'obsolete' }] })) })
    expect(result.current.canvas).toEqual({ ...builds.two, widgets: [{ id: 'two' }] })
    expect(storyboardWs.off).toHaveBeenCalledWith('storyboard:canvas-file-changed', expect.any(Function))
  })

  it('ignores an old JSX import after switching modules', async () => {
    const obsoleteImport = deferred()
    const currentImport = deferred()
    const builds = {
      one: { _route: '/one', _jsxModule: '/one.jsx', _jsxImport: () => obsoleteImport.promise, widgets: [] },
      two: { _route: '/two', _jsxModule: '/two.jsx', _jsxImport: () => currentImport.promise, widgets: [] },
    }
    const Current = () => null
    const Obsolete = () => null
    getCanvasData.mockImplementation((id) => builds[id])
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => response(url.includes('name=one') ? builds.one : builds.two)))
    const { result, rerender } = renderHook(({ id }) => useCanvas(id), { initialProps: { id: 'one' } })
    await act(async () => {})
    rerender({ id: 'two' })
    await act(async () => {})
    await act(async () => { currentImport.resolve({ Current }) })
    expect(result.current.jsxExports).toEqual({ Current })
    await act(async () => { obsoleteImport.resolve({ Obsolete }) })
    expect(result.current.jsxExports).toEqual({ Current })
    expect(result.current.jsxError).toBe(false)
  })
})
