/**
 * useBranches — shared hook for branch data across BranchBar and BranchDropdown.
 * Fetches live branch list from /_hypercanvas/worktrees API on mount.
 */
import { useState, useEffect, useCallback } from 'react'
import { coreRequestJson } from '../../core/notebook/browserBridge.js'

/** Live Notebook metadata is independent of the application's worktree controls below. */
export function useNotebookBranch({ enabled, notebookId, generation }) {
  const scope = JSON.stringify([notebookId, generation])
  const [state, setState] = useState({ scope: null, status: 'loading' })
  useEffect(() => {
    if (!enabled || !notebookId) return undefined
    const controller = new AbortController()
    let pending = false
    const refresh = async () => {
      if (pending || controller.signal.aborted) return
      pending = true
      try {
        const data = await coreRequestJson('/_hypercanvas/notebook/branch', { cache: 'no-store', signal: controller.signal })
        if (controller.signal.aborted) return
        if (data.notebookId !== notebookId || data.generation !== generation) {
          setState({ scope, status: 'loading' })
        } else if (typeof data.isRepository !== 'boolean') {
          throw new Error('Invalid Notebook Git response.')
        } else {
          setState({ scope, status: 'ready', ...data })
        }
      } catch (error) {
        if (!controller.signal.aborted) setState({ scope, status: 'error', error: error.message || 'Could not read Notebook Git status.' })
      } finally { pending = false }
    }
    const visibleRefresh = () => { if (!document.hidden) void refresh() }
    void refresh()
    const timer = window.setInterval(visibleRefresh, 5000)
    window.addEventListener('focus', visibleRefresh)
    document.addEventListener('visibilitychange', visibleRefresh)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', visibleRefresh)
      document.removeEventListener('visibilitychange', visibleRefresh)
    }
  }, [enabled, notebookId, generation, scope])
  if (!notebookId) return { status: 'empty' }
  return state.scope === scope ? state : { status: 'loading' }
}

const isLocalDev = typeof window !== 'undefined' && window.__SB_LOCAL_DEV__ === true

export function useBranches(basePath) {
  const [branches, setBranches] = useState(() => {
    if (typeof window !== 'undefined' && Array.isArray(window.__SB_BRANCHES__)) {
      return window.__SB_BRANCHES__
    }
    return null
  })

  const [gitUser, setGitUser] = useState(null)
  const [currentBranch, setCurrentBranch] = useState(() => {
    if (typeof window !== 'undefined' && typeof window.__SB_CURRENT_BRANCH__ === 'string') {
      return window.__SB_CURRENT_BRANCH__
    }
    // Legacy fallback: parse /branch--<name>/ from BASE_URL (prod branch deploys).
    const m = (basePath || '').match(/\/branch--([^/]+)\/?$/)
    return m ? m[1] : 'main'
  })
  const branchBasePath = (basePath || '/').replace(/\/branch--[^/]*\/?$/, '/')

  useEffect(() => {
    // A published Notebook is an immutable, single-branch artifact. It has no
    // live repository APIs or branches.json manifest to query.
    if (globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ === true) return

    const apiBase = (basePath || '/').replace(/\/$/, '')
    const branchManifestUrl = `${branchBasePath.replace(/\/$/, '')}/branches.json`

    fetch(`${apiBase}/_hypercanvas/git-user`).then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.name) setGitUser(data.name) })
      .catch(() => {})

    // Source of truth for current branch in dev: ask the server (`git
    // branch --show-current`). Falls through to the SSR-injected
    // window.__SB_CURRENT_BRANCH__ or the URL-derived fallback.
    fetch(`${apiBase}/_hypercanvas/current-branch`).then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.branch) setCurrentBranch(data.branch) })
      .catch(() => {})

    // Keep dev behavior: prefer live branch list from server API.
    // On static deployments (GitHub Pages), fallback to branches.json.
    fetch(`${apiBase}/_hypercanvas/worktrees`).then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setBranches(data)
          return true
        }
        return false
      })
      .catch(() => false)
      .then((hasLiveData) => {
        if (hasLiveData || isLocalDev) return
        return fetch(branchManifestUrl)
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (Array.isArray(data) && data.length > 0) setBranches(data) })
          .catch(() => {})
      })
  }, [basePath, branchBasePath])

  return { branches, currentBranch, branchBasePath, gitUser }
}

export function useSwitchBranch(basePath, branchBasePath) {
  const [switching, setSwitching] = useState(null)
  const [switchError, setSwitchError] = useState(null)

  const switchBranch = useCallback(async (branch, folder, url) => {
    if (switching) return
    setSwitching(branch)
    setSwitchError(null)

    // Dev: target is already running on its own port — navigate directly.
    if (isLocalDev && url) {
      window.location.href = url
      return
    }

    // Prod / static deploy: branch builds share an origin under /branch--<name>/.
    if (!isLocalDev) {
      window.location.href = `${branchBasePath}${folder || (branch === 'main' ? '' : `branch--${branch}/`)}`
      return
    }

    // Dev fallback: ask the server to spawn a Vite for the requested worktree.
    const apiBase = (basePath || '/').replace(/\/$/, '')
    try {
      const res = await fetch(`${apiBase}/_hypercanvas/switch-branch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setSwitchError(data.error || `Failed to start "${branch}"`)
    } catch (e) {
      setSwitchError(e.message || 'Server not reachable')
    }
    setSwitching(null)
  }, [basePath, branchBasePath, switching])

  return { switching, switchError, switchBranch }
}
