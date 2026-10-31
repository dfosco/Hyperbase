/**
 * Library-side prototype routes builder for the isolated prototypes iframe.
 *
 * Mirrors the consumer-scaffold convention (src/routes.jsx) but lives inside
 * the library so consumers no longer need to maintain their own
 * prototypes-entry plumbing. Uses absolute globs (`/src/prototypes/...`),
 * which Vite resolves against the *consumer's* project root regardless of
 * where this file physically lives.
 *
 * Used by `prototypesEntry.jsx`, which is the iframe entry served by the
 * `prototypes.html` middleware in `data-plugin.js`.
 */
import { Fragment, Suspense, lazy } from 'react'
import { Outlet, redirect, useLocation } from 'react-router-dom'
import { patterns } from '@generouted/react-router/core'
import { compileModalRoutes, compileRegularRoutes } from './routeCompiler.js'
import PrototypeErrorBoundary, { ImportErrorFallback } from '../../PrototypeErrorBoundary.jsx'
import StoryboardProvider from '../../context.jsx'
import { filterChildrenForProto } from './routeFilter.js'
import { notebookArtifactAliasRoutePath, notebookArtifactCanonicalRoutePattern, resolveNotebookArtifactRouteAlias } from '../../../core/notebook/artifact-migration-aliases.js'
// Notebook prototypes live outside the application root (the glob below
// resolves against the Vite root), so they reach us through the
// data-plugin-hosted route map instead. Notebook entries win on route-key
// collisions — user content is what the canvas is editing.
import { PROTOTYPE_ROUTES as NOTEBOOK_PROTOTYPE_ROUTES, PROTOTYPE_EXTERNAL_ROUTES as NOTEBOOK_PROTOTYPE_EXTERNAL_ROUTES, PROTOTYPE_STATEFULLY_ROUTES, PROTOTYPE_MODALS as NOTEBOOK_PROTOTYPE_MODALS, PROTOTYPE_ROUTE_ALIASES } from 'virtual:storyboard-notebook-prototype-routes'

// Strip src/library/, src/prototypes/, .folder/, and `drafts/` segments
// from route paths. `_app.jsx` lives in src/library/ (since
// b144dace5); user-authored prototype routes live in src/prototypes/.
// Both prefixes are stripped so the generated route paths (and the
// preservedRoutes _app key) come out clean.
//
// A `drafts/` dir is a gitignored scratch root — prototypes inside route at
// the same URL as a non-prefixed sibling. The lookbehind ensures we only
// match `drafts/` as a directory segment, not as part of a filename.
patterns.route = [/^.*\/src\/(library|prototypes)\/|^\/(library|prototypes)\/|[^/]*\.folder\/|(?<=^|\/)drafts\/|\.(jsx|tsx|mdx)$/g, '']

const MODALS = import.meta.glob('/src/prototypes/**/[+]*.{jsx,tsx}')

// Lazy-load prototype routes — only the matched route's module is fetched.
// This prevents story/canvas URLs from paying for every prototype page's
// imports (Primer, Reshaped, user components, etc.) on first load.
const ROUTES = import.meta.glob(
  ['/src/prototypes/**/[\\w[-]*.{jsx,tsx,mdx}', '!/src/prototypes/**/(_!(layout)*(/*)?|_app|404)*'],
)

const ALL_ROUTES = { ...ROUTES, ...NOTEBOOK_PROTOTYPE_ROUTES }

const modalModules = { ...MODALS, ...NOTEBOOK_PROTOTYPE_MODALS }
const modalRoutes = compileModalRoutes(Object.fromEntries(
  Object.entries(modalModules).map(([key, load]) => {
    const Modal = lazy(load)
    return [key, { default: () => <Suspense fallback={null}><Modal /></Suspense> }]
  }),
))

