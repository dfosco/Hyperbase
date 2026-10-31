import { describe, expect, it } from 'vitest'
import { arrangeSelectionGrid, getSelectionBounds } from './selectionGeometry.js'

const item = (id, x, y, width, height) => ({ id, position: { x, y }, width, height })
function expectSeparated(items, placements, gap) {
  for (const [index, a] of items.entries()) {
    const first = placements.get(a.id)
    expect(Number.isInteger(first.x) && Number.isInteger(first.y)).toBe(true)
    for (const b of items.slice(index + 1)) {
      const second = placements.get(b.id)
      expect(first.x + a.width + gap <= second.x || second.x + b.width + gap <= first.x ||
        first.y + a.height + gap <= second.y || second.y + b.height + gap <= first.y).toBe(true)
    }
  }
}

describe('getSelectionBounds', () => {
  it('returns null for an empty selection', () => {
    expect(getSelectionBounds([])).toBeNull()
  })

  it('keeps exact fractional bounds for one selected widget', () => {
    expect(getSelectionBounds([item('a', 10.25, 20.5, 40.75, 80.125)])).toEqual({ x: 10.25, y: 20.5, width: 40.75, height: 80.125 })
  })

  it('contains variable sizes and overlapping widgets at negative positions', () => {
    expect(getSelectionBounds([
      item('a', -20, 30, 100, 50),
      item('b', 40, -10, 80, 140),
      item('c', 50, 40, 10, 20),
    ])).toEqual({ x: -20, y: -10, width: 140, height: 140 })
  })
})

describe('arrangeSelectionGrid', () => {
  it('returns an empty map for an empty selection', () => {
    expect(arrangeSelectionGrid([])).toEqual(new Map())
  })

  it('keeps a single widget at its existing integer position', () => {
    expect(arrangeSelectionGrid([item('a', 17, 23, 40, 60)])).toEqual(new Map([['a', { x: 17, y: 23 }]]))
  })

  it('packs variable sizes using column and row maxima without resizing', () => {
    const selected = [
      item('a', 10, 20, 100, 50), item('b', 700, 500, 60, 80), item('c', 100, 90, 150, 40),
      item('d', 400, 40, 200, 60), item('e', 30, 100, 90, 100), item('f', 600, 200, 50, 70),
    ]
    const before = structuredClone(selected)
    const placements = arrangeSelectionGrid(selected)
    expect(placements).toEqual(new Map([
      ['a', { x: 10, y: 20 }], ['b', { x: 250, y: 20 }], ['c', { x: 380, y: 20 }],
      ['d', { x: 10, y: 140 }], ['e', { x: 250, y: 140 }], ['f', { x: 380, y: 140 }],
    ]))
    expectSeparated(selected, placements, 40)
    expect(selected).toEqual(before)
  })

  it('uses document order rather than the previous visual position', () => {
    const selected = [item('right', 500, 500, 50, 50), item('left', 0, 0, 50, 50), item('last', 100, 100, 50, 50)]
    expect([...arrangeSelectionGrid(selected)]).toEqual([
      ['right', { x: 0, y: 0 }], ['left', { x: 90, y: 0 }], ['last', { x: 0, y: 90 }],
    ])
  })

  it('rounds fractional dimensions and spacing outward', () => {
    const selected = [
      item('a', 10.2, 20.2, 10.1, 5.2), item('b', 15, 22, 20.4, 15.6),
      item('c', 20, 30, 11.7, 6.5), item('d', 25, 40, 4.5, 10.5),
    ]
    const placements = arrangeSelectionGrid(selected, { gap: 2.4 })
    expect(placements).toEqual(new Map([
      ['a', { x: 11, y: 21 }], ['b', { x: 26, y: 21 }],
      ['c', { x: 11, y: 39 }], ['d', { x: 26, y: 39 }],
    ]))
    expectSeparated(selected, placements, 2.4)
  })

  it('clamps the shared origin to the boundary and supports touching edges', () => {
    const selected = [item('a', -50, -40, 30, 20), item('b', -20, -10, 40, 40), item('c', 20, 30, 20, 30)]
    const placements = arrangeSelectionGrid(selected, { gap: 0, boundaryPad: 24.5 })
    expect(placements).toEqual(new Map([
      ['a', { x: 25, y: 25 }], ['b', { x: 55, y: 25 }], ['c', { x: 25, y: 65 }],
    ]))
    expectSeparated(selected, placements, 0)
  })

  it('is stable when explicitly arranging an already arranged selection again', () => {
    const selected = [item('a', 70, 100, 80, 50), item('b', 20, 20, 120, 100), item('c', 40, 50, 30, 25), item('d', 90, 130, 20, 75), item('e', 120, 200, 140, 100)]
    const first = arrangeSelectionGrid(selected, { gap: 25 })
    const arranged = selected.map((entry) => ({ ...entry, position: first.get(entry.id) }))
    expect(arrangeSelectionGrid(arranged, { gap: 25 })).toEqual(first)
    expect([...first.keys()]).toEqual(selected.map((entry) => entry.id))
  })
})
