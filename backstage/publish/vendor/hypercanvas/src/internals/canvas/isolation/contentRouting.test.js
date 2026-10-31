import { describe, expect, it } from 'vitest'
import { contentDocumentKind, contentFrameUrl, contentNavigationTarget, publishedFallbackPath, statefullyPrototypeFrameUrl, statefullyPrototypePublicRoute } from './contentRouting.js'

describe('content document boundary', () => {
  it.each(['/', '/branch--ui-quality/'])('selects embedded content before workspace imports at %s', base => {
    const location = (path, query = '') => ({ pathname: base + path, search: query })
    expect(contentDocumentKind(location('chrome-overview'), base)).toBeNull()
    expect(contentDocumentKind(location('chrome-overview', '?_sb_embed=&flow=empty'), base)).toBe('prototype')
    expect(contentDocumentKind(location('components/Sidebar', '?_sb_embed='), base)).toBe('story')
    expect(contentDocumentKind(location('canvas/work', '?_sb_embed='), base)).toBeNull()
    expect(contentDocumentKind(location('stories.html/components/Sidebar'), base)).toBe('story')
    expect(contentDocumentKind(location('prototypes.html/signup'), base)).toBe('prototype')
  })

  it.each([
    ['root prototype route with embed query', '/?p=welcome%3F_sb_embed%3D&b=%2Fnotebook%2F', '/notebook/welcome?_sb_embed=', '/notebook/', 'prototype'],
    ['branch prototype child route with authored state', '/?p=welcome%2Fdetails%3Fflow%3Dsignup%26_sb_embed%3D%23step&b=%2Fbranch--review%2Fnotebook%2F', '/branch--review/notebook/welcome/details?flow=signup&_sb_embed=#step', '/branch--review/notebook/', 'prototype'],
    ['branch component route', '/?p=components%2FWidget%3Fmode%3Dcompact%26_sb_embed%3D%23story&b=%2Fbranch--review%2Fnotebook%2F', '/branch--review/notebook/components/Widget?mode=compact&_sb_embed=#story', '/branch--review/notebook/', 'story'],
    ['legacy content document path', '/?p=stories.html%2Fcomponents%2FWidget%3Fmode%3Dcompact&b=%2Fnotebook%2F', '/notebook/stories.html/components/Widget?mode=compact', '/notebook/', 'story'],
  ])('restores %s before entry classification', (_label, fallbackUrl, restored, base, expectedKind) => {
    const location = new URL(fallbackUrl, 'https://example.test')
    const restoredPath = publishedFallbackPath(location, true)

    expect(restoredPath).toBe(restored)
    const restoredLocation = new URL(restoredPath, location.origin)
    expect(contentDocumentKind(restoredLocation, base)).toBe(expectedKind)
    expect(restoredLocation.hash).toBe(new URL(restored, location.origin).hash)
  })

  it('does not restore untrusted or non-publication fallback parameters', () => {
    const makeLocation = search => ({ search })
    expect(publishedFallbackPath(makeLocation('?p=welcome&b=/notebook/'), false)).toBeNull()
    expect(publishedFallbackPath(makeLocation('?p=welcome&b=//evil.test/'), true)).toBeNull()
    expect(publishedFallbackPath(makeLocation('?b=/notebook/'), true)).toBeNull()
  })

  it('preserves query and fragment state in a branch frame URL', () => {
    expect(contentFrameUrl({ pathname: '/signup/details', search: '?flow=signup%2Fempty', hash: '#name=Ada' }, '/branch--ui/'))
      .toBe('/branch--ui/signup/details?flow=signup%2Fempty&_sb_embed=#name=Ada')
  })

  it('maps a canonical Prototype host route to its Statefully iframe path and back', () => {
    const location = { pathname: '/borrow-flow/request', search: '?flow=default', hash: '#borrower' }
    const frame = statefullyPrototypeFrameUrl(location, '/branch--demo/', 'borrow-flow')
    expect(frame).toBe('/branch--demo/__notebook/prototypes/borrow-flow/request?flow=default&_sb_embed=#borrower')
    expect(statefullyPrototypePublicRoute({
      pathname: '/branch--demo/__notebook/prototypes/borrow-flow/request',
      search: '?flow=default&_sb_embed=',
      hash: '#borrower',
    }, '/branch--demo/', 'borrow-flow')).toBe('/borrow-flow/request?flow=default#borrower')
    expect(statefullyPrototypePublicRoute({ pathname: '/branch--demo/__notebook/prototypes/other' }, '/branch--demo/', 'borrow-flow')).toBeNull()
  })

  it('keeps hideUI on the host bootstrap and out of authored iframe state', () => {
    expect(contentDocumentKind({ pathname: '/branch--preview/Demo/details', search: '?hideUI=1&flow=empty' }, '/branch--preview/'))
      .toBeNull()
    expect(contentDocumentKind({ pathname: '/branch--preview/canvas/work', search: '?hideUI=1' }, '/branch--preview/'))
      .toBeNull()
    expect(contentFrameUrl({ pathname: '/Demo/details', search: '?hideUI=1&flow=empty', hash: '#tab=profile' }, '/branch--preview/'))
      .toBe('/branch--preview/Demo/details?flow=empty&_sb_embed=#tab=profile')
  })

  it('accepts only same-origin absolute route messages', () => {
    expect(contentNavigationTarget('/signup?flow=empty#name=Ada', 'https://app.test')).toBe('/signup?flow=empty#name=Ada')
    expect(contentNavigationTarget('https://app.test/signup?flow=empty#name=Ada', 'https://app.test'))
      .toBe('/signup?flow=empty#name=Ada')
    expect(contentNavigationTarget('/branch--preview/signup?flow=empty#name=Ada', 'https://app.test', '/branch--preview/'))
      .toBe('/signup?flow=empty#name=Ada')
    for (const src of ['//evil.test', '/\\evil.test', 'https://evil.test', 'javascript:alert(1)', 'relative/path', null]) {
      expect(contentNavigationTarget(src, 'https://app.test')).toBeNull()
    }
    expect(contentNavigationTarget('/branch--other/signup', 'https://app.test', '/branch--preview/')).toBeNull()
  })
})
