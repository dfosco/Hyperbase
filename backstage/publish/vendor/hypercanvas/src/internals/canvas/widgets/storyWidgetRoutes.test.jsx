import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStoryData } from '../../../core/index.js'
import { resolveStoryUrl } from './StoryWidget.jsx'
import { resolveStorySetUrl } from './StorySetWidget.jsx'

vi.mock('../../../core/index.js', async importOriginal => ({
  ...await importOriginal(),
  getStoryData: vi.fn(),
}))

describe('component story iframe routes', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true)
    getStoryData.mockReturnValue({ _storyModule: 'Widget/Widget.story.jsx', _route: '/components/Widget' })
  })

  it.each([
    ['root', '/', '/stories.html/components/Widget'],
    ['branch-prefixed', '/branch--components/', '/branch--components/stories.html/components/Widget'],
  ])('resolves the named story iframe at the %s path', (_label, baseUrl, expectedPath) => {
    vi.stubEnv('BASE_URL', baseUrl)
    const url = new URL(resolveStoryUrl('Widget', 'Compact', 'dark'), 'http://localhost')

    expect(url.pathname).toBe(expectedPath)
    expect(url.searchParams.get('export')).toBe('Compact')
    expect(url.searchParams.has('_sb_embed')).toBe(true)
    expect(url.searchParams.get('theme')).toBe('dark')
  })

  it.each([
    ['root', '/', '/stories.html/components/Widget'],
    ['branch-prefixed', '/branch--components/', '/branch--components/stories.html/components/Widget'],
  ])('resolves the component set iframe at the %s path', (_label, baseUrl, expectedPath) => {
    vi.stubEnv('BASE_URL', baseUrl)
    const url = new URL(resolveStorySetUrl('Widget', 'wide', 'Compact Design', 'comfortable', 'light'), 'http://localhost')

    expect(url.pathname).toBe(expectedPath)
    expect(url.searchParams.has('_sb_embed')).toBe(true)
    expect(url.searchParams.has('_sb_component_set')).toBe(true)
    expect(url.searchParams.get('layout')).toBe('wide')
    expect(new URLSearchParams(url.hash.slice(1)).get('selected')).toBe('Compact Design')
  })
})
