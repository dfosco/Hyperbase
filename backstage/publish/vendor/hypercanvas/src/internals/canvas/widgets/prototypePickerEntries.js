/**
 * Pure helpers for the PrototypeEmbed selection card — mirrors the Site
 * Frame's "Choose a Site" list. Kept module-level (outside the component)
 * so fast refresh still works on PrototypeEmbed.jsx.
 */

/** Path portion only: strips branch deploy prefixes, query, and hash. */
export function embedRoutePath(value) {
  if (typeof value !== 'string') return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      const parsed = new URL(value)
      return `${parsed.pathname}${parsed.hash}` || ''
    } catch { return '' }
  }
  return value.replace(/^\/branch--[^/]+/, '').split('?')[0].split('#')[0] || ''
}

/** Full evaluation route: branch prefixes stripped, everything else intact. */
export function stripEmbedRoute(value) {
  return typeof value === 'string' ? value.replace(/^\/branch--[^/]+/, '') : ''
}

/** Resolve the frame's live same-origin route, unwrapping the dev-only iframe entry path. */
export function resolvePrototypeFrameUrl(currentUrl, fallbackUrl) {
  try {
    const current = new URL(currentUrl)
    const fallback = new URL(fallbackUrl, current)
    if (current.origin !== fallback.origin) return fallback.toString()
    const marker = '/prototypes.html'
    const entryIndex = current.pathname.indexOf(`${marker}/`)
    if (entryIndex >= 0) current.pathname = current.pathname.slice(0, entryIndex) + current.pathname.slice(entryIndex + marker.length)
    for (const key of GENERATED_FRAME_PARAMS) current.searchParams.delete(key)
    return current.toString()
  } catch {
    return fallbackUrl || ''
  }
}

const GENERATED_FRAME_PARAMS = new Set([
  '_sb_embed',
  '_sb_component_view',
  '_sb_hide_branch_bar',
  '_sb_theme_target',
  '_sb_canvas_theme',
  'sb_knobs',
])

/** Compare an authored prototype URL with its live dev-isolation iframe URL. */
export function samePrototypeFrameLocation(currentUrl, authoredUrl, baseUrl = 'http://localhost/') {
  try {
    const current = new URL(currentUrl, baseUrl)
    const authored = new URL(authoredUrl, baseUrl)
    const normalizePath = pathname => pathname.replace('/prototypes.html/', '/')
    for (const key of GENERATED_FRAME_PARAMS) {
      current.searchParams.delete(key)
      authored.searchParams.delete(key)
    }
    current.searchParams.sort()
    authored.searchParams.sort()
    return current.origin === authored.origin
      && normalizePath(current.pathname) === normalizePath(authored.pathname)
      && current.search === authored.search
      && current.hash === authored.hash
  } catch { return false }
}

/**
 * Validate the currently loaded child URL for an explicit frame refresh.
 * This intentionally has no configured-src fallback: a stale widget prop
 * must never replace a newer route the child is currently showing.
 */
export function resolveLivePrototypeRefreshTarget(currentUrl, {
  expectedOrigin,
  basePath = '/',
  development = false,
  authoredSrc = '',
} = {}) {
  try {
    const current = new URL(currentUrl)
    const expected = new URL(expectedOrigin)
    if (!/^https?:$/.test(current.protocol) || !/^https?:$/.test(expected.protocol)) return null
    if (current.origin !== expected.origin || current.username || current.password) return null
    if (expected.username || expected.password) return null

    const authoredIsAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(authoredSrc)
    const authored = authoredSrc ? new URL(authoredSrc, expected) : null
    if (authoredIsAbsolute && (!/^https?:$/.test(authored.protocol)
      || authored.origin !== expected.origin || authored.username || authored.password)) return null
    const authoredDirectHtml = Boolean(authoredIsAbsolute && /\.html$/i.test(authored.pathname))
    if (authoredDirectHtml) {
      if (current.pathname !== authored.pathname) return null
      return { frameUrl: current.href, src: current.href, sourceKind: 'direct-html' }
    }

    if (typeof basePath !== 'string' || !basePath.startsWith('/') || /[?#]/.test(basePath)) return null
    const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`
    if (!current.pathname.startsWith(normalizedBase)) return null

    const pathWithinBase = current.pathname.slice(normalizedBase.length)
    let routePath = pathWithinBase
    if (development) {
      const isolationEntry = 'prototypes.html/'
      if (pathWithinBase.startsWith(isolationEntry)) {
        routePath = pathWithinBase.slice(isolationEntry.length)
      } else {
        // Public ContentFrame embeds use the direct route even in dev. Permit
        // refresh only when that route remains inside the authored prototype.
        if (!authored || authored.origin !== expected.origin) return null
        const authoredPath = authored.pathname.startsWith(normalizedBase)
          ? authored.pathname.slice(normalizedBase.length)
          : authored.pathname.replace(/^\/branch--[^/]+\//, '')
        if (pathWithinBase !== authoredPath && !pathWithinBase.startsWith(`${authoredPath}/`)) return null
        routePath = pathWithinBase
      }
    }
    if (!routePath || routePath === '/') return null

    const retainedSearch = current.search
      ? current.search.slice(1).split('&').filter((part) => {
        const rawKey = part.split('=', 1)[0]
        let key
        try { key = decodeURIComponent(rawKey.replace(/\+/g, ' ')) } catch { return false }
        return !GENERATED_FRAME_PARAMS.has(key)
      }).join('&')
      : ''

    return {
      frameUrl: current.href,
      src: `/${routePath}${retainedSearch ? `?${retainedSearch}` : ''}${current.hash}`,
      sourceKind: 'isolated-route',
    }
  } catch {
    return null
  }
}

function formatName(name) {
  return String(name)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Flat picker entries for the prototype selection card: one row per
 * prototype (folders flattened, externals skipped), title + directory
 * slug, no flow rows.
 *
 * `route` is the representative URL a pick writes into the Frame's src —
 * the default flow's route when one is declared, else the prototype's
 * index route (`/<dirName>`). `routes` carries every URL that belongs to
 * the prototype so an existing Frame src highlights its row.
 */
export function buildPrototypePickerEntries(index) {
  const idx = index || {}
  const seen = new Map()
  const collect = (proto) => {
    if (!proto || proto.isExternal || !proto.dirName || seen.has(proto.dirName)) return
    const flows = (proto.flows || []).map(flow => ({
      name: flow.meta?.title || formatName(flow.name || proto.dirName),
      route: flow.route,
    }))
    const defaultFlow = (proto.flows || []).find(flow => flow.meta?.default === true)
    const route = (defaultFlow || (proto.flows || [])[0])?.route || proto.route || `/${proto.dirName}`
    const entryRoute = proto.route || `/${proto.dirName}`
    seen.set(proto.dirName, {
      title: proto.name || proto.dirName,
      dirName: proto.dirName,
      route,
      flows,
      routes: [...new Set([entryRoute, ...flows.map(flow => flow.route)])],
    })
  }
  for (const folder of (idx.sorted?.title?.folders || idx.folders || [])) {
    for (const proto of (folder.prototypes || [])) collect(proto)
  }
  for (const proto of (idx.sorted?.title?.prototypes || idx.prototypes || [])) collect(proto)
  return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title))
}
