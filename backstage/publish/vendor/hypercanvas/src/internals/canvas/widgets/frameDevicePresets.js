/**
 * Shared dimensions used by the Prototype and Site Frame Device action.
 * Desktop matches both frame types' existing 800×600 default. Mobile uses a
 * 390×844 viewport, a common modern phone canvas size.
 */
export const FRAME_DEVICE_PRESETS = Object.freeze({
  desktop: Object.freeze({ label: 'Desktop', width: 800, height: 600 }),
  mobile: Object.freeze({ label: 'Mobile', width: 390, height: 844 }),
})

/** Resolve a device preset key, returning null for unknown values. */
export function resolveFrameDevicePreset(device) {
  if (typeof device !== 'string') return null
  const key = device.toLowerCase()
  return Object.prototype.hasOwnProperty.call(FRAME_DEVICE_PRESETS, key)
    ? FRAME_DEVICE_PRESETS[key]
    : null
}
