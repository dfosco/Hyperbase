import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { init } from '../../../core/index.js'
import { getTheme, getThemeSyncTargets, setTheme, setThemeSyncTarget } from '../../../core/stores/themeStore.js'
import { getConfig, initConfig } from '../../../core/stores/configStore.js'
import { getWidgetRef, setWidgetRef } from '../canvasApi.js'
import PrototypeEmbed from './PrototypeEmbed.jsx'
import StoryWidget from './StoryWidget.jsx'
import StorySetWidget from './StorySetWidget.jsx'
import FigmaEmbed from './FigmaEmbed.jsx'
import CodePenEmbed from './CodePenEmbed.jsx'

const originalFetch = globalThis.fetch

const storyIndex = {
  DemoStory: {
    _route: '/components/DemoStory',
    _storyModule: '/src/components/Demo/Demo.story.jsx',
  },
}

function seedDataIndex() {
  init({
    flows: {},
    objects: {},
    records: {},
    prototypes: {},
    folders: {},
    canvases: {},
    stories: storyIndex,
  })
}

/**
 * PrototypeEmbed mounts its iframe only after the interact gate is activated
 * (dormant Frames render the persistent poster instead). Click the gate when
 * present so ref-contract assertions observe the admitted iframe.
 */
function activateInteractGate(container) {
  const gate = container.querySelector('[aria-label="Click to interact with prototype"]')
  if (gate) fireEvent.click(gate)
}

function expectIframeWindow(Component, props) {
  const ref = createRef()
  const { container } = render(<Component id="widget-id" props={props} ref={ref} />)
  activateInteractGate(container)
  const iframe = container.querySelector('iframe')

  expect(iframe).toBeTruthy()
  expect(ref.current?.getIframeWindow()).toBe(iframe.contentWindow)
}

