import { describe, expect, it } from 'vitest'
import { getFrameActionUpdates } from './frameActionUpdates.js'

const themes = { light: {}, dark: {}, dark_dimmed: {} }

describe('frame action updates', () => {
  it('sets supported frame themes and clears to inheritance for every component preview kind', () => {
    expect(getFrameActionUpdates('prototype', 'set-frame-theme', { value: 'dark_dimmed' }, {}, themes))
      .toEqual({ frameThemeOverride: 'dark_dimmed' })
    expect(getFrameActionUpdates('component', 'set-frame-theme', { value: 'inherit' }, {}, themes))
      .toEqual({ frameThemeOverride: null })
    expect(getFrameActionUpdates('site-frame', 'set-frame-theme', { value: 'dark' }, {}, themes)).toBeNull()
    expect(getFrameActionUpdates('component', 'set-frame-theme', { value: 'unknown' }, {}, themes)).toBeNull()
    for (const type of ['story', 'component-set']) {
      expect(getFrameActionUpdates(type, 'set-frame-theme', { value: 'dark' }, {}, themes))
        .toEqual({ frameThemeOverride: 'dark' })
      expect(getFrameActionUpdates(type, 'set-frame-theme', { value: 'inherit' }, {}, themes))
        .toEqual({ frameThemeOverride: null })
    }
  })

  it('sets preset width while preserving height unless clipping is enabled', () => {
    expect(getFrameActionUpdates('prototype', 'set-frame-device', { value: 'mobile' }, { height: 487 }))
      .toEqual({ frameDevice: 'mobile', width: 390 })
    expect(getFrameActionUpdates('site-frame', 'set-frame-device', { value: 'desktop' }, { frameClipHeight: true, height: 487 }))
      .toEqual({ frameDevice: 'desktop', width: 800, height: 600 })
    expect(getFrameActionUpdates('component', 'set-frame-device', { value: 'mobile' })).toBeNull()
  })

  it('clips only after explicit opt-in and leaves geometry unchanged when turned off', () => {
    expect(getFrameActionUpdates('prototype', 'set-frame-clip-height', { value: true }, { frameDevice: 'mobile', height: 487 }))
      .toEqual({ frameClipHeight: true, height: 844 })
    expect(getFrameActionUpdates('site-frame', 'set-frame-clip-height', { value: false }, { frameDevice: 'mobile', height: 844 }))
      .toEqual({ frameClipHeight: false })
  })
})
