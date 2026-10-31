import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ flag: false, request: vi.fn(), storageChanged: null }))
vi.mock('../../core/stores/featureFlags.js', () => ({ getFlag: () => mocks.flag }))
vi.mock('../../core/session/localStorage.js', () => ({ subscribeToStorage: listener => { mocks.storageChanged = listener; return () => {} } }))
vi.mock('../../core/stores/uiConfig.js', () => ({ isMenuHidden: () => false }))
vi.mock('../../core/notebook/browserBridge.js', () => ({ coreRequestJson: mocks.request }))
import BranchBar from './BranchBar.jsx'

const metadata = (branch, notebookId = 'first', generation = 1) => ({ notebookId, generation, branch, isRepository: true, detached: false })

beforeEach(() => {
  mocks.flag = true
  mocks.request.mockReset().mockResolvedValue(metadata('notebook-branch'))
})
afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
  delete globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__
})

it('does not mount or query until the feature flag is enabled', async () => {
  mocks.flag = false
  render(<BranchBar notebookId="first" generation={1} />)
  expect(screen.queryByRole('status')).toBeNull()
  expect(mocks.request).not.toHaveBeenCalled()
  act(() => { mocks.flag = true; mocks.storageChanged() })
  expect(await screen.findByText('notebook-branch')).toBeTruthy()
  act(() => { mocks.flag = false; mocks.storageChanged() })
  expect(screen.queryByRole('status')).toBeNull()
})

it('renders the selected Notebook branch without a body portal or global bar', async () => {
  const { container } = render(<BranchBar notebookId="first" generation={1} />)
  const banner = await screen.findByRole('status', { name: 'Notebook Git branch' })
  await screen.findByText('notebook-branch')
  expect(container.contains(banner)).toBe(true)
  expect(document.querySelector('#sb-branch-bar-root, [data-branch-bar]')).toBeNull()
  expect(mocks.request.mock.calls[0][0]).toBe('/_hypercanvas/notebook/branch')
})

it('shows explicit non-Git and detached states', async () => {
  mocks.request.mockResolvedValueOnce({ ...metadata(null), isRepository: false })
  render(<BranchBar notebookId="first" generation={1} />)
  await screen.findByText('Not a Git repository')
  mocks.request.mockResolvedValueOnce({ ...metadata(null), detached: true, commit: 'abcdef123456789' })
  fireEvent.focus(window)
  await screen.findByText('Detached HEAD · abcdef1')
})

it('clears an old branch during Notebook switching and ignores its delayed response', async () => {
  let resolveOld
  mocks.request.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  const { rerender } = render(<BranchBar notebookId="first" generation={1} />)
  mocks.request.mockResolvedValueOnce(metadata('second-branch', 'second', 2))
  rerender(<BranchBar notebookId="second" generation={2} />)
  await screen.findByText('second-branch')
  await act(async () => { resolveOld(metadata('obsolete-branch')) })
  expect(screen.queryByText('obsolete-branch')).toBeNull()
  expect(screen.getByText('second-branch')).toBeTruthy()
})

it('clears errors on focus refresh and never treats them as a non-Git folder', async () => {
  mocks.request.mockRejectedValueOnce(new Error('Core disconnected'))
  render(<BranchBar notebookId="first" generation={1} />)
  await screen.findByText('Git status unavailable')
  expect(screen.queryByText('Not a Git repository')).toBeNull()
  fireEvent.focus(window)
  await screen.findByText('notebook-branch')
})

it('does not use metadata belonging to a different active Notebook', async () => {
  mocks.request.mockResolvedValueOnce(metadata('wrong-branch', 'other', 99))
  render(<BranchBar notebookId="first" generation={1} />)
  await waitFor(() => expect(mocks.request).toHaveBeenCalledOnce())
  expect(screen.queryByText('wrong-branch')).toBeNull()
  expect(screen.getByText('Reading Notebook branch…')).toBeTruthy()
})

it.each(['embedded', 'published'])('never queries live Git metadata in %s content', mode => {
  if (mode === 'embedded') window.history.replaceState({}, '', '/?_sb_embed')
  else globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ = { notebookId: 'published' }
  render(<BranchBar notebookId="first" generation={1} />)
  expect(screen.queryByRole('status')).toBeNull()
  expect(mocks.request).not.toHaveBeenCalled()
})
