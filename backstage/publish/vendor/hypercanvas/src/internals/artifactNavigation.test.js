import { describe, expect, it } from 'vitest'
import {
  artifactRouteStorageKey,
  buildArtifactRoute,
  buildProductionPageUrl,
  getArtifactRouteLocation,
  matchesArtifactRoute,
  resolvePublishedRoute,
} from './artifactNavigation.js'

describe('artifact navigation', () => {
  const site = { id: 'page-site-a', type: 'site', siteId: 'site-a', route: '/sites/site-a' }
  const prototype = { id: 'src/prototypes/demo', type: 'prototype', route: '/demo' }
  const component = { id: 'component-stable-id', type: 'component', route: '/components/widgets/button' }

  it('keys saved routes by artifact identity and stores only route-relative location', () => {
    expect(artifactRouteStorageKey(site)).toBe('hypercanvas:artifact:site:site-a:last-route')
    expect(artifactRouteStorageKey(prototype)).toBe('hypercanvas:artifact:prototype:src%2Fprototypes%2Fdemo:last-route')
    expect(getArtifactRouteLocation(site, '/sites/site-a/guide', '?mode=full&terminal=true&_notebookPage=one', '#intro')).toBe('/guide?mode=full#intro')
  })

  it('matches nested Site and Prototype routes but not unrelated paths', () => {
    expect(matchesArtifactRoute(site, '/sites/site-a/guide')).toBe(true)
    expect(matchesArtifactRoute(prototype, '/demo/settings')).toBe(true)
    expect(matchesArtifactRoute(site, '/sites/site-ab')).toBe(false)
  })

  it('matches and restores component leaf routes by stable artifact identity', () => {
    expect(artifactRouteStorageKey(component)).toBe('hypercanvas:artifact:component:component-stable-id:last-route')
    expect(matchesArtifactRoute(component, '/components/widgets/button/stories/primary')).toBe(true)
    expect(getArtifactRouteLocation(component, '/components/widgets/button/stories/primary', '?selected=Primary')).toBe('/stories/primary?selected=Primary')
    expect(buildArtifactRoute(component, '/stories/primary?selected=Primary')).toBe('/components/widgets/button/stories/primary?selected=Primary')
    expect(matchesArtifactRoute(component, '/components/widgets/button-copy')).toBe(false)
  })

  it('rebuilds safe saved paths and rejects malformed or traversing values', () => {
    expect(buildArtifactRoute(site, '/guide?mode=full#intro')).toBe('/sites/site-a/guide?mode=full#intro')
    expect(buildArtifactRoute(site, '/../private')).toBe('/sites/site-a')
    expect(buildArtifactRoute(site, '//other.example/path')).toBe('/sites/site-a')
  })

  it('keeps valid published deep links and falls back to the first routed item', () => {
    const pages = [{ id: 'canvas', type: 'canvas', route: '/canvas' }, site, prototype]
    expect(resolvePublishedRoute(pages, '/sites/site-a/guide?x=1#intro')).toMatchObject({
      page: site,
      route: '/sites/site-a/guide?x=1#intro',
      error: null,
    })
    expect(resolvePublishedRoute(pages, '/missing')).toMatchObject({ page: pages[0], route: '/canvas', error: null })
    expect(resolvePublishedRoute([], '/missing').error).toMatch(/does not contain any pages/)
    expect(resolvePublishedRoute([{ ...site, available: false }], '/missing').error).toMatch(/first published page is unavailable/)
  })

  it('maps production handoff to the same branch page path and query', () => {
    expect(buildProductionPageUrl({
      prodDomain: 'example.com/notebook',
      currentUrl: 'http://localhost:5173/sites/site-a/guide?mode=full#intro',
      branch: 'feature-x',
    })).toBe('https://example.com/notebook/branch--feature-x/sites/site-a/guide?mode=full#intro')
  })
})
