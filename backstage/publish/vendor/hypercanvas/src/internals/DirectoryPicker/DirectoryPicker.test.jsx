import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { validateDirectory } from './DirectoryPicker.jsx'
import { invoke } from '../../core/notebook/tauri-bridge.js'
import DirectoryPicker from './DirectoryPicker.jsx'

vi.mock('../../core/notebook/tauri-bridge.js', () => ({ invoke: vi.fn(), isTauriAvailable: () => true }))
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

it('rejects both Notebook and Site directory registrations', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => String(url).includes('notebook-runtime/recent')
    ? { ok: true, json: async () => ({ notebooks: [{ root: '/projects/notebook' }] }) }
    : { ok: true, json: async () => ({ sites: [{ id: 'site', binding: { root: '/projects/site' } }] }) }))
  await expect(validateDirectory('/projects/notebook/')).rejects.toThrow('Notebook')
  await expect(validateDirectory('/projects/site')).rejects.toThrow('Site')
  await expect(validateDirectory('/projects/site', { excludeSiteId: 'site' })).resolves.toBeUndefined()
})

it('uses the Core/FS bridge directory picker and validates the chosen path', async () => {
  vi.mocked(invoke).mockResolvedValue('/projects/new-notebook')
  vi.stubGlobal('fetch', vi.fn(async url => String(url).includes('notebook-runtime/recent')
    ? { ok: true, json: async () => ({ notebooks: [] }) }
    : { ok: true, json: async () => ({ sites: [] }) }))
  const onChange = vi.fn()
  render(<DirectoryPicker onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select folder' }))
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('/projects/new-notebook'))
  expect(invoke).toHaveBeenCalledWith('pick_notebook_folder')
})

it('allows a missing recent Notebook folder to be selected again for recovery', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => String(url).includes('notebook-runtime/recent')
    ? { ok: true, json: async () => ({ notebooks: [{ root: '/projects/restored', available: false }] }) }
    : { ok: true, json: async () => ({ sites: [] }) }))
  await expect(validateDirectory('/projects/restored')).resolves.toBeUndefined()
})

it('reuses an already registered Notebook folder when Notebook selection allows it', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => String(url).includes('notebook-runtime/recent')
    ? { ok: true, json: async () => ({ notebooks: [{ root: '/projects/existing' }] }) }
    : { ok: true, json: async () => ({ sites: [] }) }))
  await expect(validateDirectory('/projects/existing', { allowExistingNotebook: true })).resolves.toBeUndefined()
})

it('ignores cancel and blocks duplicate native picker submissions while busy', async () => {
  let finish
  vi.mocked(invoke).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const onChange = vi.fn()
  const { container } = render(<DirectoryPicker onChange={onChange} />)
  const button = screen.getByRole('button', { name: 'Select folder' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(invoke).toHaveBeenCalledTimes(1)
  finish(null)
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Select folder' }).disabled).toBe(false))
  expect(onChange).not.toHaveBeenCalled()
  expect(container.querySelector('[role="alert"]')).toBeNull()
})
