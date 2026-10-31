import { applyHideUIFromUrl } from '../../core/session/chromeVisibility.js'
import { useEffect } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initConfig, _resetConfig } from '../../core/stores/configStore.js'
import { getConfig as validateConfig } from '../../core/stores/configSchema.js'
import { MemoryRouter, createBrowserRouter, RouterProvider } from 'react-router-dom'

const mocks = vi.hoisted(() => ({ coreRequestJson: vi.fn(), mounted: 0, unmounted: 0 }))
vi.mock('../../core/index.js', () => ({
  getFlag: () => false,
  isCustomerHidingAllTools: () => false,
  isCustomerMode: () => false,
  subscribeToStorage: () => () => {},
}))
vi.mock('../../core/notebook/browserBridge.js', () => ({
  NOTEBOOK_SIDEBAR_EVENT: 'storyboard:open-notebook-sidebar',
  coreApiPath: value => value,
  coreRequestJson: mocks.coreRequestJson,
  openNotebookSidebar: () => {},
}))
vi.mock('../CommandPalette/CreateDialog.jsx', () => ({
  default: ({ type, initialValues }) => type ? <output data-testid="create-context">{JSON.stringify({ type, initialValues })}</output> : null,
}))
vi.mock('../NotebookDialog/NotebookDialog.jsx', () => ({ default: () => null }))
vi.mock('../settings/SettingsDialog.jsx', () => ({ default: () => null }))
vi.mock('../../core/ui/userDialogs.js', () => ({ requestText: vi.fn(), requestConfirmation: vi.fn() }))

import NotebookShell from './NotebookShell.jsx'

const tree = {
  capabilities: { reorderSiblings: true },
  root: { kind: 'folder', ref: null, name: 'Notebook', path: '', parentPath: null, depth: 0, capabilities: { reorderSiblings: true }, children: [
    { kind: 'folder', ref: { kind: 'folder', path: 'ordinary' }, name: 'ordinary', path: 'ordinary', parentPath: '', depth: 1, capabilities: { reorderSiblings: true }, children: [] },
  ] },
}

function ChildFrame() {
  useEffect(() => { mocks.mounted++; return () => { mocks.unmounted++ } }, [])
  return <iframe title="authored child frame" />
}

let browserRouter

afterEach(() => {
  cleanup()
  browserRouter?.dispose()
  browserRouter = undefined
  _resetConfig()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  window.history.replaceState(null, '', '/')
  document.documentElement.classList.remove('storyboard-chrome-hidden', 'storyboard-chrome-completely-hidden')
  mocks.mounted = 0
  mocks.unmounted = 0
})

function setup() {
  mocks.coreRequestJson.mockImplementation(async path => {
    if (path.endsWith('/pages')) return { title: 'Notebook', pages: [], notebookId: 'notebook-1', generation: 'generation-1', revision: 'revision-1' }
    if (path.endsWith('/navigation')) return { navigation: null, tree, notebookId: 'notebook-1', generation: 'generation-1', revision: 'revision-1' }
    if (path.endsWith('/site/list')) return { sites: [] }
    return {}
  })
  return render(<MemoryRouter initialEntries={['/']}><NotebookShell><ChildFrame /></NotebookShell></MemoryRouter>)
}

it('refreshes order metadata without remounting the authored child frame', async () => {
  setup()
  const frame = await screen.findByTitle('authored child frame')
  await waitFor(() => expect(mocks.coreRequestJson.mock.calls.length).toBeGreaterThanOrEqual(3))
  const baseline = mocks.coreRequestJson.mock.calls.length
  window.dispatchEvent(new CustomEvent('storyboard:notebook-order-changed', { detail: { notebookId: 'notebook-1', generation: 'generation-1', parentPath: '' } }))
  await waitFor(() => expect(mocks.coreRequestJson.mock.calls.length).toBeGreaterThan(baseline))
  expect(screen.getByTitle('authored child frame')).toBe(frame)
  expect(mocks.mounted).toBe(1)
  expect(mocks.unmounted).toBe(0)
})

it('passes the selected ordinary folder or empty root path to the create dialog', async () => {
  setup()
  await screen.findByRole('button', { name: /^ordinary$/ })
  fireEvent.click(screen.getByRole('button', { name: /^ordinary$/ }))
  fireEvent.click(screen.getByRole('button', { name: 'New page' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'New Canvas' }))
  expect(JSON.parse(screen.getByTestId('create-context').textContent)).toEqual({ type: 'canvas', initialValues: { parentPath: 'ordinary' } })
})

