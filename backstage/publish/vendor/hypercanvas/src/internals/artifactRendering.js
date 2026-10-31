/** Resolve canonical artifact rendering URLs through one canvas-paste contract. */
export function prototypeRenderingUrl(prototype, prefix = '') {
  if (prototype.isExternal) return prototype.externalUrl
  return `${prefix}${prototype.route || prototype.flows?.[0]?.route || `/${prototype.dirName}`}`
}

export function resolveArtifactRendering(url, context, { pages = [], stories = {} } = {}) {
  const parsed = context.parseUrl(url)
  if (!parsed || !context.isSameOrigin(url)) return null
  const route = context.extractSrc(parsed.pathname).replace(/\/+$/, '') || '/'
  const state = `${parsed.search}${parsed.hash}`
  const story = Object.entries(stories).find(([, data]) => data?._route?.replace(/\/+$/, '') === route)
  if (story) {
    const [storyId, data] = story
    const exportName = parsed.searchParams.get('export') || ''
    const isSet = !exportName && (parsed.searchParams.has('_sb_component_set') || data._exportNames?.length > 1)
    return { type: isSet ? 'component-set' : 'story', props: {
      storyId, ...(isSet ? {
        layout: parsed.searchParams.get('layout') || 'auto',
        density: parsed.searchParams.get('density') || '',
        selected: new URLSearchParams(parsed.hash.slice(1)).get('selected') || '',
      } : { exportName }), search: parsed.search, hash: parsed.hash, width: 600, height: 400,
    } }
  }
  const page = pages.filter(item => item?.available !== false && item.route)
    .sort((a, b) => b.route.length - a.route.length)
    .find(item => route === item.route.replace(/\/$/, '') || (item.type === 'site' && route.startsWith(`${item.route.replace(/\/$/, '')}/`)))
  if (!page) return null
  if (page.type === 'site') return { type: 'site-frame', props: {
    siteId: page.siteId || page.id,
    route: `${route.slice(page.route.replace(/\/$/, '').length).replace(/^\//, '')}${state}`,
    title: page.title || page.id, width: 800, height: 600,
  } }
  if (page.type === 'doc') return { type: 'prototype', props: {
    src: parsed.href, label: page.title || page.id, width: 600, height: 500,
  } }
  if (page.type === 'canvas') {
    // Canvas content is a full canvas document, not a prototype route. An
    // absolute same-origin URL keeps the generic Frame on that document.
    return { type: 'prototype', props: { src: parsed.href, label: page.title || page.id, width: 800, height: 600 } }
  }
  return null
}

export async function copyArtifactRenderingUrl(url, {
  origin, canvasActive, clipboard, dispatch, notify,
}) {
  const absolute = new URL(url, origin).href
  if (canvasActive) dispatch(absolute)
  let copied = false
  try {
    await clipboard.writeText(absolute)
    copied = true
  } catch { /* Canvas insertion remains available when clipboard access fails. */ }
  notify(canvasActive
    ? copied ? 'Link copied · adding to canvas' : 'Adding to canvas · clipboard unavailable'
    : copied ? 'Link copied to clipboard' : 'Could not copy link')
  return { copied, insertionRequested: canvasActive, url: absolute }
}
