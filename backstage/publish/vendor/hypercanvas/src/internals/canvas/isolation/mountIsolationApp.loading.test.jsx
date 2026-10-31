import { act, lazy } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

const lifecycle = vi.hoisted(() => ({ roots: [], routers: [], wrapper: null }))
vi.mock('react-dom/client', async original => {
  const actual = await original()
  return { ...actual, createRoot: node => { const root = actual.createRoot(node); lifecycle.roots.push(root); return root } }
})
vi.mock('react-router-dom', async original => {
  const actual = await original()
  return { ...actual, createBrowserRouter: (...args) => { const router = actual.createBrowserRouter(...args); lifecycle.routers.push(router); return router } }
})
vi.mock('../../../core/mountIsolatedContent.js', () => ({ mountIsolatedContent: () => () => {} }))
vi.mock('../../loadConsumerWrapper.js', async () => { const { Fragment } = await import('react'); return { getPrototypeWrapper: () => lifecycle.wrapper || Fragment } })
vi.mock('./contentNavigationBridge.js', () => ({ installContentNavigationBridge: () => () => {} }))

import { mountIsolationApp } from './mountIsolationApp.jsx'

beforeEach(() => {
  lifecycle.wrapper = null
  window.history.replaceState(null, '', '/Demo?_sb_embed=')
  document.body.innerHTML = '<div id="root"></div>'
})
afterEach(async () => {
  await act(async () => lifecycle.roots.splice(0).forEach(root => root.unmount()))
  lifecycle.routers.splice(0).forEach(router => router.dispose())
})

describe('isolated document loading presentation', () => {
  it('does not lose route initialization while a lazy consumer wrapper suspends', async () => {
    let loadWrapper, loadRoute
    lifecycle.wrapper = lazy(() => new Promise(resolve => { loadWrapper = resolve }))
    const route = new Promise(resolve => { loadRoute = resolve })
    await act(async () => mountIsolationApp({ name: '', routes: [{ path: '*', lazy: () => route }] }))
    await act(async () => loadRoute({ Component: () => <h1>Route under lazy wrapper</h1> }))
    await act(async () => loadWrapper({ default: ({ children }) => children }))
    expect(await screen.findByRole('heading', { name: 'Route under lazy wrapper' })).toBeVisible()
  })
  it.each([false, true])('shows initial hydration loading and preserves authored fallback=%s', async authored => {
    let finish
    const pending = new Promise(resolve => { finish = resolve })
    await act(async () => mountIsolationApp({ name: '', routes: [{ path: '*', lazy: () => pending, ...(authored ? { hydrateFallbackElement: <p>Authored pending</p> } : {}) }] }))
    expect((authored ? screen.getByText('Authored pending') : screen.getByRole('status', { name: 'Loading' }))).toBeVisible()
    await act(async () => finish({ Component: () => <h1>Ready document</h1> }))
    expect(await screen.findByRole('heading', { name: 'Ready document' })).toBeVisible()
  })

  it('shows visible Suspense content until the child resolves', async () => {
    let finish
    let ready = false
    const pending = new Promise(resolve => { finish = () => { ready = true; resolve() } })
    function Content() { if (!ready) throw pending; return <h1>Suspense resolved</h1> }
    await act(async () => mountIsolationApp({ name: '', routes: [{ path: '*', Component: Content }] }))
    expect(screen.getByRole('status', { name: 'Loading' })).toBeVisible()
    await act(async () => finish())
    expect(await screen.findByRole('heading', { name: 'Suspense resolved' })).toBeVisible()
  })
})
