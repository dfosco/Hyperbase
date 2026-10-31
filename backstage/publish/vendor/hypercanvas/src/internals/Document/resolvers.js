import { contentFrameUrl, statefullyPrototypeFrameUrl } from '../canvas/isolation/contentRouting.js'
/** Pure host seam: no filesystem, fetch, workstation origins or Core dependency. */
export function createDocumentResolvers({ artifacts = [], assets = {}, base = '/', mode = 'local', baseUrl = globalThis.location?.href } = {}) {
  const resolvedBase = base === './' && baseUrl ? new URL(baseUrl).pathname.replace(/\/docs\/[^/]*\/?$/, '/') : base
  const prefix = resolvedBase.endsWith('/') ? resolvedBase : `${resolvedBase}/`
  const unavailable = message => ({ available: false, diagnostics: [{ code: 'UNAVAILABLE_DOCUMENT_REFERENCE', message }] })
  return {
    resolveAsset(reference, { basePath = '' } = {}) {
      if (/^https?:\/\//i.test(reference)) return { available: true, url: reference }
      const url = assets[`${basePath}/${reference}`]
      return url ? { available: true, url } : unavailable(`Asset unavailable: ${reference}`)
    },
    resolveArtifact(id, { kind, viewId } = {}) {
      const matches = artifacts.filter(item => item.id === id)
      if (matches.length !== 1) return unavailable(`Artifact ${id} is ${matches.length ? 'ambiguous' : 'missing'}.`)
      const artifact = matches[0]
      if (artifact.available === false || (artifact.kind || artifact.type) !== kind) return unavailable(`Artifact ${id} is unavailable or is not a ${kind}.`)
      const candidates = artifact.views || artifact.descriptor?.views
      const views = Array.isArray(candidates) ? candidates : []
      const view = viewId === undefined ? views[0] : views.find(item => item.id === viewId)
      if (viewId !== undefined && !view) return unavailable(`View ${viewId} was not found in ${id}.`)
      if (kind === 'site') {
        const descriptor = artifact.descriptor || artifact
        const localBase = descriptor.local?.developmentUrl || artifact.developmentUrl
        const publishedBase = descriptor.published?.url || artifact.productionUrl
        const baseUrl = mode === 'static' ? publishedBase : localBase || publishedBase
        const join = value => { try { return value ? new URL((view?.path || '/').replace(/^\/+/, ''), value.replace(/\/?$/, '/')).href : null } catch { return null } }
        const url = mode === 'static' ? view?.publishedUrl || join(publishedBase) : view?.localUrl || join(localBase) || view?.publishedUrl || join(baseUrl)
        if (!/^https?:\/\//i.test(url || '')) return unavailable(`Site ${id} has no ${mode} destination.`)
        const screenshot = view?.screenshot ? assets[`${artifact.folderPath || ''}/${view.screenshot}`] : null
        return { available: true, url, screenshot }
      }
      if (!artifact.route?.startsWith('/') || artifact.route.startsWith('//')) return unavailable(`Prototype ${id} has no renderable route.`)
      const canonical = new URL(artifact.route, 'http://document.invalid')
      if (view?.path) {
        const selected = new URL(view.path, 'http://document.invalid')
        canonical.pathname = canonical.pathname.replace(/\/?$/, '/') + selected.pathname.replace(/^\/+/, '')
        const search = new URLSearchParams(canonical.search)
        for (const [key, value] of selected.searchParams) search.set(key, value)
        canonical.search = search.toString()
        if (selected.hash) canonical.hash = selected.hash
      }
      if (mode === 'local' && artifact.runtime?.id === '@dfosco/statefully' && artifact.runtime.version === '0.2.1') {
        return { available: true, url: statefullyPrototypeFrameUrl(canonical, prefix, artifact.id) }
      }
      return { available: true, url: contentFrameUrl({ pathname: `${mode === 'local' ? '/prototypes.html' : ''}${canonical.pathname}`, search: canonical.search, hash: canonical.hash }, prefix) }

    },
  }
}
