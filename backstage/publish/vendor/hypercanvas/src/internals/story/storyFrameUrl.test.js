import { expect, it } from 'vitest'
import { storyFrameUrl } from './storyFrameUrl.js'

const story = { _storyModule: '/examples.stories.tsx', _route: '/components/Button/More' }

it('preserves authored story state and applies the effective theme and bare preview mode', () => {
  const url = new URL(storyFrameUrl(story, 'Button/More', {
    search: '?keep=authored&theme=light&_sb_component_view', hash: '#details', exportName: 'Disabled',
  }, { theme: 'dark' }), 'https://app.example')
  expect(url.searchParams.get('keep')).toBe('authored')
  expect(url.searchParams.get('export')).toBe('Disabled')
  expect(url.searchParams.get('theme')).toBe('light')
  expect(url.searchParams.has('_sb_embed')).toBe(true)
  expect(url.searchParams.has('_sb_component_view')).toBe(false)
  expect(url.hash).toBe('#details')
})

it('preserves component-set density and other fragment entries while updating selection', () => {
  const props = { search: '?keep=authored&density=compact', hash: '#selected=Primary&focus=button', selected: 'Secondary', layout: 'tall' }
  const url = new URL(storyFrameUrl(story, 'Button/More', props, { componentSet: true, theme: 'dark' }), 'https://app.example')
  expect(url.searchParams.get('density')).toBe('compact')
  expect(url.searchParams.get('layout')).toBe('tall')
  expect(new URLSearchParams(url.hash.slice(1)).get('focus')).toBe('button')
  expect(new URLSearchParams(url.hash.slice(1)).get('selected')).toBe('Secondary')
  const cleared = new URL(storyFrameUrl(story, 'Button/More', { ...props, selected: '' }, { componentSet: true }), 'https://app.example')
  expect(cleared.hash).toBe('#focus=button')
})

it('keeps a plain authored anchor verbatim when the component set has no selection', () => {
  const url = new URL(storyFrameUrl(story, 'Button/More', { hash: '#details', selected: '' }, { componentSet: true }), 'https://app.example')
  expect(url.hash).toBe('#details')
})
