import { afterEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const catalog = vi.hoisted(() => ({ stories: {} }))
vi.mock('../../core/data/loader.js', () => ({
  getStoryData: name => catalog.stories[name], listStories: () => Object.keys(catalog.stories),
}))
vi.mock('../loadConsumerWrapper.js', () => ({ getStoryWrapper: () => ({ children }) => children }))
import StoryPage from './StoryPage.jsx'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('renders one component with selectable stories across modules and deep-link query state', async () => {
  catalog.stories = {
    Button: {
      _componentId: 'button', _componentName: 'Button', _route: '/components/Button', _storyFile: 'examples.stories.tsx',
      _exportNames: ['Primary', 'Secondary'],
      _storyImport: async () => ({ default: { component: ({ label }) => <button>{label}</button> }, Primary: { args: { label: 'Primary preview' } }, Secondary: { args: { label: 'Secondary preview' } } }),
    },
    'Button/More': {
      _componentId: 'button', _componentName: 'Button', _route: '/components/Button/More', _storyFile: 'More.story.jsx',
      _exportNames: ['Disabled'], _storyImport: async () => ({ Disabled: () => <button disabled>Disabled preview</button> }),
    },
  }
  function RouteView() {
    const location = useLocation()
    return <><output aria-label="route">{location.pathname}{location.search}{location.hash}</output>
      <StoryPage name={location.pathname.endsWith('/More') ? 'Button/More' : 'Button'} /></>
  }
  render(<MemoryRouter initialEntries={['/components/Button?_sb_embed&_sb_component_view&keep=authored#details']}>
    <Routes><Route path="/components/*" element={<RouteView />} /></Routes>
  </MemoryRouter>)
  await screen.findByRole('button', { name: 'Primary preview' })
  expect(screen.queryByRole('button', { name: 'Secondary preview' })).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Story' }), { target: { value: JSON.stringify(['Button', 'Secondary']) } })
  await screen.findByRole('button', { name: 'Secondary preview' })
  expect(screen.getByRole('status', { name: 'route' }).textContent).toContain('export=Secondary')
  fireEvent.change(screen.getByRole('combobox', { name: 'Story' }), { target: { value: JSON.stringify(['Button/More', 'Disabled']) } })
  await screen.findByRole('button', { name: 'Disabled preview' })
  expect(screen.getByRole('status', { name: 'route' }).textContent).toContain('/components/Button/More?')
  expect(screen.getByRole('status', { name: 'route' }).textContent).toContain('keep=authored')
  expect(screen.getByRole('status', { name: 'route' }).textContent).toContain('#details')
})

it('keeps an interactive preview mounted when another module updates the variant index', async () => {
  function Counter() {
    const [count, setCount] = useState(0)
    return <button onClick={() => setCount(value => value + 1)}>Counter {count}</button>
  }
  const importStory = vi.fn(async () => ({
    default: { component: Counter, decorators: [Story => <section><Story /></section>] }, Counter,
  }))
  catalog.stories = {
    Button: {
      _componentId: 'button', _storyFile: 'examples.story.jsx', _exportNames: ['Counter'], _storyImport: importStory,
    },
  }
  render(<MemoryRouter initialEntries={['/components/Button?export=Counter']}><StoryPage name="Button" /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Counter 0' }))
  expect(screen.getByRole('button', { name: 'Counter 1' })).toBeTruthy()
  catalog.stories['Button/More'] = {
    _componentId: 'button', _storyFile: 'More.story.jsx', _exportNames: ['Added'], _route: '/components/Button/More',
  }
  fireEvent(document, new CustomEvent('storyboard:story-index-changed'))
  await screen.findByRole('option', { name: 'More.story.jsx / Added' })
  expect(screen.getByRole('button', { name: 'Counter 1' })).toBeTruthy()
  expect(importStory).toHaveBeenCalledTimes(1)
})

it('recovers a failed preview when its own module reloads without retrying it for unrelated edits', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const importBroken = vi.fn(async () => ({ Primary: () => { throw new Error('Broken preview') } }))
  catalog.stories = { Button: { _exportNames: ['Primary'], _storyImport: importBroken } }
  render(<MemoryRouter initialEntries={['/components/Button?export=Primary']}><StoryPage name="Button" /></MemoryRouter>)
  await screen.findByText('Broken preview')
  fireEvent(document, new CustomEvent('storyboard:story-index-changed'))
  expect(importBroken).toHaveBeenCalledTimes(1)
  catalog.stories.Button = { _exportNames: ['Primary'], _storyImport: async () => ({ Primary: () => <p>Recovered preview</p> }) }
  fireEvent(document, new CustomEvent('storyboard:story-index-changed'))
  await screen.findByText('Recovered preview')
})
