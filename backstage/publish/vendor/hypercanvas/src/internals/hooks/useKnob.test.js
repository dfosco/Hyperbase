import { createElement } from 'react'
import { act, renderHook } from '@testing-library/react'
import { StoryboardContext } from '../StoryboardContext.js'
import { initKnobs } from '../../core/knobs/index.js'
import { setParam } from '../../core/session/session.js'
import { detectKnobRoute, useKnob } from './useKnob.js'

function wrapper(prototypeName = 'Signup') {
  return function Wrapper({ children }) {
    return createElement(
      StoryboardContext.Provider,
      { value: { data: {}, error: null, loading: false, prototypeName } },
      children,
    )
  }
}

beforeEach(() => {
  initKnobs()
  window.history.pushState(null, '', '/')
})

describe('detectKnobRoute', () => {
  it('detects prototype and route from normal and branch-prefixed paths', () => {
    expect(detectKnobRoute('/Signup/Branding')).toEqual({
      prototypeName: 'Signup',
      route: '/Branding',
    })
    expect(detectKnobRoute('/branch--knobs-system/Signup/Branding')).toEqual({
      prototypeName: 'Signup',
      route: '/Branding',
    })
  })

  it('strips the /prototypes.html iframe-isolation prefix', () => {
    expect(detectKnobRoute('/prototypes.html/Signup')).toEqual({
      prototypeName: 'Signup',
      route: undefined,
    })
    expect(detectKnobRoute('/prototypes.html/Signup/Branding')).toEqual({
      prototypeName: 'Signup',
      route: '/Branding',
    })
  })
})

describe('useKnob', () => {
  it('returns a prototype-wide default when no hash value is present', () => {
    initKnobs({
      prototypeKnobs: {
        Signup: [{ id: 'showAvatar', type: 'boolean', default: true }],
      },
    })
    window.history.pushState(null, '', '/Signup')

    const { result } = renderHook(() => useKnob('showAvatar'), {
      wrapper: wrapper('Signup'),
    })

    expect(result.current).toBe(true)
  })

  it('subscribes to a prototype-wide key while viewing a route', () => {
    initKnobs({
      prototypeKnobs: {
        Signup: [{ id: 'theme', type: 'text', default: 'light', scope: null }],
      },
    })
    window.history.pushState(null, '', '/Signup/Branding')

    const { result } = renderHook(() => useKnob('theme'), {
      wrapper: wrapper('Signup'),
    })

    expect(result.current).toBe('light')

    act(() => {
      setParam('knob.theme', 'dark')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(result.current).toBe('dark')
  })

  it('coerces prototype-wide hash values', () => {
    initKnobs({
      prototypeKnobs: {
        Signup: [{ id: 'showAvatar', type: 'boolean', default: true }],
      },
    })
    window.history.pushState(null, '', '/Signup#knobShowAvatar=false')

    const { result } = renderHook(() => useKnob('showAvatar'), {
      wrapper: wrapper('Signup'),
    })

    expect(result.current).toBe(false)
  })

  it('auto-detects route-scoped knob values', () => {
    initKnobs({
      prototypeKnobs: {
        Signup: [{
          id: 'variant',
          type: 'select',
          scope: '/Branding',
          options: ['small', 'large'],
          default: 'small',
        }],
      },
    })
    window.history.pushState(null, '', '/Signup/Branding#knobBrandingVariant=large')

    const { result } = renderHook(() => useKnob('variant'), {
      wrapper: wrapper('Signup'),
    })

    expect(result.current).toBe('large')
  })

  it('treats scope as a route alias', () => {
    initKnobs({
      prototypeKnobs: {
        Signup: [{
          id: 'variant',
          type: 'select',
          scope: '/Branding',
          options: ['small', 'large'],
          default: 'small',
        }],
      },
    })
    window.history.pushState(null, '', '/Signup#knobBrandingVariant=large')

    const { result } = renderHook(() => useKnob('variant', { scope: '/Branding' }), {
      wrapper: wrapper('Signup'),
    })

    expect(result.current).toBe('large')
  })

  it('falls back to defaults for malformed hash values', () => {
    initKnobs({
      prototypeKnobs: {
        Signup: [{ id: 'showAvatar', type: 'boolean', default: true }],
      },
    })
    window.history.pushState(null, '', '/Signup#knobShowAvatar=nope')

    const { result } = renderHook(() => useKnob('showAvatar'), {
      wrapper: wrapper('Signup'),
    })

    expect(result.current).toBe(true)
  })

  it('tracks external canonical, compact, ID-alias, and scope-alias writes through one session snapshot', () => {
    initKnobs({
      prototypeKnobs: {
        Signup: [{
          id: 'variant',
          type: 'select',
          scope: '/Branding',
          scopeAliases: ['/branding'],
          aliases: ['theme'],
          options: ['small', 'large'],
          default: 'small',
        }],
      },
    })
    window.history.pushState(null, '', '/Signup/Branding')

    const { result } = renderHook(() => useKnob('variant'), {
      wrapper: wrapper('Signup'),
    })
    expect(result.current).toBe('small')

    for (const hash of [
      '#/Branding?knob.Branding.variant=large',
      '#/Branding?knobBrandingVariant=small',
      '#/Branding?knob.Branding.theme=large',
      '#/Branding?knob.branding.variant=small',
    ]) {
      act(() => {
        window.history.replaceState(null, '', `/Signup/Branding${hash}`)
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      })
      expect(result.current).toBe(hash.includes('large') ? 'large' : 'small')
    }
  })

  it('keeps provider bounds authoritative for invalid external values', () => {
    initKnobs({
      prototypeKnobs: {
        Signup: [{ id: 'count', type: 'number', default: 5, min: 0, max: 10 }],
      },
    })
    window.history.replaceState(null, '', '/Signup#knob.count=99')

    const { result } = renderHook(() => useKnob('count'), {
      wrapper: wrapper('Signup'),
    })

    expect(result.current).toBe(5)
  })

  it('keeps explicit route selection exact while implicit selection may fall back globally', () => {
    initKnobs({
      prototypeKnobs: {
        Signup: [
          { id: 'theme', type: 'text', default: 'global-default', scope: null },
          { id: 'theme', type: 'text', default: 'route-default', scope: '/Branding' },
        ],
      },
    })
    window.history.replaceState(null, '', '/Signup/Other#knob.theme=global-value&knob.Branding.theme=route-value')

    const explicitOther = renderHook(() => useKnob('theme', { route: '/Other' }), {
      wrapper: wrapper('Signup'),
    })
    expect(explicitOther.result.current).toBeUndefined()

    const implicitOther = renderHook(() => useKnob('theme'), {
      wrapper: wrapper('Signup'),
    })
    expect(implicitOther.result.current).toBe('global-value')

    const explicitGlobal = renderHook(() => useKnob('theme', { scope: null }), {
      wrapper: wrapper('Signup'),
    })
    expect(explicitGlobal.result.current).toBe('global-value')

    const routeWins = renderHook(() => useKnob('theme', { route: '/Branding', scope: null }), {
      wrapper: wrapper('Signup'),
    })
    expect(routeWins.result.current).toBe('route-value')
  })
})
