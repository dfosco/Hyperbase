export function normalizePath(pathname) {
  const path = typeof pathname === 'string' ? pathname.split(/[?#]/, 1)[0] : ''
  const normalized = `/${path.replace(/^\/+|\/+$/g, '')}`
  return normalized === '/' ? '/' : normalized
}

export function artifactRouteStorageKey(page) {
  if (!page || !['site', 'prototype', 'component'].includes(page.type)) return null
  const identity = page.type === 'site' ? page.siteId : page.id
  if (typeof identity !== 'string' || !identity) return null
  return `hypercanvas:artifact:${page.type}:${encodeURIComponent(identity)}:last-route`
}

export function matchesArtifactRoute(page, pathname) {
  if (!page?.route || typeof pathname !== 'string') return false
  const root = normalizePath(page.route)
  const path = normalizePath(pathname)
  if (path === root) return true
  return ['site', 'prototype', 'component'].includes(page.type) && root !== '/' && path.startsWith(`${root}/`)
}

export function getArtifactRouteLocation(page, pathname, search = '', hash = '') {
  if (!matchesArtifactRoute(page, pathname)) return null
  const root = normalizePath(page.route)
  const path = normalizePath(pathname)
  const subroute = path === root ? '' : path.slice(root.length)
  const params = new URLSearchParams(search || '')
  for (const key of ['_notebookPage', 'edit', 'rebind', 'terminal']) params.delete(key)
  const query = params.toString()
  return `${subroute}${query ? `?${query}` : ''}${hash || ''}`
}

export function buildArtifactRoute(page, savedRoute) {
  if (!page?.route) return null
  const root = page.route.replace(/\/$/, '') || '/'
  if (typeof savedRoute !== 'string' || !savedRoute.trim()) return page.route
  const relative = savedRoute.trim()
  const path = relative.split(/[?#]/, 1)[0]
  if (path && (!path.startsWith('/') || path.startsWith('//') || path.includes('\\'))) return page.route
  if (path.split('/').some(segment => segment === '.' || segment === '..')) return page.route
  return `${root === '/' ? '' : root}${relative}` || '/'
}

export function resolvePublishedRoute(pages, requestedRoute) {
  const first = Array.isArray(pages) ? pages[0] : null
  if (!first) return { page: null, route: null, error: 'This publication does not contain any pages.' }
  if (typeof first.route !== 'string' || !first.route) {
    return { page: null, route: null, error: 'The first published page does not have a resolved route.' }
  }
  if (first.available === false) {
    return { page: null, route: null, error: 'The first published page is unavailable, so this invalid route cannot be redirected safely.' }
  }
  if (typeof requestedRoute !== 'string' || !requestedRoute) return { page: first, route: first.route, error: null }

  let requested
  try { requested = new URL(requestedRoute, 'https://hypercanvas.invalid') }
  catch { return { page: first, route: first.route, error: null } }
  const page = pages.find(candidate => candidate?.available !== false && matchesArtifactRoute(candidate, requested.pathname))
  if (!page) return { page: first, route: first.route, error: null }
  return { page, route: `${requested.pathname}${requested.search}${requested.hash}`, error: null }
}

export function buildProductionPageUrl({ prodDomain, currentUrl, branch }) {
  if (typeof prodDomain !== 'string' || !prodDomain.trim() || typeof currentUrl !== 'string') return null
  const stripped = prodDomain.trim().replace(/^https?:\/\//i, '').replace(/^\/+/, '')
  const slashIdx = stripped.indexOf('/')
  const host = slashIdx === -1 ? stripped : stripped.slice(0, slashIdx)
  const basePath = slashIdx === -1 ? '' : `/${stripped.slice(slashIdx + 1).replace(/\/+$/, '')}`
  if (!host) return null
  try {
    const url = new URL(currentUrl)
    url.protocol = 'https:'
    url.host = host
    url.port = ''
    const pathname = url.pathname.replace(/^\/branch--[^/]+/, '')
    const branchSegment = branch && branch !== 'main' ? `/branch--${branch}` : ''
    url.pathname = `${basePath}${branchSegment}${pathname}`
    return url.toString()
  } catch {
    return null
  }
}
