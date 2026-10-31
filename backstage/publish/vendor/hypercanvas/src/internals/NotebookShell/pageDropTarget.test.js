import { describe, expect, it } from 'vitest'
import { getPageDropSide } from './pageDropTarget.js'

describe('getPageDropSide', () => {
  const bounds = { top: 100, bottom: 132 }

  it('accepts drops in the narrow strip before a page row', () => {
    expect(getPageDropSide(100, bounds)).toBe('before')
    expect(getPageDropSide(106, bounds)).toBe('before')
  })

  it('accepts drops in the narrow strip after a page row', () => {
    expect(getPageDropSide(126, bounds)).toBe('after')
    expect(getPageDropSide(132, bounds)).toBe('after')
  })

  it('does not make the body of a page row a drop target', () => {
    expect(getPageDropSide(107, bounds)).toBeNull()
    expect(getPageDropSide(116, bounds)).toBeNull()
    expect(getPageDropSide(125, bounds)).toBeNull()
    expect(getPageDropSide(99, bounds)).toBeNull()
    expect(getPageDropSide(133, bounds)).toBeNull()
  })
})
