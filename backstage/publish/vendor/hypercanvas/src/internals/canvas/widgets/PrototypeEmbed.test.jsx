import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { init } from '../../../core/index.js'
import { getEmbedChromeVars } from './embedTheme.js'
import { normalizeLegacyEmbedSrc } from './normalizeLegacyEmbedSrc.js'
import PrototypeEmbed, { isLocalDevEmbedUrl, getAbsoluteEmbedOrigin } from './PrototypeEmbed.jsx'
import { buildPrototypePickerEntries, embedRoutePath, resolveLivePrototypeRefreshTarget, resolvePrototypeFrameUrl, samePrototypeFrameLocation, stripEmbedRoute } from './prototypePickerEntries.js'

const originalFetch = globalThis.fetch

beforeEach(() => {
  init({ flows: {}, objects: {}, records: {}, prototypes: {}, folders: {}, canvases: {}, stories: {} })
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: false })
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  globalThis.fetch = originalFetch
  delete window.__storyboardCanvasBridgeState
  localStorage.removeItem('sb-theme-sync')
  localStorage.removeItem('sb-color-scheme')
  document.documentElement.removeAttribute('data-sb-canvas-theme')
})

describe('getEmbedChromeVars', () => {
  it('returns an empty object — color tokens now cascade from data-sb-canvas-theme via tailwind.css', () => {
    expect(getEmbedChromeVars('light')).toEqual({})
    expect(getEmbedChromeVars('dark')).toEqual({})
    expect(getEmbedChromeVars('dark_dimmed')).toEqual({})
  })
})