it('uses the empty parentPath when creating at Notebook root', async () => {
  setup()
  await screen.findByRole('button', { name: /^ordinary$/ })
  fireEvent.click(screen.getByRole('button', { name: 'New page' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'New Component' }))
  expect(JSON.parse(screen.getByTestId('create-context').textContent)).toEqual({ type: 'component', initialValues: { parentPath: '' } })
})

it('passes snapshot-level nested diagnostics into the repair presentation', async () => {
  const diagnostic = { code: 'NESTED_ARTIFACT', message: 'Nested physical suffix', path: 'Outer/Inner.prototype', nestedArtifact: { kind: 'prototype', path: 'Outer/Inner.prototype' }, containingArtifact: { kind: 'canvas', path: 'Outer.canvas' }, repairParentPath: '' }
  mocks.coreRequestJson.mockImplementation(async path => {
    if (path.endsWith('/pages')) return { title: 'Notebook', pages: [], notebookId: 'notebook-1', generation: 'generation-1', revision: 'revision-1' }
    if (path.endsWith('/navigation')) return { navigation: null, tree, diagnostics: [diagnostic], notebookId: 'notebook-1', generation: 'generation-1', revision: 'revision-1' }
    if (path.endsWith('/site/list')) return { sites: [] }
    return {}
  })
  render(<MemoryRouter initialEntries={['/']}><NotebookShell><ChildFrame /></NotebookShell></MemoryRouter>)
  expect(await screen.findByRole('dialog')).toBeTruthy()
  expect(await screen.findByText('Outer/Inner.prototype')).toBeTruthy()
})

it('repairs the exact structured nesting diagnostic and refreshes the live tree', async () => {
  const diagnostic = {
    code: 'NESTED_ARTIFACT', message: 'Prototype is nested.',
    nestedArtifact: { kind: 'prototype', path: 'Outer/Inner.prototype' },
    containingArtifact: { kind: 'canvas', path: 'Outer.canvas' },
    repairParentPath: '', proposedDestination: 'Inner.prototype',
  }
  let repaired = false
  mocks.coreRequestJson.mockImplementation(async path => {
    if (path.endsWith('/pages')) return { title: 'Notebook', pages: [], notebookId: 'notebook-1', generation: 2, revision: repaired ? 'revision-2' : 'revision-1' }
    if (path.endsWith('/navigation')) return { navigation: null, tree, diagnostics: repaired ? [] : [diagnostic], notebookId: 'notebook-1', generation: 2, revision: repaired ? 'revision-2' : 'revision-1' }
    if (path.endsWith('/site/list')) return { sites: [] }
    if (path.endsWith('/repair')) {
      repaired = true
      return { success: true, notebookId: 'notebook-1', generation: 2, revision: 'revision-2', repaired: { id: 'nested-id', kind: 'prototype', fromPath: 'Outer/Inner.prototype', toPath: 'Inner.prototype' }, diagnostics: [] }
    }
    return {}
  })
  render(<MemoryRouter initialEntries={['/']}><NotebookShell><ChildFrame /></NotebookShell></MemoryRouter>)
  expect(await screen.findByRole('dialog')).toBeTruthy()
  await screen.findByTitle('authored child frame')
  const unmountsBeforeRepair = mocks.unmounted
  const before = mocks.coreRequestJson.mock.calls.length
  fireEvent.click(screen.getByRole('button', { name: 'Repair this path' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const repairCall = mocks.coreRequestJson.mock.calls.find(([path]) => path.endsWith('/repair'))
  expect(repairCall[1]).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } })
  expect(JSON.parse(repairCall[1].body)).toEqual({
    notebookId: 'notebook-1', generation: 2, expectedRevision: 'revision-1',
    nestedArtifact: diagnostic.nestedArtifact, containingArtifact: diagnostic.containingArtifact,
    expectedProposedDestination: 'Inner.prototype',
  })
  expect(mocks.coreRequestJson.mock.calls.slice(before).some(([path]) => path.endsWith('/navigation'))).toBe(true)
  expect(screen.getByTitle('authored child frame')).toBeTruthy()
  expect(mocks.unmounted).toBe(unmountsBeforeRepair)
})