describe('iframe widget ref contract', () => {
  it.each(['', '/branch--docs'])('keeps a canonical Doc URL in the admitted Frame at base %s', base => {
    const src = `${window.location.origin}${base}/docs/review?keep=a%2Fb#body`
    const ref = createRef()
    const view = render(<PrototypeEmbed id="doc-frame" props={{ src, label: 'Review notes' }} ref={ref} />)
    expect(view.container.querySelector('iframe')).toBeNull()
    activateInteractGate(view.container)
    const frame = view.container.querySelector('iframe')
    const actual = new URL(frame.src)
    expect(actual.pathname).toBe(`${base}/docs/review`)
    expect(actual.searchParams.get('keep')).toBe('a/b')
    expect(actual.searchParams.has('_sb_embed')).toBe(true)
    expect(actual.hash).toBe('#body')
    expect(ref.current.getIframeWindow()).toBe(frame.contentWindow)
  })
  it.each([StoryWidget, StorySetWidget])('delivers persisted story overrides and resumes theme inheritance', Component => {
    const previousConfig = getConfig()
    const previousTheme = getTheme()
    const previousSync = getThemeSyncTargets().prototype
    initConfig({ ...previousConfig, theming: { ...previousConfig.theming, themes: { light: {}, dark: {} } } })
    setThemeSyncTarget('prototype', true)
    setTheme('light')
    const props = { storyId: 'DemoStory', exportName: 'Default', frameThemeOverride: 'dark' }
    try {
      const view = render(<Component id="story-theme" props={props} />)
      const theme = () => new URL(view.container.querySelector('iframe').src).searchParams.get('theme')
      expect(theme()).toBe('dark')
      act(() => setTheme('dark'))
      act(() => setTheme('light'))
      expect(theme()).toBe('dark')
      view.rerender(<Component id="story-theme" props={{ ...props, frameThemeOverride: null }} />)
      expect(theme()).toBe('light')
      act(() => setTheme('dark'))
      expect(theme()).toBe('dark')
    } finally {
      cleanup()
      initConfig(previousConfig)
      setThemeSyncTarget('prototype', previousSync)
      setTheme(previousTheme)
    }
  })
  it('reports actual story iframe load readiness with the canvas widget id', () => {
    const listener = vi.fn()
    document.addEventListener('storyboard:canvas:iframe-ready', listener)
    const view = render(<StoryWidget id="story-ready" props={{ storyId: 'DemoStory', exportName: 'Default' }} />)
    fireEvent.load(view.container.querySelector('iframe'))
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      detail: { widgetId: 'story-ready' },
    }))
    document.removeEventListener('storyboard:canvas:iframe-ready', listener)
  })
  beforeEach(() => {
    seedDataIndex()
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false })
  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  it.each([
    ['PrototypeEmbed', PrototypeEmbed, { src: '/Demo', width: 320, height: 240, zoom: 100 }],
    ['StoryWidget', StoryWidget, { storyId: 'DemoStory', exportName: 'Default', width: 320, height: 240 }],
    ['StorySetWidget', StorySetWidget, { storyId: 'DemoStory', width: 320, height: 240 }],
    ['FigmaEmbed', FigmaEmbed, { url: 'https://www.figma.com/design/ABC123/Demo-File', width: 320, height: 240 }],
    ['CodePenEmbed', CodePenEmbed, { url: 'https://codepen.io/demo/pen/ABC123', width: 320, height: 240 }],
  ])('%s exposes its iframe contentWindow', (_name, Component, props) => {
    expectIframeWindow(Component, props)
  })

  it('returns null when no iframe is mounted', () => {
    const ref = createRef()
    expect(ref.current).toBeNull()

    render(<PrototypeEmbed id="prototype-empty" props={{ src: '' }} ref={ref} />)

    expect(ref.current?.getIframeWindow()).toBeNull()
  })

  it('returns null when contentWindow access throws', () => {
    const ref = createRef()
    const { container } = render(
      <PrototypeEmbed
        id="prototype-denied"
        props={{ src: '/Demo', width: 320, height: 240, zoom: 100 }}
        ref={ref}
      />,
    )
    activateInteractGate(container)
    const iframe = container.querySelector('iframe')

    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      get() {
        throw new Error('contentWindow denied')
      },
    })

    expect(ref.current?.getIframeWindow()).toBeNull()
  })

  it('reloads local canvas embeds when their Site starts', () => {
    const { container } = render(<PrototypeEmbed id="site-embed" props={{ src: 'http://localhost:4311/' }} />)
    activateInteractGate(container)
    const originalFrame = container.querySelector('iframe')

    act(() => {
      document.dispatchEvent(new CustomEvent('storyboard:site-started', {
        detail: { siteId: 'local-site', developmentBaseUrl: 'http://localhost:4311/' },
      }))
    })

    expect(container.querySelector('iframe')).not.toBe(originalFrame)
  })

  it('does not reload a local canvas embed for a different Site origin', () => {
    const { container } = render(<PrototypeEmbed id="other-site-embed" props={{ src: 'http://localhost:4311/' }} />)
    activateInteractGate(container)
    const originalFrame = container.querySelector('iframe')

    act(() => {
      document.dispatchEvent(new CustomEvent('storyboard:site-started', {
        detail: { siteId: 'another-site', developmentBaseUrl: 'http://localhost:4321/' },
      }))
    })

    expect(container.querySelector('iframe')).toBe(originalFrame)
  })

  it('uses the public frame URL as theme state and clears legacy overrides on a frame action', async () => {
    const previousConfig = getConfig()
    const previousSync = localStorage.getItem('sb-theme-sync')
    const previousCanvasTheme = document.documentElement.getAttribute('data-sb-canvas-theme')
    initConfig({
      ...previousConfig,
      theming: {
        ...previousConfig.theming,
        themes: {
          light: { label: 'Light' },
          dark: { label: 'Dark' },
        },
      },
    })
    localStorage.setItem('sb-theme-sync', JSON.stringify({ canvas: true }))
    document.documentElement.setAttribute('data-sb-canvas-theme', 'light')
    const onUpdate = vi.fn()
    const ref = createRef()
    const props = { src: '/Demo', width: 320, height: 240, frameThemeOverride: 'dark' }

    try {
      const view = render(<PrototypeEmbed id="theme-frame" props={props} onUpdate={onUpdate} ref={ref} />)
      activateInteractGate(view.container)
      const iframeTheme = () => new URL(view.container.querySelector('iframe').src).searchParams.get('theme')
      const iframe = view.container.querySelector('iframe')
      const postMessage = vi.spyOn(iframe.contentWindow, 'postMessage')

      expect(iframeTheme()).toBeNull()
      act(() => {
        document.documentElement.setAttribute('data-sb-canvas-theme', 'light')
        document.dispatchEvent(new Event('storyboard:theme:changed'))
      })
      expect(iframeTheme()).toBeNull()

      act(() => ref.current.handleAction('set-frame-theme', { value: 'dark' }))
      expect(postMessage).toHaveBeenCalledWith({
        type: 'storyboard:embed:set-theme',
        theme: 'dark',
        inheritedTheme: 'light',
      }, window.location.origin)
      expect(onUpdate).toHaveBeenCalledWith({ frameThemeOverride: null })
      act(() => window.dispatchEvent(new MessageEvent('message', {
        source: iframe.contentWindow,
        data: { type: 'storyboard:embed:navigate', src: '/Demo?theme=dark', replace: true },
      })))
      expect(onUpdate).toHaveBeenLastCalledWith({
        src: '/Demo?theme=dark',
        originalSrc: '/Demo',
        frameThemeOverride: null,
      })
      view.rerender(<PrototypeEmbed id="theme-frame" props={{ ...props, src: '/Demo?theme=dark', frameThemeOverride: null }} onUpdate={onUpdate} ref={ref} />)
      await waitFor(() => expect(iframeTheme()).toBe('dark'))

      const themedFramePostMessage = vi.spyOn(view.container.querySelector('iframe').contentWindow, 'postMessage')
      act(() => ref.current.handleAction('set-frame-theme', { value: 'inherit' }))
      expect(themedFramePostMessage).toHaveBeenCalledWith({
        type: 'storyboard:embed:set-theme',
        theme: 'inherit',
        inheritedTheme: 'light',
      }, window.location.origin)
      view.rerender(<PrototypeEmbed id="theme-frame" props={{ ...props, frameThemeOverride: null }} onUpdate={onUpdate} ref={ref} />)
      await waitFor(() => expect(iframeTheme()).toBeNull())
      act(() => {
        document.documentElement.setAttribute('data-sb-canvas-theme', 'dark')
        document.dispatchEvent(new Event('storyboard:theme:changed'))
      })
      expect(iframeTheme()).toBeNull()
    } finally {
      initConfig(previousConfig)
      if (previousSync === null) localStorage.removeItem('sb-theme-sync')
      else localStorage.setItem('sb-theme-sync', previousSync)
      if (previousCanvasTheme === null) document.documentElement.removeAttribute('data-sb-canvas-theme')
      else document.documentElement.setAttribute('data-sb-canvas-theme', previousCanvasTheme)
    }
  })

  it('exposes registered widget instances through canvasApi.getWidgetRef', () => {
    const handle = { getIframeWindow: vi.fn() }

    setWidgetRef('target-widget', handle)
    expect(getWidgetRef('target-widget')).toBe(handle)

    setWidgetRef('target-widget', null)
    expect(getWidgetRef('target-widget')).toBeNull()
  })
})
