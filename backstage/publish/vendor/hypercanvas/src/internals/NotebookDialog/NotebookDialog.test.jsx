import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const bridge = vi.hoisted(() => ({ request: vi.fn(), open: vi.fn(), create: vi.fn(), pick: vi.fn() }))
vi.mock('../../core/notebook/browserBridge.js', () => ({
  coreRequestJson: bridge.request,
  openNotebookPath: bridge.open,
  createNotebookPath: bridge.create,
  selectNotebookDirectory: bridge.pick,
}))
vi.mock('../hooks/useFeatureFlag.js', () => ({ useFeatureFlag: () => false }))

import NotebookDialog from './NotebookDialog.jsx'

afterEach(() => vi.clearAllMocks())

describe('NotebookDialog switcher and selection', () => {
  it('shows the current Notebook when it is missing from recent history', async () => {
    const onOpenChange = vi.fn()
    bridge.request.mockImplementation(url => String(url).endsWith('/recent')
      ? Promise.resolve({ notebooks: [] })
      : Promise.resolve({ active: true, root: '/work/current', notebook: { manifest: { title: 'Current' } } }))
    render(<NotebookDialog open onOpenChange={onOpenChange} />)

    const current = await screen.findByRole('button', { name: 'Current Notebook: Current, /work/current' })
    expect(screen.getByText('/work/current')).toBeTruthy()
    expect(screen.getAllByText('Current')).toHaveLength(2)
    fireEvent.click(current)

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(bridge.open).not.toHaveBeenCalled()
  })

  it('shows the current Notebook as soon as status resolves while recent history is slow', async () => {
    let resolveRecent
    bridge.request.mockImplementation(url => String(url).endsWith('/recent')
      ? new Promise(resolve => { resolveRecent = resolve })
      : Promise.resolve({ active: true, root: '/work/current', notebook: { manifest: { title: 'Current' } } }))
    render(<NotebookDialog open onOpenChange={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Current Notebook: Current, /work/current' })).toBeTruthy()
    resolveRecent({ notebooks: [] })
  })

  it('forgets only the recent entry and keeps a forgotten current Notebook visible', async () => {
    bridge.request.mockImplementation(url => {
      const endpoint = String(url)
      if (endpoint.endsWith('/recent')) return Promise.resolve({ notebooks: [
        { root: '/work/current', title: 'Demo', available: true },
        { root: '/work/other', title: 'Demo', available: true },
      ] })
      if (endpoint.endsWith('/status')) return Promise.resolve({ active: true, root: '/work/current', notebook: { manifest: { title: 'Demo' } } })
      if (endpoint.endsWith('/forget')) return Promise.resolve({ forgotten: true })
      return Promise.resolve({})
    })
    render(<NotebookDialog open onOpenChange={() => {}} />)
    await screen.findByRole('button', { name: 'Current Notebook: Demo, /work/current' })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Demo at /work/current from recent Notebooks' }))

    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith('/_hypercanvas/notebook-runtime/forget', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ root: '/work/current' }),
    })))
    expect(await screen.findByRole('button', { name: 'Current Notebook: Demo, /work/current' })).toBeTruthy()
    expect(screen.getAllByText('Demo')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Remove Demo at /work/current from recent Notebooks' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove Demo at /work/other from recent Notebooks' })).toBeTruthy()
  })

  it('titles the dialog, drops the eyebrow and offers Select and Create notebook', async () => {
    bridge.request.mockResolvedValue({ notebooks: [] })
    render(<NotebookDialog open title="Select Notebook" dismissible={false} onOpenChange={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Select Notebook' })).toBeTruthy()
    expect(screen.getByText('Select a notebook or create a new one')).toBeTruthy()
    expect(screen.queryByText('Notebook', { selector: 'p' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    const buttons = screen.getAllByRole('button').map(button => button.textContent)
    expect(buttons.indexOf('Select notebook')).toBeLessThan(buttons.indexOf('Create notebook'))
    expect(screen.queryByRole('button', { name: 'Add notebook' })).toBeNull()
  })

  it('opens a folder from a single system picker selection', async () => {
    const onOpenChange = vi.fn()
    bridge.pick.mockResolvedValue('/work/existing')
    bridge.open.mockResolvedValue({ active: true, root: '/work/existing' })
    bridge.request.mockImplementation(url => String(url).includes('/recent')
      ? Promise.resolve({ notebooks: [] })
      : Promise.resolve({ sites: [] }))
    render(<NotebookDialog open onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select notebook' }))

    await waitFor(() => expect(bridge.open).toHaveBeenCalledWith('/work/existing'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('scaffolds a blank notebook in the folder chosen through the system picker', async () => {
    const onOpenChange = vi.fn()
    bridge.pick.mockResolvedValue('/work/fresh')
    bridge.create.mockResolvedValue({ active: true, root: '/work/fresh' })
    bridge.request.mockImplementation(url => String(url).includes('/recent')
      ? Promise.resolve({ notebooks: [] })
      : Promise.resolve({ sites: [] }))
    render(<NotebookDialog open onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create notebook' }))

    await waitFor(() => expect(bridge.create).toHaveBeenCalledWith('/work/fresh', 'fresh'))
    expect(bridge.open).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows an error when the selected folder cannot be used', async () => {
    bridge.pick.mockResolvedValue('/work/empty')
    bridge.open.mockRejectedValue(new Error('Notebook must be valid before it can become active.'))
    bridge.request.mockImplementation(url => String(url).includes('/recent')
      ? Promise.resolve({ notebooks: [] })
      : Promise.resolve({ sites: [] }))
    render(<NotebookDialog open onOpenChange={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Select notebook' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Notebook must be valid')
  })
})
