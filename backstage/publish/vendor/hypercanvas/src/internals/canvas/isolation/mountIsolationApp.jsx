/**
 * Shared mount helper for isolated iframe entries.
 *
 * Used by `prototypesEntry.jsx` and `storiesEntry.jsx` — they both:
 *   1. Read the active Notebook configuration through a virtual module
 *   2. Mount a route tree without importing workspace UI or styles
 *   3. Mount a React tree with `createBrowserRouter` scoped to the entry
 *      page (basename = `${BASE_URL}/${name}`)
 *
 * Centralizing this here means bug fixes / iterations land in one place
 * for both surfaces. Each surface entry shrinks to a few lines:
 *
 *   import { routes, getRoutesForProto } from './prototypeRoutes.jsx'
 *   import { mountIsolationApp } from './mountIsolationApp.jsx'
 *   mountIsolationApp({
 *     name: 'prototypes.html',
 *     wrapperKind: 'prototype',
 *     resolveRoutes: ({ firstSegment, search }) => {
 *       const proto = firstSegment || search.get('proto') || ''
 *       return proto ? getRoutesForProto(proto) : routes
 *     },
 *   })
 *
 * Provider chain: the consumer's `src/_prototype.jsx` (or `src/_story.jsx`)
 * wraps the routes. When absent, both wrappers degrade to a Fragment
 * pass-through — prototypes render with no shared providers (blank slate).
 *
 * @param {object} opts
 * @param {string} opts.name                          — entry name, e.g. 'prototypes.html'
 * @param {'prototype' | 'story'} [opts.wrapperKind='prototype']
 *        — which consumer wrapper to mount around the router. Prototype
 *          uses `src/_prototype.jsx`, story uses `src/_story.jsx`.
 * @param {RouteObject[]} [opts.routes]               — fixed route table (used when resolveRoutes is omitted)
 * @param {(ctx) => RouteObject[]} [opts.resolveRoutes]
 *        — callback that returns the route table to mount, given
 *          `{ basename, pathname, search, firstSegment }`. Use this when a
 *          surface needs to narrow routes per-request (e.g. prototypes
 *          isolate a broken sibling proto from the matched lazy() chain).
 */
import { StrictMode, Suspense, Fragment } from 'react'
import { createRoot } from 'react-dom/client'
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { mountIsolatedContent } from '../../../core/mountIsolatedContent.js'
import { getPrototypeWrapper } from '../../loadConsumerWrapper.js'
import { installContentNavigationBridge } from './contentNavigationBridge.js'


export function mountIsolationApp({ name, wrapperKind = 'prototype', routes, resolveRoutes }) {
  // Legacy isolate endpoints default to embed behavior. Never rewrite hideUI.
  const current = new URL(window.location.href)
  if (!current.searchParams.has('_sb_embed') && !current.searchParams.has('hideUI') && !current.searchParams.has('removeUI')) {
    current.searchParams.set('_sb_embed', '')
    window.history.replaceState(window.history.state, '', current)
  }

  // Retain content theme and iframe navigation behavior without importing the
  // workspace mount path or its CSS dependency graph.
  const disposeIsolatedContent = mountIsolatedContent({
    basePath: import.meta.env.BASE_URL,
    role: wrapperKind === 'story' ? 'story-content' : 'prototype-content',
    hot: import.meta.hot,
  })

  const basePathNoTrail = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const basename = name ? `${basePathNoTrail}/${name}` : (basePathNoTrail || '/')

  const pathname = window.location.pathname
  const search = new URLSearchParams(window.location.search)
  const afterBasename = pathname.slice(basename === '/' ? 0 : basename.length)
  let firstSegment = (afterBasename.match(/^\/([^/?#]+)/) || [])[1] || ''
  // Route module roots are physical names; pathname segments are encoded.
  // Decode exactly once without turning an encoded separator into a new root.
  try {
    const physical = decodeURIComponent(firstSegment)
    if (!/[\\/]/.test(physical)) firstSegment = physical
  } catch { /* A malformed escape remains an unmatched literal route. */ }

  const activeRoutes = resolveRoutes
    ? resolveRoutes({ basename, pathname, search, firstSegment })
    : routes

  const loading = (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'block', width: 24, height: 24, margin: '48px auto', boxSizing: 'border-box',
        border: '2px solid rgba(128, 128, 128, 0.25)', borderTopColor: 'currentColor',
        borderRadius: '50%', animation: 'hc-isolation-spin .7s linear infinite',
      }}
    >
      <style>{'@keyframes hc-isolation-spin { to { transform: rotate(360deg); } }'}</style>
    </span>
  )
  const readyRoutes = activeRoutes.map(route => Object.hasOwn(route, 'hydrateFallbackElement') || Object.hasOwn(route, 'HydrateFallback')
    ? route : { ...route, hydrateFallbackElement: loading })
  // Keep RouterProvider mounted while a consumer wrapper suspends. Otherwise
  // initial lazy routes can settle before its subscription commits, leaving
  // the provider stuck on the initial hydration fallback.
  const Wrapper = wrapperKind === 'story' ? Fragment : getPrototypeWrapper()
  function ContentWrapper() {
    return <Suspense fallback={loading}><Wrapper><Outlet /></Wrapper></Suspense>
  }
  const router = createBrowserRouter([{ Component: ContentWrapper, children: readyRoutes }], { basename })
  const disposeNavigationBridge = installContentNavigationBridge(router, {
    basePath: import.meta.env.BASE_URL || '/',
  })

  const rootElement = document.getElementById('root')
  const root = createRoot(rootElement)

  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )

  // Keep the message listener tied to this router's lifetime. In normal
  // browser startup this lasts for the document; tests and embedded remounts
  // can still release it deterministically.
  router.dispose = (() => {
    const dispose = router.dispose.bind(router)
    return () => {
      disposeNavigationBridge()
      disposeIsolatedContent()
      dispose()
    }
  })()
}
