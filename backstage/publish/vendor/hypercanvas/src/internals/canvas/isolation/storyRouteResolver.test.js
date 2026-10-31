import { describe, expect, it } from 'vitest'
import { resolveStoryName } from './storyRouteResolver.js'

describe('isolated story route resolver', () => {
  it('resolves the canonical catalog component route', () => {
    const stories = { Widget: { _route: '/components/Widget' } }

    expect(resolveStoryName('/components/Widget', stories)).toBe('Widget')
    expect(resolveStoryName('/components/Widget/Widget', stories)).toBeNull()
  })

  it('resolves canonical component routes under a branch base path', () => {
    const stories = { Widget: { _route: '/components/Widget' } }

    expect(resolveStoryName('/branch--folder-artifacts/components/Widget', stories,
      '/branch--folder-artifacts/')).toBe('Widget')
    expect(resolveStoryName('/components/Widget', stories,
      '/branch--folder-artifacts/')).toBe('Widget')
    expect(resolveStoryName('/branch--other/components/Widget', stories,
      '/branch--folder-artifacts/')).toBeNull()
  })
})
