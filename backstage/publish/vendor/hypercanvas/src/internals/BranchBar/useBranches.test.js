import { renderHook, waitFor } from '@testing-library/react'
import { useBranches } from './useBranches.js'

describe('useBranches', () => {
  afterEach(() => {
    delete window.__SB_BRANCHES__
    delete globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__
    vi.unstubAllGlobals()
  })

  it('does not request Core APIs or a branch manifest for a static Notebook publication', async () => {
    globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ = true
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBranches('/branch--published/'))

    await waitFor(() => expect(result.current.currentBranch).toBe('published'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.branches).toBeNull()
  })

  it('keeps live worktree discovery available outside static Notebook publication', async () => {
    const liveBranches = [{ folder: 'branch--current', branch: 'current' }]
    const fetchMock = vi.fn((url) => {
      if (url === '/branch--current/_hypercanvas/worktrees') {
        return Promise.resolve({ ok: true, json: async () => liveBranches })
      }
      if (url === '/branch--current/_hypercanvas/git-user' || url === '/branch--current/_hypercanvas/current-branch') {
        return Promise.resolve({ ok: false, json: async () => null })
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBranches('/branch--current/'))

    await waitFor(() => expect(result.current.branches).toEqual(liveBranches))
    expect(fetchMock).toHaveBeenCalledWith('/branch--current/_hypercanvas/worktrees')
    expect(fetchMock).not.toHaveBeenCalledWith('/branches.json')
  })

  it('loads branches from branches.json when worktrees API is unavailable on branch deploys', async () => {
    const branchesFromManifest = [
      { folder: 'branch--4.3.0-prompt-widget', branch: '4.3.0-prompt-widget' },
      { folder: 'branch--main', branch: 'main' },
    ]

    const fetchMock = vi.fn((url) => {
      if (url === '/storyboard/branch--4.3.0-prompt-widget/_hypercanvas/git-user') {
        return Promise.resolve({ ok: false, json: async () => null })
      }
      if (url === '/storyboard/branch--4.3.0-prompt-widget/_hypercanvas/worktrees') {
        return Promise.resolve({ ok: false, json: async () => null })
      }
      if (url === '/storyboard/branches.json') {
        return Promise.resolve({ ok: true, json: async () => branchesFromManifest })
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`))
    })

    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBranches('/storyboard/branch--4.3.0-prompt-widget/'))

    await waitFor(() => {
      expect(result.current.branches).toEqual(branchesFromManifest)
    })

    expect(fetchMock).toHaveBeenCalledWith('/storyboard/branches.json')
  })

  it('resolves branches.json from repo root when basePath has no trailing slash', async () => {
    const branchesFromManifest = [
      { folder: 'branch--4.3.0-prompt-widget', branch: '4.3.0-prompt-widget' },
    ]

    const fetchMock = vi.fn((url) => {
      if (url === '/storyboard/branch--4.3.0-prompt-widget/_hypercanvas/git-user') {
        return Promise.resolve({ ok: false, json: async () => null })
      }
      if (url === '/storyboard/branch--4.3.0-prompt-widget/_hypercanvas/worktrees') {
        return Promise.resolve({ ok: false, json: async () => null })
      }
      if (url === '/storyboard/branches.json') {
        return Promise.resolve({ ok: true, json: async () => branchesFromManifest })
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`))
    })

    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBranches('/storyboard/branch--4.3.0-prompt-widget'))

    await waitFor(() => {
      expect(result.current.branches).toEqual(branchesFromManifest)
    })

    expect(fetchMock).toHaveBeenCalledWith('/storyboard/branches.json')
  })
})
