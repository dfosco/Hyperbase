import { describe, expect, it } from 'vitest'
import { planCanvasRows } from './canvasRowPlanner.js'

const input = (overrides = {}) => ({
  widgets: [
    { id: 'right', position: { x: 600, y: 100 }, width: 500, height: 90 },
    { id: 'top', position: { x: 300, y: 20 }, width: 320, height: 120 },
    { id: 'left', position: { x: 20, y: 100 }, width: 400, height: 80 },
  ],
  storedSources: [
    { export: 'PrimaryButtons', position: { x: 20, y: 210 }, width: 560, height: 400, owner: 'source file' },
  ],
  sourceDiscovery: {
    complete: true,
    binding: 'canvas-a:module-a:importer-a',
    sources: [
      { export: 'PrimaryButtons', position: { x: 20, y: 210 }, width: 560, height: 400 },
      { export: 'DangerButtons', position: { x: 100, y: 200 }, width: 300, height: 120 },
    ],
  },
  currentBinding: 'canvas-a:module-a:importer-a',
  viewportWidth: 1000,
  sidebarWidth: 240,
  zoom: 1,
  ...overrides,
})

describe('planCanvasRows', () => {
  it('includes all JSON widgets, stored sources, and exports discovered from the current binding', () => {
    const plan = planCanvasRows(input())

    expect(plan.widgets.map(({ id }) => id)).toEqual(['top', 'left', 'right'])
    expect(plan.sources.map(({ export: name }) => name)).toEqual(['DangerButtons', 'PrimaryButtons'])
    expect(plan.widgets).toHaveLength(input().widgets.length)
    expect(plan.sources).toHaveLength(input().storedSources.length + input().sourceDiscovery.sources.length - 1)
  })

  it('uses reading order and produces one stable vertical column', () => {
    const plan = planCanvasRows(input())
    const rows = [...plan.widgets, ...plan.sources]
      .map((item) => ({ id: item.id || item.export, x: item.position.x, y: item.position.y }))
      .sort((a, b) => a.y - b.y)

    expect(rows.map(({ id }) => id)).toEqual(['top', 'left', 'right', 'DangerButtons', 'PrimaryButtons'])
    expect(new Set(rows.map(({ x }) => x)).size).toBe(1)
    expect(rows.map(({ y }) => y)).toEqual([24, 168, 272, 386, 530])
  })

  it('constrains oversized rows using viewport, sidebar, and zoom while preserving feasible sizes', () => {
    const plan = planCanvasRows(input({ viewportWidth: 1000, sidebarWidth: 240, zoom: 2 }))

    expect(plan.widgets.find(({ id }) => id === 'top')).toMatchObject({ width: 320, height: 120 })
    expect(plan.widgets.find(({ id }) => id === 'left')).toMatchObject({ width: 356, height: 80 })
    expect(plan.sources.find(({ export: name }) => name === 'PrimaryButtons')).toMatchObject({ width: 356, height: 400 })
    expect(plan.widgets[0].position).toEqual({ x: 12, y: 12 })
  })

  it('prefers persisted geometry for discovered exports and uses discovered geometry for new exports', () => {
    const args = input({ viewportWidth: 1400, sidebarWidth: 240 })
    const plan = planCanvasRows(args)

    expect(plan.sources.find(({ export: name }) => name === 'PrimaryButtons')).toMatchObject({ width: 560, height: 400 })
    expect(plan.sources.find(({ export: name }) => name === 'DangerButtons')).toMatchObject({ width: 300, height: 120 })
  })

  it('fills missing stored geometry from the current measured discovery', () => {
    const args = input({
      storedSources: [{ export: 'PrimaryButtons', owner: 'preserved metadata' }],
    })
    const plan = planCanvasRows(args)
    expect(plan.sources.find(({ export: name }) => name === 'PrimaryButtons')).toMatchObject({ width: 560, height: 400 })
  })

  it('rejects stale binding discovery before returning a plan', () => {
    expect(() => planCanvasRows(input({ currentBinding: 'canvas-b:module-a:importer-a' })))
      .toThrow(/does not match the current/)
  })

  it('rejects a viewport that cannot fit the minimum row width', () => {
    expect(() => planCanvasRows(input({ viewportWidth: 300, sidebarWidth: 180 })))
      .toThrow(/minimum row width/)
  })

  it('rejects incomplete or ambiguous required entries without mutating inputs', () => {
    const args = input({
      widgets: [...input().widgets, { id: 'broken', position: { x: 0, y: 0 }, width: Infinity, height: 20 }],
    })
    const before = structuredClone(args)

    expect(() => planCanvasRows(args)).toThrow(/invalid size for widget:broken/)
    expect(args).toEqual(before)
    expect(() => planCanvasRows(input({
      sourceDiscovery: {
        complete: true,
        binding: 'canvas-a:module-a:importer-a',
        sources: [
          { export: 'PrimaryButtons', position: { x: 20, y: 210 }, width: 560, height: 400 },
          { export: 'PrimaryButtons', position: { x: 20, y: 210 }, width: 560, height: 400 },
        ],
      },
    }))).toThrow(/missing or ambiguous/)
    expect(() => planCanvasRows(input({
      sourceDiscovery: {
        complete: true,
        binding: 'canvas-a:module-a:importer-a',
        sources: [{ export: 'DangerButtons', position: { x: 100, y: 200 }, width: 300, height: 120 }],
      },
    }))).toThrow(/omitted required stored export/)
  })
})
