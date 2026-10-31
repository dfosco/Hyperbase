import { describe, expect, it } from 'vitest'
import { isAutoPlaceEnabled, resolveAutoPlaceDrop, getAutoPlacePreview } from './autoPlace.js'

const moving = [{ id: 'moving', position: { x: 0, y: 0 }, width: 200, height: 200 }]
const peer = { id: 'peer', x: 500, y: 100, width: 200, height: 200 }
const offsets = (top = 80, left = 80, trigger = 80, gap = 0, stationary = false, multiselection = true) => ({
  align: { 'top-edge-nudge-offset': top, 'left-edge-nudge-offset': left },
  overlap: {
    'overlap-nudge-trigger': trigger,
    'overlap-nudge-offset': gap,
    'overlap-place-stationary': stationary,
    'overlap-place-multiselection': multiselection,
  },
})
function preview(position, options = {}) {
  return getAutoPlacePreview({ moving, stationary: [peer], primaryId: 'moving', primaryPosition: position, ...options })
}
function drop(position, options = {}) {
  return preview(position, options).placements.get('moving')
}
function finalRects(options, placements) {
  const members = options.moving || moving
  const peers = options.stationary || [peer]
  return [
    ...members.map((item) => ({ ...item, ...placements.get(item.id) })),
    ...peers.filter((item) => !members.some((member) => member.id === item.id)).map((item) => ({ ...item, ...placements.get(item.id) })),
  ]
}
function expectClear(rects, gap = 0) {
  for (let index = 0; index < rects.length; index++) {
    const a = rects[index]
    expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true)
    for (const b of rects.slice(index + 1)) {
      expect(a.x + a.width + gap <= b.x || b.x + b.width + gap <= a.x ||
        a.y + a.height + gap <= b.y || b.y + b.height + gap <= a.y,
      `${a.id} and ${b.id} must have at least ${gap}px clearance`).toBe(true)
    }
  }
}

describe('Auto place preference', () => {
  it('prefers autoPlace and falls back to legacy snapToGrid', () => {
    expect(isAutoPlaceEnabled({ autoPlace: true, snapToGrid: false })).toBe(true)
    expect(isAutoPlaceEnabled({ autoPlace: false, snapToGrid: true })).toBe(false)
    expect(isAutoPlaceEnabled({ snapToGrid: true })).toBe(true)
    expect(isAutoPlaceEnabled({})).toBe(false)
  })
})

describe('protected stationary rectangles', () => {
  it('never displaces a protected source when making room for another stationary widget', () => {
    const original = { id: 'original', x: 100, y: 100, width: 100, height: 100 }
    const blocker = { id: 'blocker', x: 220, y: 100, width: 100, height: 100 }
    const options = {
      moving: [{ id: 'copy', position: { x: 220, y: 100 }, width: 100, height: 100 }],
      stationary: [original, blocker], primaryId: 'copy', primaryPosition: { x: 220, y: 100 },
      fixedStationaryIds: ['original'], nudgeOffsets: offsets(0, 0, 0, 20, true), preserveMovingOffsets: true,
    }
    const placements = resolveAutoPlaceDrop(options)
    expect(placements.get('copy')).toEqual({ x: 220, y: 100 })
    expect(placements.has('original')).toBe(false)
    expect(placements.has('blocker')).toBe(true)
    expectClear(finalRects(options, placements), 20)
  })

  it('moves an overlapping incoming group rigidly clear of protected stationary rectangles', () => {
    const options = {
      moving: [
        { id: 'a', position: { x: 100.25, y: 100.5 }, width: 80, height: 80 },
        { id: 'b', position: { x: 200.75, y: 120.25 }, width: 80, height: 80 },
      ],
      stationary: [{ id: 'original', x: 100, y: 100, width: 100, height: 100 }],
      primaryId: 'a', primaryPosition: { x: 100.25, y: 100.5 }, fixedStationaryIds: ['original'],
      nudgeOffsets: offsets(0, 0, 0, 20, true), preserveMovingOffsets: true,
    }
    const placements = resolveAutoPlaceDrop(options)
    expect(placements.has('original')).toBe(false)
    expect(placements.get('b').x - placements.get('a').x).toBe(100.5)
    expect(placements.get('b').y - placements.get('a').y).toBe(19.75)
    expectClear(finalRects(options, placements), 20)
  })
})

