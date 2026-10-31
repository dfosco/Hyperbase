/**
 * DO NOT EDIT — storyboard-owned library file.
 *
 * Synced from @dfosco/storyboard. Customize via src/_prototype.jsx (wraps
 * every prototype route) or src/library/_app.jsx (workspace SPA shell).
 * See src/library/README.md for the full customization surface.
 *
 * Custom generouted routes entry for storyboard.
 *
 * generouted hardcodes /src/pages/ in both its import.meta.glob patterns and
 * its route-path regex. This module mirrors the generouted runtime but scans
 * two directories:
 *   - /src/library/  — storyboard's workspace pages (workspace, viewfinder,
 *     create, index) plus _app.jsx (SPA shell wrapper).
 *   - /src/prototypes/  — the consumer's actual prototypes.
 *
 * Both directories have their prefix segment stripped from the URL — so
 * src/library/workspace.jsx mounts at /workspace, and
 * src/prototypes/MyProto/index.jsx mounts at /MyProto.
 *
 * Prototype routes host an isolated document. Consumer wrappers and authored
 * styles are loaded inside that document; workspace routes keep the shell.
 */
import { Fragment, Suspense } from 'react'
import { Outlet, redirect } from 'react-router-dom'
import PrototypeErrorBoundary, { ImportErrorFallback } from '@dfosco/hypercanvas/error-boundary'
import ContentFrame from '@dfosco/hypercanvas/content-frame'
import {
  PROTOTYPE_ROUTES as NOTEBOOK_PROTOTYPE_ROUTES,
  PROTOTYPE_EXTERNAL_ROUTES,
  PROTOTYPE_STATEFULLY_ROUTES,
  PROTOTYPE_ROUTE_ALIASES,
} from 'virtual:hypercanvas-notebook-routes'
import {
  generatePreservedRoutes,
  patterns,
} from '@generouted/react-router/core'
import { compileRegularRoutes } from '@dfosco/hypercanvas/isolation/route-compiler'
import {
  notebookArtifactAliasRoutePath,
  notebookArtifactCanonicalRoutePattern,
  resolveNotebookArtifactRouteAlias,
} from '@dfosco/hypercanvas/notebook/artifact-migration-aliases'

// Patch the route regex to strip src/library/, src/prototypes/, .folder/,
// and `drafts/` segments. A `drafts/` dir is a gitignored scratch root —
// prototypes inside route at the same URL as a non-prefixed sibling (so
// `prototypes/drafts/Foo/` and `prototypes/Foo/` both resolve at `/Foo`).
//
// The second alternation strips a leading `/src/` for BARE top-level files
// (`/src/Dashboard.jsx` → `Dashboard`). The lookahead `(?=[^/]+\.(jsx|tsx|mdx)$)`
// ensures it only fires for files directly under /src (no further slash), so
// it never touches library/ or prototypes/ paths.
patterns.route = [/^.*\/src\/(library|prototypes)\/|^.*\/src\/(?=[^/]+\.(jsx|tsx|mdx)$)|^\/(library|prototypes)\/|[^/]*\.folder\/|(?<=^|\/)drafts\/|\.(jsx|tsx|mdx)$/g, '']

// `_app.jsx` lives in src/library/ — it's storyboard's SPA shell
// (StoryboardProvider + suspense + error boundary). Consumers can copy
// it to src/library/_app.jsx and customize freely. `404` is currently a
// no-op convention, kept for parity with generouted preserved routes.
const PRESERVED = import.meta.glob('/src/library/(_app|404).{jsx,tsx}', { eager: true })


// Library workspace pages — non-prototype routes (Workspace, Viewfinder,
// Create, landing index). Bypasses the PrototypeWrapper.
const LIBRARY_ROUTES = import.meta.glob(
  ['/src/library/*.{jsx,tsx}', '!/src/library/(_app|404|mount|workspace-entry|prototypes-entry|routes).{jsx,tsx}'],
)

// Lazy-load prototype routes — only the matched route's module is fetched.
// This prevents story/canvas URLs from paying for every prototype page's
// imports (Primer, Reshaped, user components, etc.) on first load.
const PROTOTYPE_ROUTES = {
  ...import.meta.glob(
    ['/src/prototypes/**/[\\w[-]*.{jsx,tsx,mdx}', '!/src/prototypes/**/(_!(layout)*(/*)?|_app|404)*'],
  ),
  ...NOTEBOOK_PROTOTYPE_ROUTES,
}

// Flat-file routes — any top-level `src/<Name>.jsx` becomes a `/<Name>` route,
// rendered BARE (only the _app SPA shell, NOT wrapped in _prototype). Files
// prefixed with `_` (e.g. _prototype.jsx, _story.jsx) are excluded.
const ROOT_ROUTES = import.meta.glob(
  ['/src/*.{jsx,tsx}', '!/src/_*.{jsx,tsx}'],
)

const preservedRoutes = generatePreservedRoutes(PRESERVED)

function makeLazyRoute(importFn, key) {
  const index = /index\.(jsx|tsx|mdx)$/.test(key) && !key.includes('prototypes/index') && !key.includes('library/index')
    ? { index: true }
    : {}
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
        // Import itself failed (syntax error, broken dependency, etc.)
        return {
          Component: () => <ImportErrorFallback error={err} route={key} />,
        }
      }
    },
  }
}

