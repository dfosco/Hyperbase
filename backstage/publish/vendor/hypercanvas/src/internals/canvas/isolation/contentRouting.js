import { preserveNotebookView, stripNotebookViewParams } from '../../../core/session/notebookView.js'
/** Pure URL contract shared by the document bootstrap and the frame host. */
export function publishedFallbackPath(location, isNotebookPublication) {
  if (isNotebookPublication !== true) return null

  const params = new URLSearchParams(location.search)
  const route = params.get('p')
  const base = params.get('b')
  if (route === null || !base?.startsWith('/') || base.startsWith('//')) return null

  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${route.replace(/^\/+/, '')}`
}

export function contentDocumentKind(location, base = '/') {
  const prefix = base.replace(/\/$/, '')
  const path = prefix && location.pathname.startsWith(`${prefix}/`)
    ? location.pathname.slice(prefix.length) : location.pathname
  if (/^\/stories\.html(?:\/|$)/.test(path)) return 'story'
  if (/^\/prototypes\.html(?:\/|$)/.test(path)) return 'prototype'
  const params = new URLSearchParams(location.search)
  // Only embeds bypass the host shell. hideUI keeps recoverable app controls.
  if (!params.has('_sb_embed')) return null
  if (/^\/docs(?:\/|$)/.test(path)) return 'doc'
  if (/^\/components(?:\/|$)/.test(path)) return 'story'
  if (/^\/(?:canvas|sites|notebook|workspace|viewfinder|create|home)(?:\/|$)/.test(path)) return null
  return 'prototype'
}

export function contentFrameUrl({ pathname, search = '', hash = '' }, base = '/', { componentView = false } = {}) {
  const prefix = base.replace(/\/$/, '')
  const params = new URLSearchParams(search)
  stripNotebookViewParams(params)
  params.set('_sb_embed', '')
  if (componentView) params.set('_sb_component_view', '')
  return `${prefix}${pathname.startsWith('/') ? pathname : `/${pathname}`}?${params}${hash}`
}

function encodedId(id) {
  if (typeof id !== 'string' || !id.trim() || id.includes('/') || id.includes('\\') || id === '.' || id === '..') {
    throw new TypeError('A stable prototype ID is required.')
  }
  return encodeURIComponent(id)
}

/** Internal Statefully document path for a canonical public Prototype route. */
export function statefullyPrototypeFrameUrl({ pathname, search = '', hash = '' }, base = '/', id) {
  const basePrefix = base.replace(/\/$/, '')
  const publicRoot = `/${encodedId(id)}`
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (cleanPath !== publicRoot && !cleanPath.startsWith(`${publicRoot}/`)) {
    throw new TypeError(`Prototype route must remain below ${publicRoot}.`)
  }
  const suffix = cleanPath.slice(publicRoot.length)
  const params = new URLSearchParams(search)
  stripNotebookViewParams(params)
  params.set('_sb_embed', '')
  return `${basePrefix}/__notebook/prototypes/${encodedId(id)}${suffix}?${params}${hash}`
}

/** Convert an internal Statefully iframe location into its public host route. */
export function statefullyPrototypePublicRoute({ pathname, search = '', hash = '' }, base = '/', id) {
  const basePrefix = base.replace(/\/$/, '')
  const idPath = encodedId(id)
  const internalRoot = `${basePrefix}/__notebook/prototypes/${idPath}`
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (cleanPath !== internalRoot && !cleanPath.startsWith(`${internalRoot}/`)) return null
  const suffix = cleanPath.slice(internalRoot.length)
  const params = new URLSearchParams(search)
  params.delete('_sb_embed')
  stripNotebookViewParams(params)
  return `/${idPath}${suffix}${params.size ? `?${params}` : ''}${hash}`
}

export function contentNavigationTarget(src, origin, base = '/') {
  if (typeof src !== 'string' || src.startsWith('//') || src.includes('\\')) return null
  if (!src.startsWith('/') && !/^https?:\/\//i.test(src)) return null
  let url
  try {
    url = new URL(src, origin)
  } catch {
    return null
  }
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) return null
  const prefix = base.replace(/\/$/, '')
  if (prefix && url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return null
  const pathname = prefix ? url.pathname.slice(prefix.length) || '/' : url.pathname
  return `${pathname}${url.search}${url.hash}`
}

/** Presentation state belongs to the host, not authored frame navigation. */
export function contentRouteLocation({ pathname, search = '', hash = '' }) {
  const params = new URLSearchParams(search)
  stripNotebookViewParams(params)
  return `${pathname}${params.size ? `?${params}` : ''}${hash}`
}

export function preserveHostUIState(target, hostSearch) {
  return preserveNotebookView(target, hostSearch)
}