describe('Auto place alignment and proximity', () => {
  it('keeps a free drop instead of snapping it to the canvas grid', () => {
    expect(drop({ x: 137, y: 85 }, { stationary: [] })).toEqual({ x: 137, y: 85 })
  })

  it.each([100, 150])('aligns and spaces the reported shallow overlap at %s%% zoom', (zoom) => {
    const prototype = { id: 'prototype-ffkuug', x: 5147, y: 818, width: 2320, height: 1400 }
    const chart = { id: 'component-set-jyuqnp', position: { x: 7421, y: 775 }, width: 2280, height: 1368 }
    const options = { moving: [chart], stationary: [prototype], primaryId: chart.id, primaryPosition: chart.position, zoom, nudgeOffsets: offsets(80, 80, 80, 40) }
    const result = getAutoPlacePreview(options)
    expect(result.inRangeIds).toEqual(new Set([prototype.id]))
    expect(result.placements.get(chart.id)).toEqual({ x: 7507, y: 818 })
    expect(resolveAutoPlaceDrop(options)).toEqual(result.placements)
  })

  it('spaces a shallow overlap to the left and aligns the top edge', () => {
    expect(drop({ x: 224, y: 125 }, {
      moving: [{ ...moving[0], width: 100 }], stationary: [{ ...peer, x: 300, width: 100 }],
    })).toEqual({ x: 200, y: 100 })
  })

  it('spaces a shallow vertical overlap and aligns the left edge', () => {
    expect(drop({ x: 525, y: 280 })).toEqual({ x: 500, y: 300 })
  })

  it('preserves staggered widgets outside the edge alignment range', () => {
    expect(drop({ x: 550, y: 900 }, {
      moving: [{ ...moving[0], width: 1000, height: 600 }],
      stationary: [{ ...peer, x: 25, y: 25, width: 1100, height: 660 }],
    })).toEqual({ x: 550, y: 900 })
  })

  it('uses the top-edge offset independently and has no hidden 12px limit', () => {
    expect(drop({ x: 730, y: 140 }, { nudgeOffsets: offsets(45, 80, 0) })).toEqual({ x: 730, y: 100 })
    expect(preview({ x: 730, y: 140 }, { nudgeOffsets: offsets(39, 80, 0) }).inRangeIds.size).toBe(0)
  })

  it('uses the left-edge offset independently', () => {
    expect(drop({ x: 540, y: 330 }, { nudgeOffsets: offsets(80, 45, 0) })).toEqual({ x: 500, y: 330 })
    expect(preview({ x: 540, y: 330 }, { nudgeOffsets: offsets(80, 39, 0) }).inRangeIds.size).toBe(0)
  })

  it.each([0, 40, 120])('uses overlap offset %s as the final gap independently of the trigger', (gap) => {
    expect(drop({ x: 710, y: 130 }, { nudgeOffsets: offsets(80, 80, 10, gap) })).toEqual({ x: 700 + gap, y: 100 })
    expect(drop({ x: 710, y: 130 }, { nudgeOffsets: offsets(80, 80, 9, gap) })).toEqual({ x: 710, y: 100 })
  })

  it('does not let a large final gap expand the proximity trigger', () => {
    expect(drop({ x: 720, y: 130 }, { nudgeOffsets: offsets(80, 80, 10, 200) })).toEqual({ x: 720, y: 100 })
  })

  it('uses the same configured gap for vertical adjacency', () => {
    expect(drop({ x: 525, y: 280 }, { nudgeOffsets: offsets(80, 80, 80, 25) })).toEqual({ x: 500, y: 325 })
  })

  it('does not highlight or align distant matching edges', () => {
    const result = preview({ x: 510, y: 800 })
    expect(result.inRangeIds.size).toBe(0)
    expect(result.placements.get('moving')).toEqual({ x: 510, y: 800 })
  })

  it.each([50, 100, 200])('keeps configured ranges in screen pixels at %s%% zoom', (zoom) => {
    const scale = zoom / 100
    const position = { x: 700 + 30 / scale, y: 100 + 40 / scale }
    expect(drop(position, { zoom, nudgeOffsets: offsets(45, 80, 0) })).toEqual({ x: position.x, y: 100 })
    expect(preview(position, { zoom, nudgeOffsets: offsets(39, 80, 0) }).inRangeIds.size).toBe(0)
  })

  it('highlights every eligible peer even when only one supplies the nearest snap', () => {
    const result = preview({ x: 500, y: 330 }, { stationary: [peer, { ...peer, id: 'second', x: 780, y: 330 }] })
    expect(result.inRangeIds).toEqual(new Set(['peer', 'second']))
    expect(result.placements.get('moving')).toEqual({ x: 500, y: 300 })
  })

  it('accepts legacy flat settings while nested settings take precedence', () => {
    const legacy = { 'top-edge-nudge-offset': 0, 'left-edge-nudge-offset': 0, 'overlap-nudge-trigger': 10, 'overlap-nudge-offset': 25 }
    expect(drop({ x: 710, y: 100 }, { nudgeOffsets: legacy })).toEqual({ x: 725, y: 100 })
    expect(drop({ x: 710, y: 100 }, { nudgeOffsets: { ...legacy, overlap: { 'overlap-nudge-offset': 0 } } })).toEqual({ x: 700, y: 100 })
  })

  it('disables preview, alignment, and overlap placement when Auto place is off', () => {
    const result = preview({ x: 690, y: 130 }, { align: false })
    expect(result.placements.get('moving')).toEqual({ x: 690, y: 130 })
    expect(result.inRangeIds.size).toBe(0)
  })
})

