import { afterEach, describe, expect, it } from 'vitest'
import { generatePreservedRoutes, patterns } from '@generouted/react-router/core'
import { matchRoutes } from 'react-router-dom'
import { compileModalRoutes, compileRegularRoutes } from './routeCompiler.js'
import { filterChildrenForProto } from './routeFilter.js'

const originalRoutePattern = patterns.route

afterEach(() => {
  patterns.route = originalRoutePattern
})

function useStoryboardPatterns() {
  patterns.route = [/^.*\/src\/(library|prototypes)\/|^\/(library|prototypes)\/|[^/]*\.folder\/|(?<=^|\/)drafts\/|\.(jsx|tsx|mdx)$/g, '']
}

describe('route compiler', () => {
  it('compiles shell prototype roots literally while preserving dotted legacy and app routes', () => {
    useStoryboardPatterns()
    const layoutLoader = () => 'layout'
    const layoutAction = () => 'layout action'
    const childLoader = () => 'child'
    const childAction = () => 'child action'
    const builtKeys = []
    const built = compileRegularRoutes({
      '/src/prototypes/Travel.prototype/index.jsx': () => null,
      '/src/prototypes/Travel.prototype/_layout.jsx': () => null,
      '/src/prototypes/Travel.prototype/detail/[bookingId].jsx': () => null,
      '/src/prototypes/Legacy/Checkout.step.jsx': () => null,
    }, (_module, key) => {
      builtKeys.push(key)
      return {
        id: key,
        ...(key.endsWith('/index.jsx') ? { index: true } : {}),
        loader: key.endsWith('/_layout.jsx') ? layoutLoader : childLoader,
        action: key.endsWith('/_layout.jsx') ? layoutAction : childAction,
      }
    })

    const artifact = built.find(route => route.path === 'Travel.prototype')
    expect(artifact).toBeTruthy()
    expect(artifact.loader).toBe(layoutLoader)
    expect(artifact.action).toBe(layoutAction)
    expect(artifact.children.some(route => route.index)).toBe(true)
    const detail = artifact.children.find(route => route.path === 'detail')
    const dynamic = detail.children.find(route => route.path === ':bookingId')
    expect(dynamic.loader).toBe(childLoader)
    expect(dynamic.action).toBe(childAction)
    expect(builtKeys).toContain('/src/prototypes/Travel.prototype/index.jsx')
    expect(builtKeys).toContain('/src/prototypes/Travel.prototype/_layout.jsx')
    expect(builtKeys.every(key => !key.includes('__HYPERCANVAS_LITERAL_PROTOTYPE_DOT__'))).toBe(true)
    expect(built.some(route => route.path === 'Travel/prototype')).toBe(false)

    const legacy = built.find(route => route.path === 'Legacy')
    expect(legacy.children.some(route => route.path === 'Checkout/step')).toBe(true)
    expect(generatePreservedRoutes({ '/src/library/_app.jsx': { id: 'app' } })).toEqual({ '_app': { id: 'app' } })
  })

  it('compiles iframe prototype and modal routes with the same literal suffix behavior', () => {
    useStoryboardPatterns()
    const iframe = compileRegularRoutes({
      '/src/prototypes/Travel.prototype/index.jsx': () => null,
      '/src/prototypes/Travel.prototype/detail/[bookingId].jsx': () => null,
      '/src/prototypes/Travel.prototype/detail/Checkout.step.jsx': () => null,
      '/src/prototypes/Legacy/Checkout.step.jsx': () => null,
    }, (_module, key) => ({ id: key }))
    const modals = compileModalRoutes({
      '/src/prototypes/Travel.prototype/+Confirm.jsx': { default: 'confirm' },
      '/src/prototypes/Travel.prototype/+Confirm.email.jsx': { default: 'artifact dotted modal' },
      '/src/prototypes/Legacy/+Confirm.email.jsx': { default: 'legacy' },
    })

    expect(iframe.some(route => route.path === 'Travel.prototype')).toBe(true)
    expect(iframe.some(route => route.path === 'Travel/prototype')).toBe(false)
    const isolated = filterChildrenForProto(iframe, 'Travel.prototype')
    expect(isolated.map(route => route.path)).toEqual(['Travel.prototype'])
    expect(isolated[0].children.some(route => route.path === 'detail')).toBe(true)
    const legacy = iframe.find(route => route.path === 'Legacy')
    expect(legacy.children.some(route => route.path === 'Checkout/step')).toBe(true)
    const artifactDetail = isolated[0].children.find(route => route.path === 'detail')
    expect(artifactDetail.children.some(route => route.path === 'Checkout/step')).toBe(true)
    expect(modals['/Travel.prototype/Confirm']).toBe('confirm')
    expect(modals['/Travel.prototype/Confirm/email']).toBe('artifact dotted modal')
    expect(modals['/Legacy/Confirm/email']).toBe('legacy')
  })

  it('shields complete artifact roots from generouted syntax and matches them as literal paths', () => {
    useStoryboardPatterns()
    const originalKeys = []
    const names = ['Release.v2', '[bookingId]', '+Overlay', '*Wildcard']
    const files = Object.fromEntries(names.map(name => [`/src/prototypes/${name}.prototype/index.jsx`, () => null]))
    const routes = compileRegularRoutes(files, (_module, key) => {
      originalKeys.push(key)
      return { id: key, index: true }
    })

    expect(routes.map(route => route.path).sort()).toEqual(names.map(name => `${name}.prototype`).sort())
    expect(routes.flatMap(route => route.children || []).map(route => route.id).sort()).toEqual(Object.keys(files).sort())
    expect(originalKeys.sort()).toEqual(Object.keys(files).sort())
    for (const name of names) {
      const pathname = `/${encodeURIComponent(`${name}.prototype`)}`
      expect(matchRoutes(routes, { pathname })?.[0].route.path).toBe(`${name}.prototype`)
    }
    expect(matchRoutes(routes, { pathname: '/Other.prototype' })).toBeNull()
  })
})
