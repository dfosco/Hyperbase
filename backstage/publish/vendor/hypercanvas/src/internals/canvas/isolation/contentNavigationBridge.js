import { computeEmbedNavigationSrc } from '../../../core/embedNavigation.js'

/** Synchronize the isolated content router with its public host route. */
export function installContentNavigationBridge(router, {
  basePath = '/',
  hostWindow = window.parent,
  origin = window.location.origin,
} = {}) {
  const pendingHostNavigations = new Map()
  const supersededTargets = new Set()
  let lastChildRoute = routeKey(router.state.location)
  const sendToHost = data => hostWindow.postMessage(data, origin)
  const syncHostNavigation = state => {
    const childRoute = routeKey(state.location)
    const blockers = [...(state.blockers?.values?.() || [])]
    const activeBlocker = blockers.find(item => item.state === 'blocked')
    const proceedingBlocker = blockers.some(item => item.state === 'proceeding')
    if (childRoute !== lastChildRoute && state.navigation.state === 'idle' && supersededTargets.has(childRoute)) {
      supersededTargets.delete(childRoute)
      void router.navigate(lastChildRoute, { replace: true })
      return
    }
    for (const request of pendingHostNavigations.values()) {
      if (activeBlocker) {
        if (!request.blocked) {
          request.blocked = true
          sendToHost({ type: 'storyboard:embed:navigate-blocked', id: request.id })
        }
        continue
      }
      // React Router publishes `proceeding` before it starts the resumed
      // navigation. At that point navigation is still idle at the old URL;
      // a settled `navigate()` promise only means the blocker intercepted it.
      if (proceedingBlocker) continue
      if (childRoute === request.target && state.navigation.state === 'idle') {
        pendingHostNavigations.delete(request.id)
        lastChildRoute = childRoute
        sendChildRouteToHost(state.location, request.id, request.replace, { basePath, hostWindow, origin })
      } else if (request.settled && state.navigation.state === 'idle') {
        pendingHostNavigations.delete(request.id)
        sendToHost({ type: 'storyboard:embed:navigate-cancelled', id: request.id })
      }
    }
    if (childRoute !== lastChildRoute && state.navigation.state === 'idle') {
      lastChildRoute = childRoute
      if (![...pendingHostNavigations.values()].some(item => item.target === childRoute)) {
        sendChildRouteToHost(state.location, undefined, false, { basePath, hostWindow, origin })
      }
    }
  }
  const unsubscribeRouter = router.subscribe(syncHostNavigation)
  const onHostNavigate = event => {
    if (event.source !== hostWindow || event.origin !== origin) return
    const data = event.data
    if (data?.type === 'storyboard:embed:hello') {
      sendToHost({ type: 'storyboard:embed:ready' })
      return
    }
    if (data?.type !== 'storyboard:embed:navigate-request' || typeof data.id !== 'string') return
    if (typeof data.target !== 'string' || !data.target.startsWith('/') || data.target.startsWith('//') || data.target.includes('\\')) return
    for (const [id, prior] of pendingHostNavigations) {
      supersededTargets.add(prior.target)
      pendingHostNavigations.delete(id)
      sendToHost({ type: 'storyboard:embed:navigate-cancelled', id })
    }
    // A fresh request owns this target again, even if an aborted loader never
    // published the stale location that would otherwise consume its marker.
    supersededTargets.delete(data.target)
    const request = { id: data.id, target: data.target, replace: data.replace === true, settled: false, blocked: false }
    pendingHostNavigations.set(data.id, request)
    Promise.resolve(router.navigate(data.target, { replace: request.replace })).then(() => {
      request.settled = true
      syncHostNavigation(router.state)
    }, () => {
      pendingHostNavigations.delete(data.id)
      sendToHost({ type: 'storyboard:embed:navigate-cancelled', id: data.id })
    })
  }
  window.addEventListener('message', onHostNavigate)
  sendToHost({ type: 'storyboard:embed:ready' })
  return () => {
    unsubscribeRouter()
    window.removeEventListener('message', onHostNavigate)
    pendingHostNavigations.clear()
  }
}

function routeKey(location) {
  return `${location.pathname}${location.search}${location.hash}`
}

function sendChildRouteToHost(location, id, replace, { basePath, hostWindow, origin }) {
  const base = (basePath || '/').replace(/\/$/, '')
  const route = computeEmbedNavigationSrc(location.pathname, location.hash, base, location.search)
  const src = `${origin}${base}${route}`
  hostWindow.postMessage({ type: 'storyboard:embed:navigate', src, id, replace }, origin)
}