describe('normalizeLegacyEmbedSrc', () => {
  it('passes through clean canvas-app routes unchanged', () => {
    expect(normalizeLegacyEmbedSrc('/cq-org-enablement')).toBe('/cq-org-enablement')
    expect(normalizeLegacyEmbedSrc('/MyProto/SignupForm')).toBe('/MyProto/SignupForm')
    expect(normalizeLegacyEmbedSrc('/cq-org-enablement#x=1')).toBe('/cq-org-enablement#x=1')
  })

  it('passes through external http(s) URLs unchanged', () => {
    expect(normalizeLegacyEmbedSrc('https://example.com/foo')).toBe('https://example.com/foo')
  })

  it('passes through empty/falsy values', () => {
    expect(normalizeLegacyEmbedSrc('')).toBe('')
    expect(normalizeLegacyEmbedSrc(null)).toBe(null)
    expect(normalizeLegacyEmbedSrc(undefined)).toBe(undefined)
  })

  describe('legacy hash-form: /prototypes.html#/<route>', () => {
    it('strips loader prefix and keeps inner route', () => {
      expect(normalizeLegacyEmbedSrc('/prototypes.html#/cq-org-enablement')).toBe('/cq-org-enablement')
    })

    it('keeps query strings inside inner', () => {
      expect(normalizeLegacyEmbedSrc('/prototypes.html#/cq-org-enablement?cqConfirmOpen=true'))
        .toBe('/cq-org-enablement?cqConfirmOpen=true')
    })

    it('handles non-root basePath', () => {
      expect(normalizeLegacyEmbedSrc('/storyboard/prototypes.html#/MyProto')).toBe('/MyProto')
    })

    it('returns "/" for empty inner', () => {
      expect(normalizeLegacyEmbedSrc('/prototypes.html#')).toBe('/')
    })

    it('prefixes "/" if inner missing leading slash', () => {
      expect(normalizeLegacyEmbedSrc('/prototypes.html#MyProto')).toBe('/MyProto')
    })
  })

  describe('legacy URLSearchParams-clobbered form (real-world 0.6.13/0.6.14 bug)', () => {
    // Real bug: storyboard's session.writeHash did URLSearchParams.toString()
    // on the entire hash, which URL-encoded the route slash to %2F and turned
    // /MyProto into a key with an empty value. Real persisted srcs from the
    // wild look like /prototypes.html#%2Fcq-org-enablement=&cqConfirmOpen=true
    it('recovers route from URLSearchParams-mangled hash', () => {
      expect(
        normalizeLegacyEmbedSrc('/prototypes.html#%2Fcq-org-enablement=&cqConfirmOpen=true'),
      ).toBe('/cq-org-enablement#cqConfirmOpen=true')
    })

    it('recovers route with no surviving storyboard state', () => {
      expect(normalizeLegacyEmbedSrc('/prototypes.html#%2Fcq-org-enablement=')).toBe('/cq-org-enablement')
    })

    it('recovers route with multiple storyboard params', () => {
      expect(
        normalizeLegacyEmbedSrc(
          '/prototypes.html#%2Fcq-org-enablement=&cqEnabled=null&cqFlashDismissed=null&cqConfirmOpen=true',
        ),
      ).toBe('/cq-org-enablement#cqEnabled=null&cqFlashDismissed=null&cqConfirmOpen=true')
    })

    it('recovers nested route', () => {
      expect(
        normalizeLegacyEmbedSrc('/prototypes.html#%2FMyProto%2FSignupForm=&x=1'),
      ).toBe('/MyProto/SignupForm#x=1')
    })

    it('handles non-root basePath', () => {
      expect(
        normalizeLegacyEmbedSrc('/storyboard/prototypes.html#%2FMyProto=&x=1'),
      ).toBe('/MyProto#x=1')
    })
  })

  describe('defensive path-form: /prototypes.html/<route>', () => {
    it('strips loader prefix', () => {
      expect(normalizeLegacyEmbedSrc('/prototypes.html/MyProto')).toBe('/MyProto')
    })

    it('handles nested routes', () => {
      expect(normalizeLegacyEmbedSrc('/prototypes.html/MyProto/SignupForm')).toBe('/MyProto/SignupForm')
    })

    it('handles non-root basePath', () => {
      expect(normalizeLegacyEmbedSrc('/storyboard/prototypes.html/MyProto')).toBe('/MyProto')
    })
  })

  describe('all-encompassing regression — no legacy shape can produce a /prototypes.html src', () => {
    const cases = [
      '/prototypes.html#/foo',
      '/prototypes.html#/foo?bar=1',
      '/prototypes.html#',
      '/prototypes.html#%2Ffoo=&bar=1',
      '/prototypes.html#%2Ffoo%2Fbar=&x=1',
      '/prototypes.html/foo',
      '/prototypes.html/foo/bar',
      '/storyboard/prototypes.html#/foo',
      '/storyboard/prototypes.html#%2Ffoo=&x=1',
      '/storyboard/prototypes.html/foo',
    ]
    for (const input of cases) {
      it(`recovers ${input}`, () => {
        const result = normalizeLegacyEmbedSrc(input)
        expect(result).not.toMatch(/prototypes\.html/)
        expect(result.startsWith('/')).toBe(true)
      })
    }
  })
})

describe('isLocalDevEmbedUrl', () => {
  it('matches localhost http(s) URLs (any port)', () => {
    expect(isLocalDevEmbedUrl('http://localhost:5200/MyProto')).toBe(true)
    expect(isLocalDevEmbedUrl('https://localhost:443/MyProto')).toBe(true)
    expect(isLocalDevEmbedUrl('http://127.0.0.1:3000/Foo')).toBe(true)
    expect(isLocalDevEmbedUrl('http://[::1]:8080/Foo')).toBe(true)
  })

  it('rejects external hosts and non-http(s) protocols', () => {
    expect(isLocalDevEmbedUrl('https://example.com/foo')).toBe(false)
    expect(isLocalDevEmbedUrl('http://my-app.local/foo')).toBe(false)
    expect(isLocalDevEmbedUrl('ftp://localhost/foo')).toBe(false)
  })

  it('rejects relative paths and garbage', () => {
    expect(isLocalDevEmbedUrl('/MyProto')).toBe(false)
    expect(isLocalDevEmbedUrl('')).toBe(false)
    expect(isLocalDevEmbedUrl(null)).toBe(false)
    expect(isLocalDevEmbedUrl(undefined)).toBe(false)
  })
})

