import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter } from 'react-router-dom'
import { installContentNavigationBridge } from './contentNavigationBridge.js'

function routerHarness() {
  const listeners = new Set()
  const router = {
    state: {
      location: { pathname: '/Demo', search: '', hash: '' },
      blockers: new Map(),
      navigation: { state: 'idle' },
    },
    navigate: vi.fn(() => Promise.resolve()),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit() { for (const listener of listeners) listener(router.state) },
  }
  return router
}

function hostRequest(data, { source = window.parent, origin = window.location.origin } = {}) {
  const event = new Event('message')
  Object.defineProperties(event, {
    source: { value: source },
    origin: { value: origin },
    data: { value: data },
  })
  window.dispatchEvent(event)
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function realHostRequest(host, id, target) {
  hostRequest({ type: 'storyboard:embed:navigate-request', id, target }, { source: host })
}

describe('isolated content navigation bridge', () => {
  const cleanups = []
  const routers = []
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup()
    for (const router of routers.splice(0)) router.dispose()
  })

  it.each([
    ['/', '/components/Button/More'],
    ['/branch--preview/', '/components/Button/More'],
    ['/branch--preview/', '/branch--preview/components/Button/More'],
    ['/branch--preview/', '/branch--preview/stories.html/components/Button/More'],
  ])('keeps iframe controls out of public component links at %s with pathname %s', (basePath, pathname) => {
    const router = routerHarness()
    const host = { postMessage: vi.fn() }
    cleanups.push(installContentNavigationBridge(router, { basePath, hostWindow: host, origin: window.location.origin }))
    router.state.location = {
      pathname,
      search: '?keep=authored&_sb_embed=&_sb_component_view=&export=Secondary',
      hash: '#details',
    }
    router.emit()
    expect(host.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'storyboard:embed:navigate',
      src: `${window.location.origin}${basePath}components/Button/More?keep=authored&export=Secondary#details`,
    }), window.location.origin)
  })

  it('announces readiness and commits a host route only after the child router settles', async () => {
    const router = routerHarness()
    const host = { postMessage: vi.fn() }
    cleanups.push(installContentNavigationBridge(router, {
      basePath: '/branch--preview/', hostWindow: host, origin: window.location.origin,
    }))
    expect(host.postMessage).toHaveBeenCalledWith(
      { type: 'storyboard:embed:ready' }, window.location.origin,
    )
    hostRequest({ type: 'storyboard:embed:hello' }, { source: host })
    expect(host.postMessage).toHaveBeenCalledTimes(2)

    const target = '/Demo/details?flow=empty#tab=profile'
    hostRequest({ type: 'storyboard:embed:navigate-request', id: 'nav-1', target }, { source: host })
    expect(router.navigate).toHaveBeenCalledWith(target, { replace: false })

    router.state.blockers.set('form', { state: 'blocked' })
    router.emit()
    expect(host.postMessage).toHaveBeenCalledWith(
      { type: 'storyboard:embed:navigate-blocked', id: 'nav-1' }, window.location.origin,
    )

    router.state.blockers.clear()
    router.state.location = { pathname: '/Demo/details', search: '?flow=empty', hash: '#tab=profile' }
    router.emit()
    expect(host.postMessage).toHaveBeenCalledWith({
      type: 'storyboard:embed:navigate',
      src: `${window.location.origin}/branch--preview/Demo/details?flow=empty#tab=profile`,
      id: 'nav-1', replace: false,
    }, window.location.origin)
  })

  it('reports cancellation and ignores stale, cross-origin, and malformed requests', async () => {
    const router = routerHarness()
    const host = { postMessage: vi.fn() }
    cleanups.push(installContentNavigationBridge(router, { hostWindow: host, origin: window.location.origin }))
    hostRequest({ type: 'storyboard:embed:navigate-request', id: 'cancel-1', target: '/Demo/dirty' }, { source: host })
    await Promise.resolve()
    router.emit()
    expect(host.postMessage).toHaveBeenCalledWith(
      { type: 'storyboard:embed:navigate-cancelled', id: 'cancel-1' }, window.location.origin,
    )

    const calls = router.navigate.mock.calls.length
    hostRequest({ type: 'storyboard:embed:navigate-request', id: 'foreign', target: '/Demo/foreign' }, {
      source: {}, origin: 'https://other.test',
    })
    hostRequest({ type: 'storyboard:embed:navigate-request', id: 'bad', target: '//other.test/Demo' }, { source: host })
    hostRequest({ type: 'storyboard:embed:navigate-request', id: 'bad-slash', target: '/Demo\\private' }, { source: host })
    expect(router.navigate).toHaveBeenCalledTimes(calls)
  })

  it('does not report a superseded child route to the host', () => {
    const router = routerHarness()
    const host = { postMessage: vi.fn() }
    cleanups.push(installContentNavigationBridge(router, { hostWindow: host, origin: window.location.origin }))
    hostRequest({ type: 'storyboard:embed:navigate-request', id: 'old', target: '/Demo/old' }, { source: host })
    hostRequest({ type: 'storyboard:embed:navigate-request', id: 'new', target: '/Demo/new' }, { source: host })
    host.postMessage.mockClear()

    router.state.location = { pathname: '/Demo/old', search: '', hash: '' }
    router.emit()
    expect(router.navigate).toHaveBeenLastCalledWith('/Demo', { replace: true })
    expect(host.postMessage.mock.calls.some(([data]) => data.type === 'storyboard:embed:navigate')).toBe(false)
  })

  it('waits through the real router proceeding/idle/old-location transition before committing', async () => {
    const loader = deferred()
    const router = createMemoryRouter([
      { path: '/Demo', element: null },
      { path: '/Demo/target', loader: () => loader.promise, element: null, errorElement: null },
    ], { initialEntries: ['/Demo'] })
    routers.push(router)
    const shouldBlock = ({ nextLocation }) => nextLocation.pathname === '/Demo/target'
    router.getBlocker('dirty-form', shouldBlock)
    const transitions = []
    router.subscribe(state => transitions.push({
      blocker: state.blockers.get('dirty-form')?.state,
      navigation: state.navigation.state,
      pathname: state.location.pathname,
    }))
    const host = { postMessage: vi.fn() }
    cleanups.push(installContentNavigationBridge(router, { hostWindow: host, origin: window.location.origin }))

    realHostRequest(host, 'real-proceed', '/Demo/target')
    await vi.waitFor(() => expect(router.state.blockers.get('dirty-form')?.state).toBe('blocked'))
    await Promise.resolve()
    await Promise.resolve()

    router.getBlocker('dirty-form', shouldBlock).proceed()
    expect(transitions).toContainEqual({ blocker: 'proceeding', navigation: 'idle', pathname: '/Demo' })
    expect(host.postMessage.mock.calls.some(([data]) => data.type === 'storyboard:embed:navigate-cancelled')).toBe(false)
    await vi.waitFor(() => expect(router.state.navigation.state).toBe('loading'))

    loader.resolve(null)
    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/Demo/target')
      expect(router.state.navigation.state).toBe('idle')
    })
    expect(host.postMessage.mock.calls.some(([data]) =>
      data.type === 'storyboard:embed:navigate' && data.id === 'real-proceed' && data.src.endsWith('/Demo/target'),
    )).toBe(true)
    expect(host.postMessage.mock.calls.some(([data]) =>
      data.type === 'storyboard:embed:navigate-cancelled' && data.id === 'real-proceed',
    )).toBe(false)
  })

  it('reports cancellation after a real blocker reset', async () => {
    const router = createMemoryRouter([
      { path: '/Demo', element: null },
      { path: '/Demo/target', element: null },
    ], { initialEntries: ['/Demo'] })
    routers.push(router)
    const shouldBlock = ({ nextLocation }) => nextLocation.pathname === '/Demo/target'
    router.getBlocker('dirty-form', shouldBlock)
    const host = { postMessage: vi.fn() }
    cleanups.push(installContentNavigationBridge(router, { hostWindow: host, origin: window.location.origin }))

    realHostRequest(host, 'real-reset', '/Demo/target')
    await vi.waitFor(() => expect(router.state.blockers.get('dirty-form')?.state).toBe('blocked'))
    await Promise.resolve()
    await Promise.resolve()
    router.getBlocker('dirty-form', shouldBlock).reset()

    await vi.waitFor(() => expect(host.postMessage.mock.calls.some(([data]) =>
      data.type === 'storyboard:embed:navigate-cancelled' && data.id === 'real-reset',
    )).toBe(true))
    expect(router.state.location.pathname).toBe('/Demo')
  })

  it.each(['/', '/branch--preview/'])('supersedes a real loader and permits a deliberate revisit at %s', async basePath => {
    const oldLoader = deferred()
    const router = createMemoryRouter([
      { path: '/Demo', element: null },
      { path: '/Demo/old', loader: () => oldLoader.promise, element: null },
      { path: '/Demo/new', element: null },
    ], { initialEntries: ['/Demo'] })
    routers.push(router)
    const shouldBlock = ({ nextLocation }) => nextLocation.pathname === '/Demo/old'
    router.getBlocker('dirty-form', shouldBlock)
    const host = { postMessage: vi.fn() }
    cleanups.push(installContentNavigationBridge(router, { basePath, hostWindow: host, origin: window.location.origin }))

    realHostRequest(host, 'superseded-real', '/Demo/old')
    await vi.waitFor(() => expect(router.state.blockers.get('dirty-form')?.state).toBe('blocked'))
    await Promise.resolve()
    await Promise.resolve()
    router.getBlocker('dirty-form', shouldBlock).proceed()
    await vi.waitFor(() => expect(router.state.navigation.state).toBe('loading'))

    realHostRequest(host, 'latest-real', '/Demo/new')
    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/Demo/new')
      expect(router.state.navigation.state).toBe('idle')
    })
    oldLoader.resolve(null)
    await Promise.resolve()
    expect(router.state.location.pathname).toBe('/Demo/new')
    expect(host.postMessage.mock.calls.some(([data]) =>
      data.type === 'storyboard:embed:navigate-cancelled' && data.id === 'superseded-real',
    )).toBe(true)
    expect(host.postMessage.mock.calls.some(([data]) =>
      data.type === 'storyboard:embed:navigate' && data.id === 'superseded-real',
    )).toBe(false)
    expect(host.postMessage.mock.calls.some(([data]) =>
      data.type === 'storyboard:embed:navigate' && data.id === 'latest-real' && data.src.endsWith('/Demo/new'),
    )).toBe(true)

    // The old loader was aborted, so no stale route event consumed its marker.
    // A new deliberate visit must still be allowed through the real blocker.
    realHostRequest(host, 'revisit-real', '/Demo/old')
    await vi.waitFor(() => expect(router.state.blockers.get('dirty-form')?.state).toBe('blocked'))
    router.getBlocker('dirty-form', shouldBlock).proceed()
    await vi.waitFor(() => expect(router.state.navigation.state).toBe('idle'))
    expect(router.state.location.pathname).toBe('/Demo/old')
    expect(host.postMessage.mock.calls.some(([data]) =>
      data.type === 'storyboard:embed:navigate' && data.id === 'revisit-real' && data.src.endsWith('/Demo/old'),
    )).toBe(true)
  })

  it('commits the requested URL when a real loader settles into an error route', async () => {
    const router = createMemoryRouter([
      { path: '/Demo', element: null },
      { path: '/Demo/broken', loader: () => { throw new Response('loader failed', { status: 500 }) }, element: null, errorElement: null },
    ], { initialEntries: ['/Demo'] })
    routers.push(router)
    const shouldBlock = ({ nextLocation }) => nextLocation.pathname === '/Demo/broken'
    router.getBlocker('dirty-form', shouldBlock)
    const host = { postMessage: vi.fn() }
    cleanups.push(installContentNavigationBridge(router, { hostWindow: host, origin: window.location.origin }))

    realHostRequest(host, 'loader-error', '/Demo/broken')
    await vi.waitFor(() => expect(router.state.blockers.get('dirty-form')?.state).toBe('blocked'))
    await Promise.resolve()
    await Promise.resolve()
    router.getBlocker('dirty-form', shouldBlock).proceed()

    await vi.waitFor(() => {
      expect(router.state.location.pathname).toBe('/Demo/broken')
      expect(router.state.navigation.state).toBe('idle')
      expect(router.state.errors).not.toBeNull()
    })
    expect(host.postMessage.mock.calls.some(([data]) =>
      data.type === 'storyboard:embed:navigate' && data.id === 'loader-error' && data.src.endsWith('/Demo/broken'),
    )).toBe(true)
    expect(host.postMessage.mock.calls.some(([data]) =>
      data.type === 'storyboard:embed:navigate-cancelled' && data.id === 'loader-error',
    )).toBe(false)
  })
})
