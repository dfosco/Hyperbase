import { afterEach, describe, expect, it, vi } from 'vitest'
import { addWidget, patchWidget, updateCanvasLayout } from './canvasApi.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('widget persistence', () => {
  it('forwards creation placement intent and all returned undo/peer events through the branch route', async () => {
    vi.stubEnv('BASE_URL', '/branch--creation/')
    const result = { success: true, eventId: 'added', eventIds: ['moved', 'added'], placementEvents: [{ event: 'widget_moved', widgetId: 'peer', position: { x: 100, y: 100 } }] }
    const fetch = vi.fn().mockResolvedValue({ json: async () => result })
    vi.stubGlobal('fetch', fetch)
    const options = { type: 'prototype', props: { url: '/fixture' }, position: { x: 320, y: 100 }, near: false, direction: 'right', resolve: true, gap: 2, source: 'agent-fixture', pool: 'cold' }

    await expect(addWidget('welcome', options)).resolves.toEqual(result)
    expect(fetch).toHaveBeenCalledWith('/branch--creation/_hypercanvas/canvas/widget', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ name: 'welcome', ...options }),
    }))
  })

  it('returns acknowledged changes through the branch-prefixed Core route', async () => {
    vi.stubEnv('BASE_URL', '/branch--rename/')
    const result = { success: true, eventIds: ['saved-event'] }
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => result })
    vi.stubGlobal('fetch', fetch)

    await expect(patchWidget('welcome', 'file-1', { props: { path: 'assets/renamed.txt' } })).resolves.toEqual(result)
    expect(fetch).toHaveBeenCalledWith('/branch--rename/_hypercanvas/canvas/widget', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ name: 'welcome', widgetId: 'file-1', props: { path: 'assets/renamed.txt' } }),
    }))
  })

  it('rejects a failed PATCH instead of reporting an unsaved reference as complete', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Widget not found' }) }))
    await expect(patchWidget('welcome', 'gone', { props: { path: 'assets/renamed.txt' } })).rejects.toThrow('Widget not found')
  })
})

describe('canvas layout persistence', () => {
  it('uses the existing batch endpoint with a single revision-bound operation', async () => {
    vi.stubEnv('BASE_URL', '/branch--layout/')
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, eventId: 'layout-event' }) })
    vi.stubGlobal('fetch', fetch)
    const layout = { scroll: { axis: 'vertical' }, widgets: [], sources: [] }
    const sourceBinding = { canvasId: 'notes', jsxReference: './components.jsx' }
    await expect(updateCanvasLayout('notes', 'a'.repeat(64), layout, sourceBinding)).resolves.toMatchObject({ status: 200, ok: true })
    expect(fetch).toHaveBeenCalledWith('/branch--layout/_hypercanvas/canvas/batch', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        name: 'notes',
        operations: [{ op: 'update-layout', expectedRevision: 'a'.repeat(64), layout, sourceBinding }],
      }),
    }))
  })
})