describe('Auto place overlap clearance', () => {
  it('clears deep overlaps even when every trigger and alignment range is zero', () => {
    const options = { nudgeOffsets: offsets(0, 0, 0) }
    const result = preview({ x: 600, y: 200 }, options)
    expect(result.inRangeIds).toEqual(new Set(['peer']))
    expect(result.placements.get('moving')).toEqual({ x: 700, y: 200 })
    expectClear(finalRects(options, result.placements))
  })

  it.each([0, 35])('clears every blocker in a drop overlapping multiple widgets with gap %s', (gap) => {
    const options = {
      stationary: [peer, { ...peer, id: 'second', x: 650, y: 250 }, { ...peer, id: 'third', x: 800, y: 150 }],
      nudgeOffsets: offsets(0, 0, 0, gap),
    }
    const result = preview({ x: 600, y: 200 }, options)
    expect(result.inRangeIds).toEqual(new Set(['peer', 'second']))
    // The stationary peers themselves overlap. Only the moving widget must
    // clear all of them when stationary placement is disabled.
    const [placed, ...blockers] = finalRects(options, result.placements)
    for (const blocker of blockers) expectClear([placed, blocker], gap)
    expect([...result.placements.keys()]).toEqual(['moving'])
  })

  it('does not align back into an obstacle after collision clearance', () => {
    const options = { stationary: [peer, { ...peer, id: 'above', x: 700, y: 0 }], nudgeOffsets: offsets(80, 80, 0) }
    const result = preview({ x: 690, y: 130 }, options)
    const [placed, ...blockers] = finalRects(options, result.placements)
    for (const blocker of blockers) expectClear([placed, blocker])
  })

  it('finds the nearest diagonal escape from intersecting horizontal and vertical blockers', () => {
    const options = {
      moving: [{ ...moving[0], width: 20, height: 20 }],
      stationary: [
        { id: 'vertical', x: 90, y: 90, width: 30, height: 100 },
        { id: 'horizontal', x: 90, y: 90, width: 100, height: 30 },
      ],
      nudgeOffsets: offsets(0, 0, 0),
    }
    const result = preview({ x: 100, y: 100 }, options)
    expect(result.placements.get('moving')).toEqual({ x: 120, y: 120 })
    const [placed, ...blockers] = finalRects(options, result.placements)
    for (const blocker of blockers) expectClear([placed, blocker])
  })

  it('honors the canvas boundary before returning clearance positions', () => {
    const options = { stationary: [{ ...peer, x: 24, y: 24 }], boundaryPad: 24, nudgeOffsets: offsets(0, 0, 0) }
    const result = preview({ x: 24, y: 24 }, options)
    expect(result.placements.get('moving')).toEqual({ x: 224, y: 24 })
    expectClear(finalRects(options, result.placements))
  })

  it('rounds fractional dimensions outward so persistence cannot restore an overlap', () => {
    const options = { stationary: [{ ...peer, x: 500.2, y: 100.3, width: 200.4 }], nudgeOffsets: offsets(0, 0, 0, 12.5) }
    const result = preview({ x: 690.4, y: 130.3 }, options)
    const position = result.placements.get('moving')
    expect(Number.isInteger(position.x) && Number.isInteger(position.y)).toBe(true)
    expectClear(finalRects(options, result.placements), 12.5)
  })

  it('returns the same finite placement for a dense set of blockers', () => {
    const options = {
      stationary: Array.from({ length: 30 }, (_, index) => ({ ...peer, id: `peer-${index}`, x: index % 6 * 190, y: Math.floor(index / 6) * 190 })),
      nudgeOffsets: offsets(0, 0, 0),
    }
    const first = preview({ x: 380, y: 380 }, options)
    expect(preview({ x: 380, y: 380 }, options).placements).toEqual(first.placements)
    const [placed, ...blockers] = finalRects(options, first.placements)
    for (const blocker of blockers) expectClear([placed, blocker])
  })
})