describe('getAbsoluteEmbedOrigin', () => {
  it('returns the origin for local dev URLs', () => {
    expect(getAbsoluteEmbedOrigin('http://localhost:5200/MyProto/Sub?x=1#y')).toBe('http://localhost:5200')
    expect(getAbsoluteEmbedOrigin('http://127.0.0.1:3000/Foo')).toBe('http://127.0.0.1:3000')
  })

  it('returns "" for external or relative URLs', () => {
    expect(getAbsoluteEmbedOrigin('https://example.com/foo')).toBe('')
    expect(getAbsoluteEmbedOrigin('/MyProto')).toBe('')
    expect(getAbsoluteEmbedOrigin('')).toBe('')
  })
})

describe('PrototypeEmbed prototype chooser', () => {
  function mountChooser() {
    init({
      flows: {
        'Demo/home': { meta: { title: 'Home', default: true } },
        'Other/home': { meta: { title: 'Home', default: true } },
      },
      objects: {},
      records: {},
      prototypes: {
        Demo: { meta: { title: 'Demo project' } },
        Other: { meta: { title: 'Another prototype with a long title' } },
      },
      folders: {},
      canvases: {},
      stories: {},
    })
    const ref = createRef()
    const onUpdate = vi.fn()
    const view = render(<PrototypeEmbed id="chooser" props={{ src: '/Demo' }} onUpdate={onUpdate} ref={ref} />)
    act(() => ref.current.handleAction('edit'))
    return { ...view, ref, onUpdate }
  }

  it('keeps title and directory labels aligned in both selected and unselected rows', () => {
    const { getByRole } = mountChooser()
    const selected = getByRole('button', { name: 'Use Demo project' })
    const unselected = getByRole('button', { name: 'Use Another prototype with a long title' })

    expect(selected.getAttribute('aria-pressed')).toBe('true')
    expect(unselected.getAttribute('aria-pressed')).toBe('false')
    expect(selected.className).toContain('pickerItem')
    expect(selected.className).toContain('pickerItemSelected')
    expect(unselected.className).toContain('pickerItem')
    expect(unselected.className).not.toContain('pickerItemSelected')
    expect(selected.querySelector('small')).toHaveTextContent('Demo')
    expect(unselected.querySelector('small')).toHaveTextContent('Other')
    expect(selected.querySelector('span').className).toContain('pickerItemTitle')
    expect(unselected.querySelector('span').className).toContain('pickerItemTitle')
  })

  it('keeps selecting a prototype and Escape cancellation functional', () => {
    const { getByRole, onUpdate, ref } = mountChooser()
    fireEvent.click(getByRole('button', { name: 'Use Another prototype with a long title' }))
    expect(onUpdate).toHaveBeenCalledWith({ src: '/?flow=Other%2Fhome' })
    expect(document.querySelector('[aria-label="Choose a Prototype"]')).toBeNull()

    act(() => ref.current.handleAction('edit'))
    fireEvent.keyDown(document.querySelector('[aria-label="Choose a Prototype"]'), { key: 'Escape' })
    expect(document.querySelector('[aria-label="Choose a Prototype"]')).toBeNull()
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('embedRoutePath', () => {
  it('keeps only the path of relative routes', () => {
    expect(embedRoutePath('/StartupSignup?flow=loopline-signup%2Fsuccess')).toBe('/StartupSignup')
    expect(embedRoutePath('/MyProto/Page#section')).toBe('/MyProto/Page')
    expect(embedRoutePath('/StartupSignup?flow=ok#state=x')).toBe('/StartupSignup')
  })

  it('strips branch deploy prefixes', () => {
    expect(embedRoutePath('/branch--feature/MyProto')).toBe('/MyProto')
  })

  it('keeps pathname+hash for absolute URLs and tolerates garbage', () => {
    expect(embedRoutePath('http://localhost:5200/MyProto?x=1')).toBe('/MyProto')
    expect(embedRoutePath('https://example.com/foo#bar')).toBe('/foo#bar')
    expect(embedRoutePath(null)).toBe('')
    expect(embedRoutePath(42)).toBe('')
  })
})

describe('stripEmbedRoute', () => {
  it('removes only the branch prefix', () => {
    expect(stripEmbedRoute('/branch--x/MyProto?flow=a%2Fb')).toBe('/MyProto?flow=a%2Fb')
    expect(stripEmbedRoute('/MyProto')).toBe('/MyProto')
    expect(stripEmbedRoute(123)).toBe('')
  })
})

describe('resolvePrototypeFrameUrl', () => {
  it('opens the live nested route and removes the development iframe entry segment', () => {
    expect(resolvePrototypeFrameUrl(
      'http://localhost:5173/branch--feature/prototypes.html/demo/guide?tab=one#intro',
      'http://localhost:5173/branch--feature/demo',
    )).toBe('http://localhost:5173/branch--feature/demo/guide?tab=one#intro')
  })

  it('preserves the literal-suffix route and branch prefix for embedded prototype URLs', () => {
    expect(resolvePrototypeFrameUrl(
      'http://localhost:5173/branch--folder-artifacts/prototypes.html/Dashboard.prototype/guide?tab=one#intro',
      'http://localhost:5173/branch--folder-artifacts/Dashboard.prototype',
    )).toBe('http://localhost:5173/branch--folder-artifacts/Dashboard.prototype/guide?tab=one#intro')
  })

  it('opens the live route without generated embed transport parameters', () => {
    expect(resolvePrototypeFrameUrl(
      'https://app.test/branch--review/prototypes.html/Demo/details?theme=dark&_sb_embed=&_sb_component_view=1&_sb_theme_target=prototype&sb_knobs=1&flow=keep#knobAccent=240',
      'https://app.test/branch--review/Demo',
    )).toBe('https://app.test/branch--review/Demo/details?theme=dark&flow=keep#knobAccent=240')
  })

  it('keeps direct production routes and falls back for cross-origin or invalid current URLs', () => {
    expect(resolvePrototypeFrameUrl('https://example.com/demo/guide', 'https://example.com/demo')).toBe('https://example.com/demo/guide')
    expect(resolvePrototypeFrameUrl('https://other.example/path', 'http://localhost:5173/demo')).toBe('http://localhost:5173/demo')
    expect(resolvePrototypeFrameUrl(undefined, 'http://localhost:5173/demo')).toBe('http://localhost:5173/demo')
  })
})

describe('samePrototypeFrameLocation', () => {
  it('recognizes the direct route report as the live document behind the dev isolation route', () => {
    expect(samePrototypeFrameLocation(
      'http://localhost:5173/branch--review/prototypes.html/Demo/details?theme=dark&_sb_embed&_sb_theme_target=prototype&sb_knobs=1&flow=keep#knobAccent=240',
      'http://localhost:5173/branch--review/Demo/details?flow=keep&theme=dark#knobAccent=240',
      'http://localhost:5173/branch--review/canvas/demo',
    )).toBe(true)
  })
})

describe('resolveLivePrototypeRefreshTarget', () => {
  it.each([
    ['/prototypes.html/Demo/Guide?flow=success&_sb_embed&_sb_canvas_theme=dark#step=review', '/Demo/Guide?flow=success#step=review', '/'],
    ['/nested/prototypes.html/Demo/Guide?flow=success&_sb_embed&_sb_canvas_theme=dark#step=review', '/Demo/Guide?flow=success#step=review', '/nested/'],
    ['/branch--feature/prototypes.html/Demo/Guide?flow=success&_sb_embed&_sb_canvas_theme=dark#step=review', '/Demo/Guide?flow=success#step=review', '/branch--feature/'],
  ])('preserves the live isolated route under base %s', (pathname, src, basePath) => {
    const target = resolveLivePrototypeRefreshTarget(`https://canvas.test${pathname}`, {
      expectedOrigin: 'https://canvas.test',
      basePath,
      development: true,
    })
    expect(target?.src).toBe(src)
    expect(target?.frameUrl).toBe(`https://canvas.test${pathname}`)
  })

  it('refreshes a public ContentFrame route in development only within the authored prototype', () => {
    expect(resolveLivePrototypeRefreshTarget('https://canvas.test/UrlStateProbe.prototype?theme=dark&_sb_embed=#knobAccent=245', {
      expectedOrigin: 'https://canvas.test',
      basePath: '/',
      development: true,
      authoredSrc: '/UrlStateProbe.prototype?campaign=canvas',
    })).toEqual({
      frameUrl: 'https://canvas.test/UrlStateProbe.prototype?theme=dark&_sb_embed=#knobAccent=245',
      src: '/UrlStateProbe.prototype?theme=dark#knobAccent=245',
      sourceKind: 'isolated-route',
    })
    expect(resolveLivePrototypeRefreshTarget('https://canvas.test/Other.prototype/Guide', {
      expectedOrigin: 'https://canvas.test', basePath: '/', development: true,
      authoredSrc: '/UrlStateProbe.prototype',
    })).toBeNull()
  })

  it('refreshes an absolute same-origin prototype route after theme state makes src absolute', () => {
    expect(resolveLivePrototypeRefreshTarget('https://canvas.test/prototypes.html/UrlStateProbe.prototype/Guide?theme=dark&_sb_embed#step=review', {
      expectedOrigin: 'https://canvas.test',
      basePath: '/',
      development: true,
      authoredSrc: 'https://canvas.test/UrlStateProbe.prototype?campaign=canvas',
    })).toEqual({
      frameUrl: 'https://canvas.test/prototypes.html/UrlStateProbe.prototype/Guide?theme=dark&_sb_embed#step=review',
      src: '/UrlStateProbe.prototype/Guide?theme=dark#step=review',
      sourceKind: 'isolated-route',
    })
  })

  it('accepts a direct production route and rejects unsafe or stale URL shapes without fallback', () => {
    expect(resolveLivePrototypeRefreshTarget('https://canvas.test/nested/Demo/Guide?x=1#y=2', {
      expectedOrigin: 'https://canvas.test', basePath: '/nested/', development: false,
    })).toEqual({
      frameUrl: 'https://canvas.test/nested/Demo/Guide?x=1#y=2',
      src: '/Demo/Guide?x=1#y=2',
      sourceKind: 'isolated-route',
    })
    for (const unsafe of [
      'javascript:alert(1)',
      'https://foreign.test/prototypes.html/Demo',
      'https://canvas.test/nested-other/prototypes.html/Demo',
      'https://canvas.test/nested/Demo',
      'https://canvas.test/nested/prototypes.html',
    ]) {
      expect(resolveLivePrototypeRefreshTarget(unsafe, {
        expectedOrigin: 'https://canvas.test', basePath: '/nested/', development: true,
      })).toBeNull()
    }
  })

  it('preserves an explicitly authored same-origin direct HTML URL as an absolute target', () => {
    const authoredSrc = 'http://localhost:1234/@fs/preview/index.html?variant=start'
    const liveUrl = 'http://localhost:1234/@fs/preview/index.html?variant=start&_sb_embed&_sb_hide_branch_bar&_sb_theme_target=prototype&_sb_canvas_theme=dark#review'
    expect(resolveLivePrototypeRefreshTarget(liveUrl, {
      expectedOrigin: 'http://localhost:1234',
      basePath: '/',
      development: true,
      authoredSrc,
    })).toEqual({ frameUrl: liveUrl, src: liveUrl, sourceKind: 'direct-html' })
  })

  it('does not infer direct HTML permission from an isolated route or accept a foreign authored URL', () => {
    const directHtml = 'http://localhost:1234/@fs/preview/index.html?variant=start'
    expect(resolveLivePrototypeRefreshTarget(directHtml, {
      expectedOrigin: 'http://localhost:1234', basePath: '/', development: true, authoredSrc: '/Demo',
    })).toBeNull()
    expect(resolveLivePrototypeRefreshTarget(directHtml, {
      expectedOrigin: 'http://localhost:1234', basePath: '/', development: true,
      authoredSrc: 'http://foreign.test/@fs/preview/index.html',
    })).toBeNull()
    expect(resolveLivePrototypeRefreshTarget('http://localhost:1234/@fs/other/index.html?variant=start', {
      expectedOrigin: 'http://localhost:1234', basePath: '/', development: true, authoredSrc: directHtml,
    })).toBeNull()
  })
})

describe('PrototypeEmbed direct file previews', () => {
  it.each([
    ['/', '/@fs/Users/example/preview.html', '/@fs/Users/example/preview.html'],
    ['/', '/notebook-assets/previews/index.html', '/notebook-assets/previews/index.html'],
    ['/branch--preview/', '/notebook-assets/previews/index.html', '/branch--preview/notebook-assets/previews/index.html'],
    ['/branch--preview/', '/branch--old/notebook-assets/previews/index.html', '/branch--preview/notebook-assets/previews/index.html'],
    ['/branch--preview/', '/@fs/Users/example/preview.html', '/branch--preview/@fs/Users/example/preview.html'],
    ['/branch--preview/', '/branch--old/@fs/Users/example/preview.html', '/branch--preview/@fs/Users/example/preview.html'],
  ])('preserves a file document at base %s from %s', (base, path, expectedPath) => {
    vi.stubEnv('BASE_URL', base)
    const src = `${path}?variant=start#details`
    const onUpdate = vi.fn()
    const view = render(<PrototypeEmbed id="file-preview" props={{ src }} onUpdate={onUpdate} />)
    const gate = view.container.querySelector('[aria-label="Click to interact with prototype"]')
    if (gate) fireEvent.click(gate)
    const iframe = view.container.querySelector('iframe')
    expect(iframe).toBeTruthy()
    const url = new URL(iframe.getAttribute('src'), window.location.origin)
    expect(url.pathname).toBe(expectedPath)
    expect(url.searchParams.get('variant')).toBe('start')
    expect(url.hash).toBe('#details')
    expect(onUpdate).not.toHaveBeenCalled()
  })
})

describe('PrototypeEmbed explicit refresh action', () => {
  function mountFrame(src = '/Demo', currentUrl) {
    const ref = createRef()
    const onUpdate = vi.fn()
    const view = render(<PrototypeEmbed id="refresh-probe" props={{ src }} onUpdate={onUpdate} ref={ref} />)
    const gate = view.container.querySelector('[aria-label="Click to interact with prototype"]')
    if (gate) fireEvent.click(gate)
    const iframe = view.container.querySelector('iframe')
    const childDocument = { documentElement: {} }
    const liveLocation = {
      href: currentUrl || `${window.location.origin}${import.meta.env.BASE_URL}prototypes.html/Demo/Guide?flow=live&_sb_embed&_sb_hide_branch_bar&_sb_theme_target=prototype#state=transient`,
    }
    const writes = []
    let assignedSrc = iframe.getAttribute('src')
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { location: liveLocation },
    })
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      value: childDocument,
    })
    Object.defineProperty(iframe, 'src', {
      configurable: true,
      get: () => assignedSrc,
      set: value => { writes.push(value); assignedSrc = value },
    })
    return { ...view, iframe, liveLocation, childDocument, writes, ref, onUpdate }
  }

  it('refreshes a safe same-origin frame directly and persists its live URL state', () => {
    const { container, iframe, writes, ref, onUpdate } = mountFrame()
    act(() => ref.current.handleAction('refresh-frame'))

    expect(container.ownerDocument.querySelector('[role="dialog"]')).toBeNull()
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith({
      src: '/Demo/Guide?flow=live#state=transient',
      originalSrc: '/Demo',
    })
    expect(writes).toEqual([expect.stringContaining('/prototypes.html/Demo/Guide?flow=live')])
    expect(writes[0]).toContain('#state=transient')
    expect(writes[0]).toContain('_sb_embed')
    expect(iframe).toBeTruthy()
  })

  it('refuses an unreadable child URL instead of using the configured src', () => {
    const { container, iframe, ref, writes, onUpdate } = mountFrame()
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      get() { throw new Error('cross-origin frame') },
    })
    act(() => ref.current.handleAction('refresh-frame'))

    expect(container.ownerDocument.body.textContent).toContain('cannot be safely refreshed')
    expect(writes).toEqual([])
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('refreshes an authored same-origin direct HTML preview without wrapping its URL', () => {
    const authoredSrc = `${window.location.origin}/@fs/preview/index.html?variant=start`
    const liveUrl = `${authoredSrc}&_sb_embed&_sb_hide_branch_bar&_sb_theme_target=prototype#review`
    const { container, iframe, ref, onUpdate, writes } = mountFrame(authoredSrc, liveUrl)
    act(() => ref.current.handleAction('refresh-frame'))

    expect(container.ownerDocument.querySelector('[role="dialog"]')).toBeNull()
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith({ src: liveUrl, originalSrc: authoredSrc })
    expect(writes).toEqual([liveUrl])
    expect(writes[0]).toContain('/@fs/preview/index.html?variant=start')
    expect(writes[0]).toContain('#review')
    expect(iframe).toBeTruthy()
  })

  it('keeps the live iframe mounted while opening and cancelling Switch prototype', () => {
    const { container, ref } = mountFrame()
    const iframe = container.querySelector('iframe')
    act(() => ref.current.handleAction('edit'))
    expect(container.querySelector('iframe')).toBe(iframe)
    fireEvent.click(container.ownerDocument.querySelector('button[aria-label="Close"]'))
    expect(container.querySelector('iframe')).toBe(iframe)
  })
})

