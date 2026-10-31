import { mountIsolationApp } from './mountIsolationApp.jsx'

/** Used by the main HTML bootstrap in dev, packaged apps and static builds. */
export async function mountContentEntry(kind) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const path = window.location.pathname.slice(base.length)
  const name = path.match(/^\/(prototypes|stories)\.html(?:\/|$)/)?.[1]
  const entryName = name ? `${name}.html` : ''
  if (kind === 'doc') {
    const [{ createElement }, { createRoot }, { createBrowserRouter, RouterProvider }, { default: DocPage }] = await Promise.all([
      import('react'), import('react-dom/client'), import('react-router-dom'), import('../../Document/DocPage.jsx'),
    ])
    const router = createBrowserRouter([{ path: '/docs/:docId', element: createElement(DocPage) }], { basename: import.meta.env.BASE_URL })
    createRoot(document.getElementById('root')).render(createElement(RouterProvider, { router }))
  } else if (kind === 'story') {
    const { storyRoutes } = await import('./storyRoutes.jsx')
    mountIsolationApp({ name: entryName, wrapperKind: 'story', routes: storyRoutes })
  } else {
    const { routes, getRoutesForProto } = await import('./prototypeRoutes.jsx')
    mountIsolationApp({
      name: entryName,
      resolveRoutes: ({ firstSegment }) => firstSegment ? getRoutesForProto(firstSegment) : routes,
    })
  }
}
