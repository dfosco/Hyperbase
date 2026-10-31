/**
 * Read-only knob hook.
 *
 * Resolves the current prototype/route and reads typed values through the
 * shared Statefully knob store while retaining Hypercanvas reactivity.
 */

import { useContext, useMemo, useSyncExternalStore } from 'react'
import { StoryboardContext } from '../StoryboardContext.js'
import {
  createHypercanvasKnobRuntime,
  getPrototypeKnobs,
} from '../../core/knobs/index.js'

/**
 * Detect the active prototype and route scope from the current URL.
 *
 * Handles the dev-only `/prototypes.html/<proto>/...` iframe-isolation
 * prefix (`packages/storyboard/src/internals/canvas/widgets/PrototypeEmbed.jsx`)
 * by stripping it before parsing — otherwise `prototypes.html` ends up as
 * the prototype name and the real prototype is treated as a route segment.
 *
 * @param {string} [pathname]
 * @param {string} [basePath]
 * @returns {{ prototypeName: string|null, route: string|undefined }}
 */
export function detectKnobRoute(
  pathname = window.location.pathname,
  basePath = import.meta.env?.BASE_URL || '/',
) {
  let path = pathname
  const base = basePath.replace(/\/+$/, '')
  if (base && base !== '/' && path.startsWith(base)) {
    path = path.slice(base.length) || '/'
  }

  // Strip the prototypes.html isolation prefix (dev iframe path).
  path = path.replace(/^\/prototypes\.html(?=\/|$)/, '') || '/'

  path = path.replace(/\/+$/, '') || '/'
  const segments = path.split('/').filter(Boolean)
  const branchSegment = segments[0]?.startsWith('branch--') ? segments[0] : null
  const protoIdx = branchSegment ? 1 : 0
  const prototypeName = segments[protoIdx] || null
  const routeSegments = prototypeName ? segments.slice(protoIdx + 1) : []
  const route = routeSegments.length > 0 ? `/${routeSegments.join('/')}` : undefined

  return { prototypeName, route }
}

/**
 * Read a typed knob value from URL hash state.
 *
 * Behaves like `useOverride`: reads the URL hash key, re-renders on
 * `hashchange`. When a schema is declared, coercion + default fallback
 * apply. When no schema is discovered, returns the raw hash value as-is
 * so prototypes always react to URL changes (even before discovery runs).
 *
 * @param {string} id
 * @param {{ route?: string|null, scope?: string|null }} [options]
 * @returns {*}
 */
export function useKnob(id, { route, scope } = {}) {
  const context = useContext(StoryboardContext)
  const detected = detectKnobRoute()
  const hasExplicitRoute = route !== undefined || scope !== undefined
  const routeValue = route !== undefined ? route : scope
  const resolvedRoute = hasExplicitRoute ? routeValue : detected.route
  const prototypeName = context?.prototypeName ?? detected.prototypeName
  const knobs = useMemo(() => prototypeName ? getPrototypeKnobs(prototypeName) : [], [prototypeName])
  const runtime = useMemo(() => createHypercanvasKnobRuntime(knobs, {
    ...(resolvedRoute === undefined ? {} : { route: resolvedRoute }),
  }), [knobs, resolvedRoute])
  useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot)
  const definition = hasExplicitRoute
    ? runtime.store.resolve(id, resolvedRoute)
    : runtime.store.resolve(id)
  const state = definition ? runtime.read(definition) : null
  if (state) return state.value
  return hasExplicitRoute
    ? runtime.store.getKnob(id, undefined, resolvedRoute)
    : runtime.store.getKnob(id)
}