describe('buildPrototypePickerEntries', () => {
  const folderProto = {
    name: 'Loopline Signup',
    dirName: 'loopline-signup',
    isExternal: false,
    flows: [
      { name: 'empty', route: '/StartupSignup?flow=loopline-signup%2Fempty', meta: null },
      { name: 'success', route: '/StartupSignup?flow=loopline-signup%2Fsuccess', meta: { title: 'Success' } },
      { name: 'submitting', route: '/StartupSignup?flow=loopline-signup%2Fsubmitting', meta: { title: 'Submitting', default: true } },
    ],
  }
  const plainProto = {
    name: 'Welcome',
    dirName: 'welcome',
    isExternal: false,
    flows: [],
  }
  const externalProto = {
    name: 'External Docs',
    dirName: 'docs-site',
    isExternal: true,
    flows: [],
  }

  it('flattens folders and ungrouped prototypes into one sorted list, skipping externals', () => {
    const index = {
      sorted: { title: { folders: [{ prototypes: [folderProto] }], prototypes: [plainProto, externalProto] } },
    }
    const entries = buildPrototypePickerEntries(index)
    expect(entries.map(e => `${e.title}|${e.dirName}`)).toEqual([
      'Loopline Signup|loopline-signup',
      'Welcome|welcome',
    ])
  })

  it('picks the default flow route as the representative src and lists every owning route', () => {
    const entries = buildPrototypePickerEntries({ sorted: { title: { folders: [], prototypes: [folderProto] } } })
    expect(entries[0].route).toBe('/StartupSignup?flow=loopline-signup%2Fsubmitting')
    expect(entries[0].routes).toEqual([
      '/loopline-signup',
      '/StartupSignup?flow=loopline-signup%2Fempty',
      '/StartupSignup?flow=loopline-signup%2Fsuccess',
      '/StartupSignup?flow=loopline-signup%2Fsubmitting',
    ])
    expect(entries[0].flows.map(f => f.name)).toEqual(['Empty', 'Success', 'Submitting'])
  })

  it('falls back to the prototype index route when it has no flows', () => {
    const entries = buildPrototypePickerEntries({ sorted: { title: { folders: [], prototypes: [plainProto] } } })
    expect(entries[0].route).toBe('/welcome')
    expect(entries[0].routes).toEqual(['/welcome'])
  })

  it('uses the canonical literal-suffix route while keeping the logical picker identity', () => {
    const proto = { ...plainProto, dirName: 'Dashboard', route: '/Dashboard.prototype' }
    const [entry] = buildPrototypePickerEntries({ sorted: { title: { folders: [], prototypes: [proto] } } })
    expect(entry.dirName).toBe('Dashboard')
    expect(entry.route).toBe('/Dashboard.prototype')
    expect(entry.routes).toEqual(['/Dashboard.prototype'])
  })

  it('dedupes prototypes by dirName and tolerates empty indexes', () => {
    expect(buildPrototypePickerEntries({ sorted: { title: { folders: [], prototypes: [plainProto, plainProto] } } }).length).toBe(1)
    expect(buildPrototypePickerEntries(null)).toEqual([])
    expect(buildPrototypePickerEntries({})).toEqual([])
  })
})
