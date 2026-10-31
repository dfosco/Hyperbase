import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'

vi.mock('../ArtifactForm/ArtifactForm.jsx', () => ({
  default: vi.fn(({ onSubmit }) => <button type="button" onClick={() => onSubmit({ type: 'canvas', values: { name: 'welcome', title: 'Welcome' } })}>Submit</button>),
  ARTIFACT_SCHEMAS: { canvas: { label: 'Canvas', description: '', fields: [{ name: 'name' }, { name: 'title' }, { name: 'folder' }] } },
  isFieldVisible: () => true,
}))

import ArtifactForm from '../ArtifactForm/ArtifactForm.jsx'
import CreateArtifactForm from './CreateArtifactForm.jsx'

afterEach(() => vi.unstubAllGlobals())

it('preserves the literal sidebar parentPath, including root, in the artifact create request', async () => {
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
  vi.stubGlobal('fetch', fetcher)
  render(<CreateArtifactForm type="canvas" basePath="/branch--demo/" initialValues={{ parentPath: '' }} />)
  fireEvent.click(document.querySelector('button'))
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  expect(fetcher.mock.calls[0][0]).toBe('/branch--demo/_hypercanvas/artifact/')
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ type: 'canvas', name: 'welcome', title: 'Welcome', parentPath: '' })
})

it('does not serialize a stale folder schema alias alongside parentPath', async () => {
  ArtifactForm.mockImplementation(({ onSubmit }) => <button type="button" onClick={() => onSubmit({ type: 'canvas', values: { name: 'welcome', title: 'Welcome', folder: '' } })}>Submit</button>)
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
  vi.stubGlobal('fetch', fetcher)
  render(<CreateArtifactForm type="canvas" initialValues={{ parentPath: 'One/Two' }} />)
  fireEvent.click(document.querySelector('button'))
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ type: 'canvas', name: 'welcome', title: 'Welcome', parentPath: 'One/Two' })
})
