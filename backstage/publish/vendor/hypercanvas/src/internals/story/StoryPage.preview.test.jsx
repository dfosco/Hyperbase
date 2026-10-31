import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const storyData = vi.hoisted(() => ({ value: null }))

vi.mock('../../core/data/loader.js', () => ({ getStoryData: () => storyData.value }))
vi.mock('../loadConsumerWrapper.js', () => ({ getStoryWrapper: () => ({ children }) => children }))

import StoryPage from './StoryPage.jsx'

function mountStory({ route = '/components/demo?export=Default&_sb_embed&_sb_preview_token=token-1&_sb_preview_hash=hash-1', name = 'demo' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes><Route path="/components/:name" element={<StoryPage name={name} />} /></Routes>
    </MemoryRouter>,
  )
}

function previewMessages() {
  const postMessage = vi.fn()
  vi.stubGlobal('parent', { postMessage })
  Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage } })
  return postMessage
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  storyData.value = null
})

describe('StoryPage preview result handshake', () => {
  it('renders the named export at the canonical component route', async () => {
    function Compact() { return <p>compact widget rendered</p> }
    storyData.value = { _storyImport: async () => ({ Default: () => <p>default</p>, Compact }) }

    const result = mountStory({ route: '/components/ProfileWidget?export=Compact&_sb_embed', name: 'ProfileWidget' })

    await waitFor(() => expect(result.getByText('compact widget rendered')).toBeTruthy())
    expect(result.queryByText('default')).toBeNull()
  })

  it('reports ready only after the selected story component mounts', async () => {
    function Preview() { return <p>rendered preview</p> }
    storyData.value = { _storyImport: async () => ({ Default: Preview }) }
    const postMessage = previewMessages()

    mountStory()

    await waitFor(() => expect(postMessage).toHaveBeenCalledOnce())
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'hypercanvas:story-preview-result', token: 'token-1', storyId: 'demo',
      exportName: 'Default', sourceHash: 'hash-1', status: 'ready', phase: 'render',
    }), window.location.origin)
  })

  it('reports a component render exception to the preview owner', async () => {
    function BrokenPreview() { throw new Error('component crashed') }
    storyData.value = { _storyImport: async () => ({ Default: BrokenPreview }) }
    const postMessage = previewMessages()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mountStory()

    await waitFor(() => expect(postMessage).toHaveBeenCalledOnce())
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      token: 'token-1', status: 'failed', phase: 'render', error: 'component crashed', sourceHash: 'hash-1',
    }), window.location.origin)
  })

  it('does not report ready when a component effect fails during mount', async () => {
    function BrokenEffect() {
      useEffect(() => { throw new Error('effect crashed') }, [])
      return <p>mounted</p>
    }
    storyData.value = { _storyImport: async () => ({ Default: BrokenEffect }) }
    const postMessage = previewMessages()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mountStory()

    await waitFor(() => expect(postMessage).toHaveBeenCalled())
    expect(postMessage.mock.calls.map(([message]) => message.status)).toEqual(['failed'])
    expect(postMessage.mock.calls[0][0]).toMatchObject({
      token: 'token-1', status: 'failed', phase: 'render', error: 'effect crashed', sourceHash: 'hash-1',
    })
  })

  it('reports story import errors instead of leaving the probe to time out', async () => {
    storyData.value = { _storyImport: async () => { throw new Error('syntax failure') } }
    const postMessage = previewMessages()

    mountStory()

    await waitFor(() => expect(postMessage).toHaveBeenCalledOnce())
    expect(postMessage.mock.calls[0][0]).toMatchObject({ status: 'failed', phase: 'import', error: 'Failed to load story "demo": syntax failure' })
  })
})
