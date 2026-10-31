import { describe, expect, it, vi } from 'vitest'
import {
  isExternalWidgetTarget,
  resolvePrototypeNameFromSrc,
  resolveKnobsTarget,
  resolveKnobsTargets,
} from './knobsTargetResolver.js'

const prototypeIndex = {
  prototypes: [
    {
      name: 'Signup',
      dirName: 'Signup',
      flows: [{ route: '/Signup' }, { route: '/Branding?flow=Signup/branding' }],
    },
  ],
  folders: [
    {
      prototypes: [
        {
          name: 'Account Settings',
          dirName: 'AccountSettings',
          flows: [{ route: '/Settings' }],
        },
      ],
    },
  ],
}

describe('resolveKnobsTarget', () => {
  it('resolves prototype widgets from src through the prototype index', () => {
    const knobs = [{ id: 'variant', type: 'select', options: ['a', 'b'] }]
    const handle = { getIframeWindow: vi.fn(() => window) }
    const deps = {
      buildPrototypeIndex: vi.fn(() => prototypeIndex),
      getPrototypeKnobs: vi.fn(() => knobs),
      getPrototypeMetadata: vi.fn(() => ({ meta: { title: 'Signup Page' } })),
      getWidgetRef: vi.fn(() => handle),
      baseUrl: '/',
    }

    const target = resolveKnobsTarget({
      id: 'prototype-1',
      widget: {
        type: 'prototype',
        props: { src: '/Branding?flow=Signup/branding', label: 'Signup page' },
      },
    }, deps)

    expect(target).toEqual(expect.objectContaining({
      id: 'prototype-1',
      label: 'Signup Page',
      knobs,
    }))
    expect(deps.getPrototypeKnobs).toHaveBeenCalledWith('Signup')
    expect(deps.getPrototypeMetadata).toHaveBeenCalledWith('Signup')
    expect(target.getTargetWindow()).toBe(window)
  })

  it('falls back to prototype name when meta.title is missing', () => {
    const deps = {
      buildPrototypeIndex: vi.fn(() => prototypeIndex),
      getPrototypeKnobs: vi.fn(() => []),
      getPrototypeMetadata: vi.fn(() => null),
      getWidgetRef: vi.fn(() => ({ getIframeWindow: () => window })),
      baseUrl: '/',
    }

    const target = resolveKnobsTarget({
      id: 'prototype-2',
      widget: { type: 'prototype', props: { src: '/Branding' } },
    }, deps)

    expect(target?.label).toBe('Signup')
  })

  it.each(['component-set', 'story'])('resolves %s widgets from storyId', (type) => {
    const knobs = [{ id: 'density', type: 'radio', options: ['cozy', 'dense'] }]
    const deps = {
      getComponentKnobs: vi.fn(() => knobs),
      getWidgetRef: vi.fn(() => ({ getIframeWindow: () => window })),
    }

    const target = resolveKnobsTarget({
      id: `${type}-1`,
      widget: {
        type,
        props: { storyId: 'Button', alias: 'Button set' },
      },
    }, deps)

    expect(target).toEqual(expect.objectContaining({
      id: `${type}-1`,
      label: 'Button set',
      knobs,
    }))
    expect(deps.getComponentKnobs).toHaveBeenCalledWith('Button')
    expect(target.getTargetWindow()).toBe(window)
  })

  it('filters external http URL iframe targets', () => {
    const deps = {
      buildPrototypeIndex: vi.fn(() => prototypeIndex),
      getPrototypeKnobs: vi.fn(),
    }

    expect(resolveKnobsTarget({
      id: 'prototype-external',
      widget: { type: 'prototype', props: { src: 'https://example.com/Demo' } },
    }, deps)).toBeNull()
    expect(deps.getPrototypeKnobs).not.toHaveBeenCalled()
  })

  it('resolves nested and same-origin absolute routes to their longest prototype route owner', () => {
    expect(resolvePrototypeNameFromSrc('/Branding/Deep/Panel?theme=dark#step=2', {
      buildPrototypeIndex: () => prototypeIndex,
      baseUrl: '/',
    })).toBe('Signup')
    expect(resolvePrototypeNameFromSrc(`${window.location.origin}/Branding/Deep/Panel`, {
      buildPrototypeIndex: () => prototypeIndex,
      baseUrl: '/',
    })).toBe('Signup')
    expect(resolvePrototypeNameFromSrc('/BrandingElse/Panel', {
      buildPrototypeIndex: () => prototypeIndex,
      baseUrl: '/',
    })).toBeNull()
  })

  it('matches declared prototype routes including nested and branch-prefixed routes', () => {
    const index = { prototypes: [{ name: 'Borrow Flow', dirName: 'BorrowFlow', route: '/borrow-flow', flows: [] }] }
    const deps = { buildPrototypeIndex: () => index, baseUrl: '/' }
    expect(resolvePrototypeNameFromSrc('/borrow-flow', deps)).toBe('BorrowFlow')
    expect(resolvePrototypeNameFromSrc('/borrow-flow/details?step=2#review', deps)).toBe('BorrowFlow')
    expect(resolvePrototypeNameFromSrc('/branch--review/borrow-flow/details', deps)).toBe('BorrowFlow')
    expect(resolvePrototypeNameFromSrc('/BorrowFlow/details', deps)).toBe('BorrowFlow')
  })

  it('allows same-origin absolute targets but excludes cross-origin targets', () => {
    expect(isExternalWidgetTarget({ type: 'prototype', props: { src: `${window.location.origin}/Signup` } })).toBe(false)
    expect(isExternalWidgetTarget({ type: 'prototype', props: { src: 'https://example.com/Signup' } })).toBe(true)
  })

  it('resolves widget-instance knobs from widget config', () => {
    const knobs = [{ id: 'tone', type: 'select', options: ['info', 'danger'] }]
    const deps = {
      getWidgetKnobs: vi.fn(() => knobs),
    }

    const target = resolveKnobsTarget({
      id: 'tile-1',
      widget: { type: 'tile-card', props: { prettyName: 'Tile card' } },
    }, deps)

    expect(target).toEqual({
      id: 'tile-1',
      label: 'Tile card',
      knobs,
      getTargetWindow: null,
    })
    expect(deps.getWidgetKnobs).toHaveBeenCalledWith('tile-card')
  })

  it('skips missing target widgets from stale connector descriptors', () => {
    const resolved = resolveKnobsTargets([
      { id: 'missing-widget', widget: null },
      { id: 'without-schema', widget: { type: 'unknown', props: {} } },
    ], {
      getWidgetKnobs: vi.fn(() => []),
    })

    expect(resolved).toEqual([])
  })
})
