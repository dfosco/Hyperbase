import { describe, expect, it } from 'vitest'
import { planDuplicatePlacement } from './duplicatePlacement.js'

const widget = (id, x, y, width = 100, height = 100) => ({ id, position: { x, y }, width, height })
const source = widget('source', 100, 100)
const offsets = (gap) => ({ overlap: { 'overlap-nudge-offset': gap, 'overlap-place-stationary': false, 'overlap-place-multiselection': false } })
const viewport = { left: 0, top: 0, right: 1000, bottom: 1000 }
const plan = (options = {}) => planDuplicatePlacement({ moving: [source], stationary: [source], autoPlaceEnabled: true, nudgeOffsets: offsets(20), viewport, ...options })

function expectClear(a, b, gap = 0) {
  expect(a.position.x + a.width + gap <= b.position.x || b.position.x + b.width + gap <= a.position.x ||
    a.position.y + a.height + gap <= b.position.y || b.position.y + b.height + gap <= a.position.y,
  `${a.id} and ${b.id} must remain separated`).toBe(true)
}

describe('duplicate placement policy', () => {
  it('prefers aligned right placement and the configured gap when both directions have room', () => {
    const result = plan()
    expect(result.direction).toBe('right')
    expect(result.positions.get('source')).toEqual({ x: 220, y: 100 })
    expect(result.stationaryPlacements.size).toBe(0)
    expect(source.position).toEqual({ x: 100, y: 100 })
  })

  it('uses the existing default zero gap and supports legacy flat configuration', () => {
    expect(plan({ nudgeOffsets: undefined }).positions.get('source')).toEqual({ x: 200, y: 100 })
    expect(plan({ nudgeOffsets: { 'overlap-nudge-offset': 30 } }).positions.get('source')).toEqual({ x: 230, y: 100 })
  })

  it('falls below when the right candidate does not fit the visible canvas', () => {
    const result = plan({ viewport: { left: 0, top: 0, right: 210, bottom: 600 } })
    expect(result.direction).toBe('below')
    expect(result.positions.get('source')).toEqual({ x: 100, y: 220 })
  })

  it('uses below when both fit but its actual unoccupied space is greater', () => {
    const blocker = widget('right-blocker', 220, 100)
    const result = plan({ stationary: [source, blocker] })
    expect(result.direction).toBe('below')
    expect(result.positions.get('source')).toEqual({ x: 100, y: 220 })
    expect(result.stationaryPlacements.size).toBe(0)
  })

  it('still chooses a fitting crowded below candidate over an insufficient right edge and makes room', () => {
    const blocker = widget('below-blocker', 100, 220)
    const result = plan({ stationary: [source, blocker], viewport: { left: 0, top: 0, right: 210, bottom: 600 } })
    expect(result.direction).toBe('below')
    expect(result.positions.get('source')).toEqual({ x: 100, y: 220 })
    expect(result.stationaryPlacements.has('below-blocker')).toBe(true)
    expect(result.stationaryPlacements.has('source')).toBe(false)
    expectClear({ ...blocker, position: result.stationaryPlacements.get('below-blocker') }, source, 20)
    expectClear({ ...blocker, position: result.stationaryPlacements.get('below-blocker') }, { ...source, id: 'copy', position: result.positions.get('source') }, 20)
  })

  it('keeps right preference without a viewport when neither candidate is crowded', () => {
    expect(plan({ viewport: undefined }).direction).toBe('right')
  })

  it('moves a blocking stationary widget instead of changing aligned duplicate or original positions', () => {
    const blocker = widget('blocker', 220, 100)
    const distant = widget('distant', 900, 900)
    const result = plan({ stationary: [source, blocker, distant], viewport: { left: 0, top: 0, right: 600, bottom: 200 } })
    expect(result.direction).toBe('right')
    expect(result.positions.get('source')).toEqual({ x: 220, y: 100 })
    expect(result.stationaryPlacements.has('blocker')).toBe(true)
    expect(result.stationaryPlacements.has('source')).toBe(false)
    expect(result.stationaryPlacements.has('distant')).toBe(false)
    const moved = { ...blocker, position: result.stationaryPlacements.get('blocker') }
    expectClear(moved, source, 20)
    expectClear(moved, { ...source, id: 'copy', position: result.positions.get('source') }, 20)
    expect(blocker.position).toEqual({ x: 220, y: 100 })
  })

  it('clears a crowded stationary chain while protecting original source geometry', () => {
    const blockers = [widget('one', 220, 100), widget('two', 340, 100), widget('three', 460, 100)]
    const result = plan({ stationary: [source, ...blockers], viewport: { left: 0, top: 0, right: 700, bottom: 200 } })
    const final = [source, { ...source, id: 'copy', position: result.positions.get('source') },
      ...blockers.map((item) => ({ ...item, position: result.stationaryPlacements.get(item.id) ?? item.position }))]
    for (let i = 0; i < final.length; i++) for (const other of final.slice(i + 1)) expectClear(final[i], other, 20)
    expect(result.stationaryPlacements.has('source')).toBe(false)
    expect(result.positions.get('source')).toEqual({ x: 220, y: 100 })
  })

  it('preserves exact fractional group offsets, dimensions and existing overlap', () => {
    const moving = [widget('a', 100.25, 50.5, 120.5, 80), widget('b', 160.75, 70.25, 90.25, 110.5)]
    const before = structuredClone(moving)
    const result = plan({ moving, stationary: moving, nudgeOffsets: offsets(12.5) })
    expect(result.direction).toBe('right')
    expect(result.positions.get('a')).toEqual({ x: 263.5, y: 50.5 })
    expect(result.positions.get('b')).toEqual({ x: 324, y: 70.25 })
    expect(result.positions.get('b').x - result.positions.get('a').x).toBe(60.5)
    expect(result.positions.get('b').y - result.positions.get('a').y).toBe(19.75)
    expect(moving).toEqual(before)
  })

  it('accepts the existing flat stationary rectangle shape and avoids internal ID collisions', () => {
    const blocker = { id: '__duplicate-0', x: 220, y: 100, width: 100, height: 100 }
    const result = plan({ stationary: [source, blocker], viewport: { left: 0, top: 0, right: 600, bottom: 200 } })
    expect(result.positions.get('source')).toEqual({ x: 220, y: 100 })
    expect(result.stationaryPlacements.has('__duplicate-0')).toBe(true)
  })

  it('retains the historical 40px diagonal offset and intentional overlap when disabled', () => {
    const result = plan({ autoPlaceEnabled: false, stationary: [source, widget('overlap', 150, 145)] })
    expect(result.direction).toBe('offset')
    expect(result.positions.get('source')).toEqual({ x: 140, y: 140 })
    expect(result.stationaryPlacements.size).toBe(0)
  })

  it('advances the disabled legacy offset only for occupied exact top-left positions', () => {
    const stationary = [source, widget('first-copy', 140, 140), widget('second-copy', 180, 180)]
    expect(plan({ autoPlaceEnabled: false, stationary }).positions.get('source')).toEqual({ x: 220, y: 220 })
  })

  it('keeps a disabled multi-selection rigid when any member exact position is occupied', () => {
    const moving = [source, widget('other', 250.5, 120.75)]
    const result = plan({ autoPlaceEnabled: false, moving, stationary: [...moving, widget('occupied', 290.5, 160.75)] })
    expect(result.positions.get('source')).toEqual({ x: 180, y: 180 })
    expect(result.positions.get('other')).toEqual({ x: 330.5, y: 200.75 })
    expect(result.stationaryPlacements.size).toBe(0)
  })

  it('returns empty geometry for an empty selection', () => {
    expect(plan({ moving: [] })).toEqual({ positions: new Map(), stationaryPlacements: new Map(), direction: 'right' })
  })
})
