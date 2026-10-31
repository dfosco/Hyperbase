import { describe, expect, it } from 'vitest'
import { FRAME_DEVICE_PRESETS, resolveFrameDevicePreset } from './frameDevicePresets.js'

describe('frame device presets', () => {
  it('defines the shared Desktop and Mobile dimensions', () => {
    expect(FRAME_DEVICE_PRESETS).toEqual({
      desktop: { label: 'Desktop', width: 800, height: 600 },
      mobile: { label: 'Mobile', width: 390, height: 844 },
    })
  })

  it('returns immutable presets for case-insensitive keys', () => {
    expect(resolveFrameDevicePreset('desktop')).toBe(FRAME_DEVICE_PRESETS.desktop)
    expect(resolveFrameDevicePreset('MOBILE')).toBe(FRAME_DEVICE_PRESETS.mobile)
    expect(Object.isFrozen(FRAME_DEVICE_PRESETS)).toBe(true)
    expect(Object.isFrozen(FRAME_DEVICE_PRESETS.desktop)).toBe(true)
    expect(Object.isFrozen(FRAME_DEVICE_PRESETS.mobile)).toBe(true)
  })

  it.each([null, undefined, 800, '', 'tablet', 'toString', '__proto__'])('returns null for invalid preset %j', (device) => {
    expect(resolveFrameDevicePreset(device)).toBeNull()
  })
})
