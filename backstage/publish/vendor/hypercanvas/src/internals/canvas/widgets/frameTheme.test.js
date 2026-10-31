import { describe, expect, it } from 'vitest'
import { getFrameThemeSelectionState, resolveFrameTheme } from './frameTheme.js'

const themes = {
  light: { label: 'Light' },
  dark: { label: 'Dark' },
  dark_dimmed: { label: 'Dark Dimmed' },
}

describe('frame theme resolution', () => {
  it('uses a supported explicit frame override', () => {
    expect(resolveFrameTheme('dark_dimmed', 'light', themes)).toBe('dark_dimmed')
  })

  it('inherits the current app theme when no override is stored', () => {
    expect(resolveFrameTheme(undefined, 'light', themes)).toBe('light')
    expect(resolveFrameTheme(undefined, 'dark', themes)).toBe('dark')
  })

  it('falls back to the inherited theme for absent or unsupported overrides', () => {
    expect(resolveFrameTheme(null, 'dark', themes)).toBe('dark')
    expect(resolveFrameTheme('removed-theme', 'light', themes)).toBe('light')
  })
})

describe('frame theme selection state', () => {
  it('reports a uniform inherited selection and checked inherit item', () => {
    expect(getFrameThemeSelectionState([undefined, null], themes)).toEqual({
      state: 'inherit',
      value: null,
      inherit: { checked: true, mixed: false },
      options: [
        { value: 'light', checked: false, mixed: false },
        { value: 'dark', checked: false, mixed: false },
        { value: 'dark_dimmed', checked: false, mixed: false },
      ],
    })
  })

  it('marks only the common explicit theme as checked', () => {
    const state = getFrameThemeSelectionState(['dark', 'dark'], themes)
    expect(state.state).toBe('override')
    expect(state.value).toBe('dark')
    expect(state.inherit).toEqual({ checked: false, mixed: false })
    expect(state.options.find((option) => option.value === 'dark')).toEqual({
      value: 'dark', checked: true, mixed: false,
    })
  })

  it('marks inherited and overridden choices mixed when selection differs', () => {
    const state = getFrameThemeSelectionState(['dark', undefined, 'dark_dimmed'], themes)
    expect(state.state).toBe('mixed')
    expect(state.value).toBeNull()
    expect(state.inherit).toEqual({ checked: false, mixed: true })
    expect(state.options.find((option) => option.value === 'dark')).toEqual({
      value: 'dark', checked: false, mixed: true,
    })
    expect(state.options.find((option) => option.value === 'dark_dimmed')).toEqual({
      value: 'dark_dimmed', checked: false, mixed: true,
    })
    expect(state.options.find((option) => option.value === 'light')).toEqual({
      value: 'light', checked: false, mixed: false,
    })
  })

  it('treats an unsupported persisted value as inherit for selection display', () => {
    const state = getFrameThemeSelectionState(['removed-theme', undefined], themes)
    expect(state.state).toBe('inherit')
    expect(state.inherit).toEqual({ checked: true, mixed: false })
  })
})