const libraryRoutes = compileRegularRoutes(LIBRARY_ROUTES, makeLazyRoute)
// The Site viewer also accepts deep links; reuse the same lazy library page.
const siteViewerRoute = LIBRARY_ROUTES['/src/library/sites.jsx']
  ? { path: 'sites/:siteId/*', ...makeLazyRoute(LIBRARY_ROUTES['/src/library/sites.jsx'], '/src/library/sites.jsx') }
  : null
const docRoute = { path: 'docs/:docId', ...makeLazyRoute(() => import('@dfosco/hypercanvas/doc-page'), '/src/library/doc-page.jsx') }
const prototypeRoutes = compileRegularRoutes(PROTOTYPE_ROUTES, (_importFn, key) => ({
  ...(/index\.(jsx|tsx|mdx)$/.test(key) ? { index: true } : {}),
  // Leaf routes are rendered inside the retained isolated document.
  Component: () => null,
}))
const externalPrototypeRoutes = (PROTOTYPE_EXTERNAL_ROUTES || []).flatMap(({ artifactId, route, title, url }) => {
  const path = notebookArtifactCanonicalRoutePattern(route)
  return path ? [{
    id: `notebook-external-prototype-${artifactId}`,
    path,
    Component: () => <ContentFrame kind="prototype" externalUrl={url} title={title} />,
  }] : []
})
const statefullyPrototypeRoutes = (PROTOTYPE_STATEFULLY_ROUTES || []).flatMap(({ artifactId, route, title, routeConflict, diagnostics = [] }) => {
  const path = notebookArtifactCanonicalRoutePattern(route)
  if (!path) return []
  const Component = routeConflict
    ? () => <main role="alert" data-hc-prototype-route-conflict><h1>Prototype route conflict</h1><p>{title || artifactId} cannot use <code>/{path}</code> because another route already claims it.</p><ul>{diagnostics.map((item, index) => <li key={`${item.code}-${index}`}><code>{item.code}</code> {item.message}</li>)}</ul></main>
    : () => <ContentFrame kind="prototype" statefullyPrototypeId={artifactId} title={title} />
  return [
    { id: `notebook-statefully-prototype-${artifactId}`, path, Component },
    { id: `notebook-statefully-prototype-views-${artifactId}`, path: `${path}/*`, Component },
  ]
})
const migrationAliasRoutes = (PROTOTYPE_ROUTE_ALIASES || []).flatMap((alias) => {
  const routePath = notebookArtifactAliasRoutePath(alias)
  return routePath ? [{
    path: routePath,
    loader: ({ request }) => {
      const url = new URL(request.url)
      const target = resolveNotebookArtifactRouteAlias(url.pathname, alias, import.meta.env.BASE_URL)
      const fragment = typeof window === 'undefined' ? url.hash : window.location.hash
      return target ? redirect(`${target}${url.search}${fragment}`) : null
    },
  }] : []
})
const rootRoutes = compileRegularRoutes(ROOT_ROUTES, makeLazyRoute)

const _app = preservedRoutes?.['_app']
const _404 = preservedRoutes?.['404']
const Default = _app?.default || Outlet

const Layout = () => <Default />

// eslint-disable-next-line react-refresh/only-export-components
const App = () =>
  _app?.Pending ? (
    <Suspense fallback={<_app.Pending />}>
      <Layout />
    </Suspense>
  ) : (
    <Layout />
  )

const app = { Component: _app?.default ? App : Layout, ErrorBoundary: _app?.Catch, loader: _app?.Loader }
const fallback = { path: '*', Component: _404?.default || Fragment }

const prototypeLayoutRoute = {
  // Keep one iframe mounted while the host router tracks leaf URL changes.
  Component: () => <ContentFrame kind="prototype" />,
  children: prototypeRoutes,
}

export const routes = [{
  ...app,
  children: [docRoute, ...libraryRoutes, ...(siteViewerRoute ? [siteViewerRoute] : []), ...rootRoutes, ...migrationAliasRoutes, ...externalPrototypeRoutes, ...statefullyPrototypeRoutes, prototypeLayoutRoute, fallback],
}]

// Return a routes tree filtered to a single prototype subtree. Used by the
// per-prototype iframe entry (see prototypes-entry.jsx + PrototypeEmbed
// dev URL builder). Filtering at this layer keeps a broken sibling
// prototype from ever appearing in the matched route's lazy() chain — only
// the requested prototype's modules are reachable from the router.
//
// Library routes (workspace, viewfinder, create) are NEVER in the iframe
// path because the iframe entry uses a different routes module
// (prototypeRoutes.jsx inside the library). So filtering here only needs
// to walk the prototype subtree.
export function getRoutesForProto(proto) {
    if (!proto) return routes
    const matchesProto = (route) => {
        const seg = (route.path || '').split('/').filter(Boolean)[0]
        return seg === proto
    }
    const filter = (children) => children
        .map((r) => {
            if (r.path === '*') return r
            if (!r.path) {
                return r.children ? { ...r, children: filter(r.children) } : r
            }
            // A route WITH a path is kept iff its first segment matches the
            // requested proto. When it matches, keep its ENTIRE subtree — do
            // NOT re-filter children, since generouted nests sub-routes under
            // the prototype (e.g. `canvas-threats/threats` becomes a `threats`
            // child of `canvas-threats`); re-filtering would drop them because
            // their own segment isn't the proto name.
            return matchesProto(r) ? r : null
        })
        .filter(Boolean)
    return [{
      ...routes[0],
      children: routes[0].children.map((child) => {
        // Only the prototype-layout child has nested children we want to filter.
        if (child === prototypeLayoutRoute) return { ...child, children: filter(child.children || []) }
        return child
      }),
    }]
}
