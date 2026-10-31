import { createElement, useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { resolveStoryExports } from './storyExports.js'

afterEach(cleanup)

it('renders legacy named React stories with hooks', () => {
  function Counter() {
    const [n, setN] = useState(0)
    return <button onClick={() => setN(n + 1)}>{n}</button>
  }
  const stories = resolveStoryExports({ Counter })
  render(createElement(stories.Counter))
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button').textContent).toBe('1')
})

it('renders CSF3 component stories with merged args and decorators', () => {
  const stories = resolveStoryExports({
    default: {
      component: props => <button>{props.label} {props.size}</button>,
      args: { label: 'Default', size: 'large' },
      decorators: [Story => <section aria-label="decorated"><Story /></section>],
    },
    Primary: { args: { label: 'Primary' }, name: 'Primary button' },
  })
  render(createElement(stories.Primary))
  expect(screen.getByRole('region', { name: 'decorated' })).toBeTruthy()
  expect(screen.getByRole('button').textContent).toBe('Primary large')
  expect(stories.Primary.storyName).toBe('Primary button')
})

it('lets decorators override args while retaining source order for the default variant', () => {
  const stories = resolveStoryExports({
    default: {
      component: ({ label }) => <button>{label}</button>,
      args: { label: 'Initial' },
      decorators: [(Story, context) => <Story args={{ ...context.args, label: 'Decorated' }} />],
    },
    Alphabetic: {}, Primary: {},
  }, { exportNames: ['Primary', 'Alphabetic'] })
  expect(Object.keys(stories)).toEqual(['Primary', 'Alphabetic'])
  render(createElement(stories.Primary))
  expect(screen.getByRole('button').textContent).toBe('Decorated')
})

it('passes args and context to CSF render functions and honors story filtering', () => {
  const module = {
    default: { args: { label: 'Meta' }, excludeStories: ['Helper'], render: (args, context) => <p>{args.label}: {context.name}</p> },
    Primary: { args: { label: 'Story' }, name: 'Custom name' },
    Helper: () => <p>Not a story</p>,
    Showcase: Object.assign(() => <p>Showcase</p>, { componentSet: false }),
  }
  const stories = resolveStoryExports(module, { componentSet: true })
  expect(Object.keys(stories)).toEqual(['Primary'])
  render(createElement(stories.Primary))
  expect(screen.getByText('Story: Custom name')).toBeTruthy()
})

it('keeps decorated story state while receiving new args on a parent rerender', () => {
  function Counter({ label }) {
    const [count, setCount] = useState(0)
    return <button onClick={() => setCount(value => value + 1)}>{label} {count}</button>
  }
  const stories = resolveStoryExports({
    default: { component: Counter, decorators: [(Story, context) => <section><Story args={{ label: `${context.args.label}!` }} /></section>] },
    Primary: { args: { label: 'Initial' } },
  })
  const view = render(createElement(stories.Primary))
  fireEvent.click(screen.getByRole('button', { name: 'Initial! 0' }))
  view.rerender(createElement(stories.Primary, { args: { label: 'Updated' } }))
  expect(screen.getByRole('button', { name: 'Updated! 1' })).toBeTruthy()
})
