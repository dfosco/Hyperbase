import { resolveFrameDevicePreset } from './frameDevicePresets.js'

const THEME_FRAME_TYPES = new Set(['prototype', 'component', 'story', 'component-set'])
const DEVICE_FRAME_TYPES = new Set(['prototype', 'site-frame'])

/** Build the persisted prop patch for the shared frame Theme/Device actions. */
export function getFrameActionUpdates(widgetType, action, options = {}, props = {}, supportedThemes = {}) {
  if (action === 'set-frame-theme') {
    if (!THEME_FRAME_TYPES.has(widgetType)) return null
    if (options.value === 'inherit') return { frameThemeOverride: null }
    if (typeof options.value !== 'string' || !Object.prototype.hasOwnProperty.call(supportedThemes, options.value)) return null
    return { frameThemeOverride: options.value }
  }

  if (action === 'set-frame-device') {
    if (!DEVICE_FRAME_TYPES.has(widgetType)) return null
    const preset = resolveFrameDevicePreset(options.value)
    if (!preset) return null
    const updates = { frameDevice: options.value.toLowerCase(), width: preset.width }
    if (props.frameClipHeight === true) updates.height = preset.height
    return updates
  }

  if (action === 'set-frame-clip-height') {
    if (!DEVICE_FRAME_TYPES.has(widgetType) || typeof options.value !== 'boolean') return null
    const updates = { frameClipHeight: options.value }
    if (options.value) {
      const preset = resolveFrameDevicePreset(props.frameDevice || 'desktop')
      if (preset) updates.height = preset.height
    }
    return updates
  }

  return null
}
