import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const openNotebook = vi.fn()

vi.mock('../core/notebook/tauri-bridge.js', () => ({
  invoke: vi.fn(),
  isTauriAvailable: () => true,
  listen: vi.fn(() => Promise.resolve(() => {})),
}))

vi.mock('./NotebookDialog/NotebookDialog.jsx', () => ({
  default: ({ open, title, dismissible }) => (open ? <div role="dialog" aria-label={title} data-dismissible={String(dismissible)} /> : null),
}))

import NotebookGate from './NotebookGate/NotebookGate.jsx'
import { invoke } from '../core/notebook/tauri-bridge.js'

const notebooks = [
  { name: 'Demo', path: '/tmp/demo' },
  { name: 'Other', path: '/tmp/other' },
]

function statusResponse(status) {
  return { ok: true, json: () => Promise.resolve(status) }
}

function mockStatus(status) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(statusResponse(status))))
}

describe('NotebookGate', () => {
  beforeEach(() => {
    vi.stubGlobal('__HYPERCANVAS_OPEN_NOTEBOOK__', openNotebook)
    invoke.mockImplementation(command => {
      if (command === 'list_notebooks') return Promise.resolve(notebooks.map(n => ({ ...n })))
      if (command === 'remember_notebook') return Promise.resolve(notebooks.map(n => ({ ...n })))
      return Promise.resolve([])
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('stays hidden while the active notebook is available', async () => {
    mockStatus({ active: true, root: '/tmp/demo', availability: { available: true } })
    render(<NotebookGate />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the uncloseable Select Notebook dialog with a banner when the folder is removed or renamed', async () => {
    mockStatus({ active: true, root: '/tmp/demo', availability: { available: false, reason: 'missing' } })
    render(<NotebookGate />)

    const banner = await screen.findByRole('status')
    expect(banner.textContent).toContain('was removed or renamed')

    const dialog = screen.getByRole('dialog', { name: 'Select Notebook' })
    expect(dialog.getAttribute('data-dismissible')).toBe('false')
  })

  it('reports a tracked move and offers to reopen the notebook at its new path', async () => {
    const user = userEvent.setup()
    openNotebook.mockResolvedValue({})
    mockStatus({
      active: true,
      root: '/tmp/demo',
      availability: { available: false, reason: 'moved', movedTo: '/tmp/renamed' },
    })
    render(<NotebookGate />)

    const banner = await screen.findByRole('status')
    expect(banner.textContent).toContain('was moved or renamed')
    expect(banner.textContent).toContain('/tmp/renamed')

    await user.click(screen.getByRole('button', { name: /Open “renamed”/ }))
    await waitFor(() => expect(openNotebook).toHaveBeenCalledWith('/tmp/renamed'))
  })

  it('opens the Select Notebook dialog without a banner when the app starts with no notebook', async () => {
    mockStatus({ active: false, root: null, notice: null })
    render(<NotebookGate />)

    expect(await screen.findByRole('dialog', { name: 'Select Notebook' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the runtime notice in the banner when reopening without the last notebook', async () => {
    mockStatus({
      active: false,
      root: null,
      notice: 'The previously opened Notebook folder was removed or renamed: /tmp/demo.',
    })
    render(<NotebookGate />)

    const banner = await screen.findByRole('status')
    expect(banner.textContent).toContain('removed or renamed: /tmp/demo')
  })

  it('hides its notebook recovery dialog during Core disconnect and restores it after reconnect', async () => {
    mockStatus({ active: false, root: null, notice: null })
    render(<NotebookGate />)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'disconnected' } })))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'connecting' } })))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => window.dispatchEvent(new CustomEvent('storyboard:core-connection', { detail: { state: 'connected' } })))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hides its recovery dialog during Notebook handoff and restores it when opening fails', async () => {
    mockStatus({ active: false, root: null, notice: null })
    render(<NotebookGate />)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    act(() => window.dispatchEvent(new CustomEvent('storyboard:notebook-switch', { detail: { state: 'started' } })))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => window.dispatchEvent(new CustomEvent('storyboard:notebook-switch', { detail: { state: 'failed' } })))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