it('keeps partial-move repair details actionable after refreshed diagnostics close the modal', async () => {
  const diagnostic = {
    code: 'NESTED_ARTIFACT', message: 'Prototype is nested.',
    nestedArtifact: { kind: 'prototype', path: 'Outer/Inner.prototype' },
    containingArtifact: { kind: 'canvas', path: 'Outer.canvas' },
    repairParentPath: '', proposedDestination: 'Inner.prototype',
  }
  let moved = false
  mocks.coreRequestJson.mockImplementation(async path => {
    if (path.endsWith('/pages')) return { title: 'Notebook', pages: [], notebookId: 'notebook-1', generation: 2, revision: moved ? 'revision-2' : 'revision-1' }
    if (path.endsWith('/navigation')) return { navigation: null, tree, diagnostics: moved ? [] : [diagnostic], notebookId: 'notebook-1', generation: 2, revision: moved ? 'revision-2' : 'revision-1' }
    if (path.endsWith('/site/list')) return { sites: [] }
    if (path.endsWith('/repair')) {
      moved = true
      throw Object.assign(new Error('Reconciliation failed after rename.'), {
        code: 'NESTED_ARTIFACT_REPAIR_FAILED',
        data: { moved: true, fromPath: 'Outer/Inner.prototype', toPath: 'Inner.prototype', diagnostics: [] },
      })
    }
    return {}
  })
  render(<MemoryRouter initialEntries={['/']}><NotebookShell><ChildFrame /></NotebookShell></MemoryRouter>)
  await screen.findByRole('dialog')
  fireEvent.click(screen.getByRole('button', { name: 'Repair this path' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Outer/Inner.prototype')
  expect(alert.textContent).toContain('Inner.prototype')
  expect(alert.textContent).toContain('Refresh the Notebook before taking further action')
  expect(screen.getByTitle('authored child frame')).toBeTruthy()
})

it.each(['prototype', 'doc'])('opens the source directory from the %s menu and reports native errors', async type => {
  const page = { id: 'source', title: 'Source', type, path: 'Design/Source.' + type + '/index.jsx', route: '/Source', available: true }
  const node = { kind: 'artifact', id: page.id, pageId: page.id, ref: { kind: 'artifact', id: page.id }, artifactKind: type, name: 'Source', title: page.title, path: 'Design/Source.' + type, payloadPath: page.path, parentPath: 'Design', depth: 2, route: page.route, available: true }
  mocks.coreRequestJson.mockImplementation(async path => {
    if (path.endsWith('/pages')) return { title: 'Notebook', pages: [page], notebookId: 'notebook-1', generation: 1 }
    if (path.endsWith('/navigation')) return { tree: { root: { ...tree.root, children: [node] } }, notebookId: 'notebook-1', generation: 1 }
    if (path.endsWith('/site/list')) return { sites: [] }
    if (path.endsWith('/show-in-finder')) throw new Error('Finder could not open this folder.')
    return {}
  })
  render(<MemoryRouter initialEntries={['/']}><NotebookShell><ChildFrame /></NotebookShell></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Source' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Show in Finder' }))
  await waitFor(() => expect(mocks.coreRequestJson).toHaveBeenCalledWith('/_hypercanvas/system/show-in-finder', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ path: 'Design/Source.' + type }),
  })))
  expect(await screen.findByRole('alert')).toHaveTextContent('Finder could not open this folder.')
})

it('clears shell layout insets while chrome is hidden without remounting content or changing sidebar preference', async () => {
  setup()
  const frame = await screen.findByTitle('authored child frame')
  await waitFor(() => expect(document.documentElement.dataset.notebookSidebarOpen).toBe('true'))
  const mounted = mocks.mounted
  document.documentElement.classList.add('storyboard-chrome-hidden')
  await waitFor(() => expect(document.documentElement.dataset.notebookSidebarOpen).toBe('false'))
  expect(screen.getByTitle('authored child frame')).toBe(frame)
  expect(mocks.mounted).toBe(mounted)
  document.documentElement.classList.remove('storyboard-chrome-hidden')
  await waitFor(() => expect(document.documentElement.dataset.notebookSidebarOpen).toBe('true'))
  expect(screen.getByTitle('authored child frame')).toBe(frame)
})