const regularRoutes = compileRegularRoutes(ALL_ROUTES, (importFn, key) => {
  const index = /index\.(jsx|tsx|mdx)$/.test(key) && !key.includes('prototypes/index') ? { index: true } : {}
  return {
    ...index,
    lazy: async () => {
      try {
        const module = await importFn()
        const Default = module?.default || Fragment
        const Page = () =>
          module?.Pending ? (
            <Suspense fallback={<module.Pending />}>
              <Default />
            </Suspense>
          ) : (
            <Default />
          )
        return {
          Component: Page,
          ErrorBoundary: module?.Catch || PrototypeErrorBoundary,
          loader: module?.Loader,
          action: module?.Action,
        }
      } catch (err) {
        return {
          Component: () => <ImportErrorFallback error={err} route={key} />,
        }
      }
    },
  }
})
const migrationAliasRoutes = (PROTOTYPE_ROUTE_ALIASES || []).flatMap((alias) => {
  const routePath = notebookArtifactAliasRoutePath(alias)
  return routePath ? [{
    path: routePath,
    loader: ({ request }) => {
      const url = new URL(request.url)
      const base = `${import.meta.env.BASE_URL || '/'}prototypes.html`
      const target = resolveNotebookArtifactRouteAlias(url.pathname, alias, base)
      const fragment = typeof window === 'undefined' ? url.hash : window.location.hash
      return target ? redirect(`${target}${url.search}${fragment}`) : null
    },
  }] : []
})
const externalPrototypeRoutes = (NOTEBOOK_PROTOTYPE_EXTERNAL_ROUTES || []).flatMap(({ artifactId, route, url }) => {
  const path = notebookArtifactCanonicalRoutePattern(route)
  return path ? [{ id: `notebook-external-prototype-${artifactId}`, path, loader: () => redirect(url) }] : []
})
const statefullyPrototypeRoutes = (PROTOTYPE_STATEFULLY_ROUTES || []).flatMap(({ artifactId, route, title, routeConflict, diagnostics = [] }) => {
  const path = notebookArtifactCanonicalRoutePattern(route)
  if (!path) return []
  if (routeConflict) return [{
    id: `notebook-statefully-prototype-conflict-${artifactId}`,
    path: `${path}/*`,
    Component: () => <main role="alert"><h1>Prototype route conflict</h1><p>{title || artifactId} cannot be loaded at <code>/{path}</code>.</p><ul>{diagnostics.map((item, index) => <li key={`${item.code}-${index}`}><code>{item.code}</code> {item.message}</li>)}</ul></main>,
  }]
  return [{
    id: `notebook-statefully-prototype-${artifactId}`,
    path: `${path}/*`,
    loader: ({ request }) => {
      const url = new URL(request.url)
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      const basename = `${base}/prototypes.html`
      const relative = url.pathname.startsWith(basename) ? url.pathname.slice(basename.length) : ''
      const artifactPrefix = `/${encodeURIComponent(artifactId)}`
      const suffix = relative === artifactPrefix || !relative.startsWith(`${artifactPrefix}/`)
        ? ''
        : relative.slice(artifactPrefix.length)
      const target = `${base}/__notebook/prototypes/${encodeURIComponent(artifactId)}${suffix}`
      return redirect(`${target}${url.search}${url.hash}`)
    },
  }]
})

function PrototypeLayout() {
  const Modal = modalRoutes[useLocation().state?.modal] || Fragment
  return <StoryboardProvider isolated><Outlet /><Modal /></StoryboardProvider>
}

export const routes = [{
  Component: PrototypeLayout,
  ErrorBoundary: PrototypeErrorBoundary,
  children: [...regularRoutes, ...externalPrototypeRoutes, ...statefullyPrototypeRoutes, ...migrationAliasRoutes, { path: '*', Component: Fragment }],
}]

/**
 * Filter a route tree's children down to a single prototype subtree.
 *
 * Pure helper (no module-level globs) so it's unit-testable. Keeps `*` and
 * pathless layout wrappers (descending into the latter to reach the prototype
 * routes). Any route WITH a path is kept iff its first segment matches the
 * requested proto — and when it matches we keep its ENTIRE subtree intact,
 * since generouted nests sub-routes under the prototype (e.g.
 * `canvas-threats/threats` → a `threats` child of `canvas-threats`).
 * Re-filtering those children by first segment would drop them because their
 * own path segment isn't the proto name — that was the nested-route bug.
 */
export { filterChildrenForProto } from './routeFilter.js'

/**
 * Return a routes tree filtered to a single prototype subtree. Used by the
 * per-prototype iframe entry — filtering at this layer keeps a broken
 * sibling prototype from ever appearing in the matched route's lazy() chain
 * (only the requested prototype's modules are reachable from the router).
 */
export function getRoutesForProto(proto) {
  if (!proto) return routes
  return [{ ...routes[0], children: filterChildrenForProto(routes[0].children || [], proto) }]
}
