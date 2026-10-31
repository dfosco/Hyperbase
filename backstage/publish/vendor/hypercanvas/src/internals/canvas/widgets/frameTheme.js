/**
 * Resolve a frame's persisted theme override against the current app/canvas
 * theme. The theme registry is the `theming.themes` object from config.
 */
export function resolveFrameTheme(override, inheritedTheme, themes = {}) {
  return isSupportedTheme(override, themes) ? override : inheritedTheme
}

/**
 * Describe whether selected frames inherit, share one override, or differ.
 * Unsupported stored values behave like missing overrides so the UI does not
 * present an unavailable theme as an active choice.
 *
 * Each item reports `checked` when every selected frame has that value and
 * `mixed` when only some do. The inherit item follows the same rule.
 */
export function getFrameThemeSelectionState(overrides, themes = {}) {
  const values = (Array.isArray(overrides) ? overrides : []).map((override) => (
    isSupportedTheme(override, themes) ? override : null
  ))
  const allSame = values.length > 0 && values.every((value) => value === values[0])
  const inheritedCount = values.filter((value) => value === null).length

  return {
    state: values.length === 0
      ? 'empty'
      : allSame
        ? values[0] === null ? 'inherit' : 'override'
        : 'mixed',
    value: allSame && values[0] !== null ? values[0] : null,
    inherit: {
      checked: values.length > 0 && inheritedCount === values.length,
      mixed: inheritedCount > 0 && inheritedCount < values.length,
    },
    options: Object.keys(themes).map((value) => {
      const count = values.filter((selected) => selected === value).length
      return {
        value,
        checked: values.length > 0 && count === values.length,
        mixed: count > 0 && count < values.length,
      }
    }),
  }
}

function isSupportedTheme(value, themes) {
  return typeof value === 'string'
    && themes !== null
    && typeof themes === 'object'
    && Object.prototype.hasOwnProperty.call(themes, value)
}