it('hides notebook chrome and recovery events across removed-mode navigation without remounting authored content', async () => {
  setup()
  const frame = await screen.findByTitle('authored child frame')
  await screen.findByLabelText('Notebook pages')
  const mounted = mocks.mounted
  const sidebarPreference = localStorage.getItem('hypercanvas:notebook:notebook-1:sidebar')
  act(() => { window.history.replaceState(null, '', '/?removeUI&showTools#title=Keep'); applyHideUIFromUrl() })
  await waitFor(() => expect(screen.queryByLabelText('Notebook pages')).toBeNull())
  act(() => window.dispatchEvent(new CustomEvent('storyboard:toggle-notebook-sidebar')))
  act(() => window.dispatchEvent(new CustomEvent('storyboard:open-notebook-sidebar')))
  expect(screen.queryByLabelText('Notebook pages')).toBeNull()
  expect(screen.getByTitle('authored child frame')).toBe(frame)
  expect(mocks.mounted).toBe(mounted)
  expect(localStorage.getItem('hypercanvas:notebook:notebook-1:sidebar')).toBe(sidebarPreference)
  act(() => { window.history.replaceState(null, '', '/'); applyHideUIFromUrl() })
  await screen.findByLabelText('Notebook pages')
  expect(screen.getByTitle('authored child frame')).toBe(frame)
  expect(mocks.mounted).toBe(mounted)
})


async function setupBrowserLinks({ base = '/', defaults } = {}) {
  vi.stubEnv('BASE_URL', base)
  initConfig(validateConfig({ notebookBrowserLink: defaults }))
  window.history.replaceState(null, '', `${base}Demo/details?flow=empty%2Fstart&_sb_hide_branch_bar&_sb_theme_target=canvas&theme=dark#knob.title=Keep%20me`)
  const page = { id: 'demo', title: 'Demo', type: 'prototype', path: 'Demo.prototype', route: '/Demo', available: true }
  mocks.coreRequestJson.mockImplementation(async path => {
    if (path.endsWith('/pages')) return { title: 'Notebook', pages: [page], notebookId: 'notebook-1', generation: 1 }
    if (path.endsWith('/navigation')) return { navigation: null, tree, notebookId: 'notebook-1', generation: 1 }
    if (path.endsWith('/site/list')) return { sites: [] }
    return {}
  })
  browserRouter = createBrowserRouter([{ path: '*', element: <NotebookShell><ChildFrame /></NotebookShell> }], { basename: base })
  render(<RouterProvider router={browserRouter} />)
  await screen.findByRole('button', { name: 'Open in browser', exact: true })
  return userEvent.setup()
}

it('starts with one hidden choice and an independent unchecked tools option, without launching or changing authored content', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  const user = await setupBrowserLinks()
  const href = window.location.href
  const frame = screen.getByTitle('authored child frame')
  const mounted = mocks.mounted
  const storageKeys = Object.keys(localStorage)
  const trigger = screen.getByRole('button', { name: 'Browser viewing options' })
  await user.click(trigger)
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
  expect(screen.getAllByRole('menuitemradio').filter(item => item.getAttribute('aria-checked') === 'true').map(item => item.textContent)).toEqual(['Hidden'])
  const checkbox = screen.getByRole('menuitemcheckbox', { name: 'Show tools in any link' })
  expect(checkbox).toHaveAttribute('aria-checked', 'false')
  await user.click(screen.getByRole('menuitemradio', { name: 'Removed' }))
  await user.click(checkbox)
  expect(screen.getByRole('menuitemradio', { name: 'Removed' })).toHaveAttribute('aria-checked', 'true')
  expect(checkbox).toHaveAttribute('aria-checked', 'true')
  await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))
  expect(open).not.toHaveBeenCalled()
  expect(window.location.href).toBe(href)
  expect(Object.keys(localStorage)).toEqual(storageKeys)
  expect(screen.getByTitle('authored child frame')).toBe(frame)
  expect(mocks.mounted).toBe(mounted)
  await user.keyboard('{Escape}')
  await waitFor(() => expect(trigger).toHaveFocus())
})

it.each(['/', '/branch--review/'])('launches every selected mode/tool combination through the shared builder at %s', async base => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  const user = await setupBrowserLinks({ base })
  for (const [mode, label] of [['visible', 'Shown'], ['hidden', 'Hidden'], ['removed', 'Removed']]) {
    for (const showTools of [false, true]) {
      const priorLaunches = open.mock.calls.length
      await user.click(screen.getByRole('button', { name: 'Browser viewing options' }))
      await user.click(await screen.findByRole('menuitemradio', { name: label }))
      const checkbox = screen.getByRole('menuitemcheckbox', { name: 'Show tools in any link' })
      if ((checkbox.getAttribute('aria-checked') === 'true') !== showTools) await user.click(checkbox)
      expect(screen.getAllByRole('menuitemradio').filter(item => item.getAttribute('aria-checked') === 'true').map(item => item.textContent)).toEqual([label])
      await user.keyboard('{Escape}')
      expect(open.mock.calls.length).toBe(priorLaunches)
      await user.click(screen.getByRole('button', { name: 'Open in browser', exact: true }))
      expect(open.mock.calls.length).toBe(priorLaunches + 1)
      const [href, target, features] = open.mock.lastCall
      const url = new URL(href)
      expect(target).toBe('_blank')
      expect(features).toBe('noopener,noreferrer')
      expect(url.pathname).toBe(`${base}Demo/details`)
      expect(url.hash).toBe('#knob.title=Keep%20me')
      expect(url.searchParams.get('flow')).toBe('empty/start')
      expect(url.searchParams.get('theme')).toBe('dark')
      expect(url.searchParams.has('hideUI')).toBe(mode === 'hidden')
      expect(url.searchParams.has('removeUI')).toBe(mode === 'removed')
      expect(url.searchParams.has('showTools')).toBe(showTools)
      for (const key of ['showUI', '_sb_embed', '_sb_component_view', '_sb_hide_branch_bar', '_sb_theme_target', '_sb_canvas_theme', 'sb_knobs']) expect(url.searchParams.has(key)).toBe(false)
    }
  }
})

