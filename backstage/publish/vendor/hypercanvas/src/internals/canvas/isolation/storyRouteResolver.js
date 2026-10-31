export function resolveStoryName(pathname, storyIndex, baseUrl = '/') {
  let normalized = pathname.replace(/\/+$/, '') || '/'
  const base = `/${String(baseUrl || '/').split('/').filter(Boolean).join('/')}`.replace(/\/$/, '')
  if (base && base !== '/' && (normalized === base || normalized.startsWith(`${base}/`))) {
    normalized = normalized.slice(base.length) || '/'
  }
  for (const [name, data] of Object.entries(storyIndex || {})) {
    if (data?._route && data._route.replace(/\/+$/, '') === normalized) {
      return name
    }
  }
  return null
}