describe('Auto place stationary and multiselection policies', () => {
  it('keeps the aligned moving widget in place and moves stationary peers when enabled', () => {
    const options = { nudgeOffsets: offsets(80, 80, 0, 0, true) }
    const result = preview({ x: 690, y: 130 }, options)
    expect(result.placements.get('moving')).toEqual({ x: 690, y: 100 })
    expect(result.placements.get('peer')).toEqual({ x: 490, y: 100 })
    expectClear(finalRects(options, result.placements))
  })

  it('moves an affected stationary chain, including a third blocker, while leaving distant peers alone', () => {
    const options = {
      moving: [{ ...moving[0], width: 100, height: 300 }],
      stationary: [
        { ...peer, id: 'first', x: 80, y: 0, width: 100, height: 300 },
        { ...peer, id: 'second', x: 180, y: 0, width: 100, height: 300 },
        { ...peer, id: 'third', x: 280, y: 0, width: 100, height: 300 },
        { ...peer, id: 'distant', x: 2000, y: 2000 },
      ],
      nudgeOffsets: offsets(0, 0, 0, 10, true),
    }
    const result = preview({ x: 0, y: 0 }, options)
    expect(result.placements.get('moving')).toEqual({ x: 0, y: 0 })
    expect(result.placements.get('first')).toEqual({ x: 110, y: 0 })
    expect(result.placements.get('second')).toEqual({ x: 220, y: 0 })
    expect(result.placements.get('third')).toEqual({ x: 330, y: 0 })
    expect(result.placements.has('distant')).toBe(false)
    expectClear(finalRects(options, result.placements), 10)
  })

  it('applies proximity spacing by moving the stationary widget when enabled', () => {
    const options = { nudgeOffsets: offsets(80, 80, 40, 20, true) }
    const result = preview({ x: 730, y: 100 }, options)
    expect(result.placements.get('moving')).toEqual({ x: 730, y: 100 })
    expect(result.placements.get('peer')).toEqual({ x: 510, y: 100 })
    expectClear(finalRects(options, result.placements), 20)
  })

  it('preserves group offsets while clearing every stationary obstacle', () => {
    const second = { ...moving[0], id: 'second', position: { x: 250, y: 30 } }
    const options = { moving: [...moving, second], stationary: [peer, { ...second, x: 250, y: 30 }], nudgeOffsets: offsets(0, 0, 0) }
    const result = preview({ x: 600, y: 200 }, options)
    const firstPosition = result.placements.get('moving')
    const secondPosition = result.placements.get('second')
    expect(secondPosition).toEqual({ x: firstPosition.x + 250, y: firstPosition.y + 30 })
    expect(result.inRangeIds).toEqual(new Set(['peer']))
    expectClear(finalRects(options, result.placements))
  })

  it('does not mistake empty space between selected widgets for an overlap', () => {
    const options = {
      moving: [moving[0], { ...moving[0], id: 'second', position: { x: 800, y: 0 } }],
      stationary: [{ ...peer, y: 0 }], nudgeOffsets: offsets(0, 0, 0),
    }
    const result = preview({ x: 0, y: 0 }, options)
    expect(result.inRangeIds.size).toBe(0)
    expect(result.placements.get('moving')).toEqual({ x: 0, y: 0 })
    expect(result.placements.get('second')).toEqual({ x: 800, y: 0 })
    expectClear(finalRects(options, result.placements))
  })

  it('clears overlaps between moving selection members when multiselection placement is enabled', () => {
    const options = {
      moving: [...moving, { ...moving[0], id: 'second', position: { x: 40, y: 30 } }],
      stationary: [peer], nudgeOffsets: offsets(0, 0, 0),
    }
    const result = preview({ x: 550, y: 150 }, options)
    expectClear(finalRects(options, result.placements))
    expect(result.placements.get('second')).not.toEqual({ x: result.placements.get('moving').x + 40, y: result.placements.get('moving').y + 30 })
  })

  it('skips group overlap placement when disabled but still aligns and highlights peers', () => {
    const options = {
      moving: [...moving, { ...moving[0], id: 'second', position: { x: 250, y: 30 } }],
      nudgeOffsets: offsets(80, 80, 80, 0, true, false),
    }
    const result = preview({ x: 690, y: 130 }, options)
    expect(result.placements.get('moving')).toEqual({ x: 690, y: 100 })
    expect(result.placements.get('second')).toEqual({ x: 940, y: 130 })
    expect(result.placements.has('peer')).toBe(false)
    expect(result.inRangeIds).toEqual(new Set(['peer']))
  })

  it.each([false, true])('keeps crowded group drops collision free with stationary placement %s', (stationary) => {
    const options = {
      moving: [
        { ...moving[0], width: 40, height: 40 },
        { id: 'second', position: { x: 20, y: 20 }, width: 40, height: 40 },
      ],
      stationary: Array.from({ length: 12 }, (_, index) => ({ id: `peer-${index}`, x: 50 + index % 4 * 80, y: 50 + Math.floor(index / 4) * 80, width: 60, height: 60 })),
      nudgeOffsets: offsets(0, 0, 0, 0, stationary),
    }
    for (const x of [25, 70, 125, 210, 300]) {
      for (const y of [25, 90, 160, 240]) {
        const result = preview({ x, y }, options)
        expectClear(finalRects(options, result.placements))
      }
    }
  })

  it('returns no placements for a missing primary', () => {
    expect(preview({ x: 0, y: 0 }, { primaryId: 'missing' })).toEqual({ placements: new Map(), inRangeIds: new Set() })
  })
})

