/** Optional, read-only Git context for the active Notebook sidebar. */
import { useEffect, useState } from 'react'
import GitBranchIcon from '../lucide/icons/git-branch.js'
import { useNotebookBranch } from './useBranches.js'
import { getFlag } from '../../core/stores/featureFlags.js'
import { subscribeToStorage } from '../../core/session/localStorage.js'
import { isMenuHidden } from '../../core/stores/uiConfig.js'
import css from './BranchBar.module.css'

export default function BranchBar({ notebookId, generation }) {
  const [, setRevision] = useState(0)
  useEffect(() => subscribeToStorage(() => setRevision(value => value + 1)), [])
  const params = new URLSearchParams(window.location.search)
  const enabled = getFlag('notebook-branch-banner') && !isMenuHidden('branch-bar')
    && !params.has('_sb_embed') && !params.has('_sb_hide_branch_bar')
    && !globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__
  const state = useNotebookBranch({ enabled, notebookId, generation })
  if (!enabled) return null

  let label = 'Reading Notebook branch…'
  if (state.status === 'empty') label = 'No Notebook selected'
  else if (state.status === 'error') label = 'Git status unavailable'
  else if (state.status === 'ready') {
    label = !state.isRepository ? 'Not a Git repository'
      : state.detached ? `Detached HEAD · ${state.commit?.slice(0, 7) || 'unknown commit'}`
        : state.branch || 'Branch unavailable'
  }
  return <div className={css.bar} role="status" aria-label="Notebook Git branch"
    data-notebook-branch-banner="" data-branch-state={state.status} title={state.error || label}>
    <GitBranchIcon size={14} aria-hidden="true" />
    <span className={css.barBranchName}>{label}</span>
  </div>
}