it('supports keyboard selection and launches the latest route without resetting options', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  const user = await setupBrowserLinks()
  const trigger = screen.getByRole('button', { name: 'Browser viewing options' })
  act(() => trigger.focus())
  await user.keyboard('{ArrowDown}')
  const removed = await screen.findByRole('menuitemradio', { name: 'Removed' })
  act(() => removed.focus())
  await user.keyboard('{Enter}')
  expect(removed).toHaveAttribute('aria-checked', 'true')
  const tools = screen.getByRole('menuitemcheckbox', { name: 'Show tools in any link' })
  act(() => tools.focus())
  await user.keyboard(' ')
  expect(tools).toHaveAttribute('aria-checked', 'true')
  expect(open).not.toHaveBeenCalled()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(trigger).toHaveFocus())
  const frame = screen.getByTitle('authored child frame')
  await act(async () => { await browserRouter.navigate('/Demo/next?flow=done#knob.title=Latest') })
  expect(screen.getByTitle('authored child frame')).toBe(frame)
  await user.click(screen.getByRole('button', { name: 'Open in browser', exact: true }))
  const url = new URL(open.mock.lastCall[0])
  expect(url.pathname).toBe('/Demo/next')
  expect(url.searchParams.get('flow')).toBe('done')
  expect(url.searchParams.has('removeUI')).toBe(true)
  expect(url.searchParams.has('showTools')).toBe(true)
  expect(url.hash).toBe('#knob.title=Latest')
})

it.each([
  [{ mode: 'visible', showTools: true }, 'Shown', true],
  [{ mode: 'removed', showTools: true }, 'Removed', true],
  [{ mode: 'invalid', showTools: 'yes' }, 'Hidden', false],
])('uses validated JSON defaults %j without hiding the current plain URL', async (defaults, label, showTools) => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  const user = await setupBrowserLinks({ defaults })
  expect(screen.getByLabelText('Notebook pages')).toBeInTheDocument()
  expect(new URLSearchParams(window.location.search).has('hideUI')).toBe(false)
  expect(new URLSearchParams(window.location.search).has('removeUI')).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Browser viewing options' }))
  expect(await screen.findByRole('menuitemradio', { name: label })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('menuitemcheckbox', { name: 'Show tools in any link' })).toHaveAttribute('aria-checked', String(showTools))
  expect(open).not.toHaveBeenCalled()
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Open in browser', exact: true }))
  const opened = new URL(open.mock.lastCall[0])
  expect(opened.searchParams.has('hideUI')).toBe(label === 'Hidden')
  expect(opened.searchParams.has('removeUI')).toBe(label === 'Removed')
  expect(opened.searchParams.has('showTools')).toBe(showTools)
})

it('removes the open browser-options portal with notebook chrome while preserving the authored frame', async () => {
  const user = await setupBrowserLinks()
  const frame = screen.getByTitle('authored child frame')
  const mounted = mocks.mounted
  await user.click(screen.getByRole('button', { name: 'Browser viewing options' }))
  await screen.findByRole('menuitemradio', { name: 'Hidden' })
  act(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('removeUI', '')
    window.history.replaceState(window.history.state, '', url)
    applyHideUIFromUrl()
  })
  await waitFor(() => expect(screen.queryByRole('menuitemradio')).toBeNull())
  expect(screen.queryByRole('button', { name: 'Browser viewing options' })).toBeNull()
  expect(screen.getByTitle('authored child frame')).toBe(frame)
  expect(mocks.mounted).toBe(mounted)
})