describe('Auto place rigid moving groups', () => {
  it('preserves existing selected overlaps while clearing stationary obstacles when requested', () => {
    const options = {
      moving: [...moving, { ...moving[0], id: 'second', position: { x: 40, y: 30 } }],
      stationary: [peer], nudgeOffsets: offsets(0, 0, 0), preserveMovingOffsets: true,
    }
    const result = preview({ x: 550, y: 150 }, options)
    const first = result.placements.get('moving')
    const second = result.placements.get('second')
    expect(second).toEqual({ x: first.x + 40, y: first.y + 30 })
    expect([...result.placements.keys()]).toEqual(['moving', 'second'])
    for (const member of finalRects(options, result.placements).slice(0, 2)) expectClear([member, peer])
    expect(result.inRangeIds).toEqual(new Set(['peer']))
    const defaultResult = preview({ x: 550, y: 150 }, { ...options, preserveMovingOffsets: false })
    expectClear(finalRects(options, defaultResult.placements))
    expect(defaultResult.placements).not.toEqual(result.placements)
  })

  it('preserves fractional member offsets through one shared rounded translation', () => {
    const options = {
      moving: [
        { ...moving[0], position: { x: 10.25, y: 20.25 } },
        { ...moving[0], id: 'second', position: { x: 20.75, y: 30.75 } },
      ],
      stationary: [], nudgeOffsets: offsets(0, 0, 0), preserveMovingOffsets: true,
    }
    const result = preview({ x: 100.9, y: 200.9 }, options)
    const first = result.placements.get('moving')
    const second = result.placements.get('second')
    expect(first).toEqual({ x: 101.25, y: 201.25 })
    expect(second).toEqual({ x: first.x + 10.5, y: first.y + 10.5 })
  })

  it('clamps the entire rigid group to the boundary without changing member offsets', () => {
    const options = {
      moving: [
        { ...moving[0], position: { x: 10.25, y: 20.25 } },
        { ...moving[0], id: 'second', position: { x: 20.75, y: 30.75 } },
      ],
      stationary: [], nudgeOffsets: offsets(0, 0, 0), preserveMovingOffsets: true, boundaryPad: 24.5,
    }
    const result = preview({ x: -100, y: -200 }, options)
    const first = result.placements.get('moving')
    const second = result.placements.get('second')
    expect(first.x).toBeGreaterThanOrEqual(24.5)
    expect(first.y).toBeGreaterThanOrEqual(24.5)
    expect(second).toEqual({ x: first.x + 10.5, y: first.y + 10.5 })
  })
})
