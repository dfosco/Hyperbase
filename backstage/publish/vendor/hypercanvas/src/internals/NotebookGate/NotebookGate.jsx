import { useEffect, useRef, useState } from 'react'
import { isTauriAvailable } from '../../core/notebook/tauri-bridge.js'
import {
  coreRequestJson,
  hasPendingNotebookSwitch,
  NOTEBOOK_SWITCH_EVENT,
  openNotebookPath as openNotebookViaCore,
} from '../../core/notebook/browserBridge.js'
import { storyboardWs } from '../storyboard-ws.js'
import NotebookDialog from '../NotebookDialog/NotebookDialog.jsx'
import css from './NotebookGate.module.css'

const POLL_INTERVAL_MS = 2000

function folderName(root) {
  return String(root || '').split(/[\\/]/).filter(Boolean).pop() || 'Notebook'
}

/**
 * Blocking Notebook recovery and selection surface for the browser and desktop.
 *
 * When the active Notebook folder is removed, moved, or renamed — or when the
 * app starts with no Notebook pointer — this surface stays open until the user
 * selects an available Notebook or chooses a folder through Core.
 */
export default function NotebookGate() {
  const browserCoreMode = typeof window !== 'undefined' && window.__HYPERCANVAS_CORE_MODE__ === true
  const enabledRef = useRef(
    typeof window !== 'undefined'
      && import.meta.env.VITE_NOTEBOOK_PUBLISHED !== '1'
      && (isTauriAvailable() || browserCoreMode)
      && !new URLSearchParams(window.location.search).has('_sb_embed'),
  )
  const [gate, setGate] = useState(null)
  const [error, setError] = useState(null)
  const [openingPath, setOpeningPath] = useState(null)
  const [coreDisconnected, setCoreDisconnected] = useState(() => storyboardWs.connectionState() === 'disconnected')
  const [notebookSwitching, setNotebookSwitching] = useState(() => hasPendingNotebookSwitch())

  useEffect(() => {
    const onCoreConnection = event => {
      const state = event?.detail?.state
      if (state === 'disconnected') setCoreDisconnected(true)
      if (state === 'connected') {
        setCoreDisconnected(false)
        setError(null)
      }
    }
    const onNotebookSwitch = event => {
      const state = event?.detail?.state
      if (state === 'started') setNotebookSwitching(true)
      if (state === 'ready' || state === 'failed') setNotebookSwitching(false)
    }
    window.addEventListener('storyboard:core-connection', onCoreConnection)
    window.addEventListener(NOTEBOOK_SWITCH_EVENT, onNotebookSwitch)
    return () => {
      window.removeEventListener('storyboard:core-connection', onCoreConnection)
      window.removeEventListener(NOTEBOOK_SWITCH_EVENT, onNotebookSwitch)
    }
  }, [])

  useEffect(() => {
    if (!enabledRef.current) return undefined
    let cancelled = false
    const refresh = async () => {
      try {
        const status = await coreRequestJson('/_hypercanvas/notebook-runtime/status', { cache: 'no-store' })
        setError(null)
        const availability = status.availability || {}
        const next = status.active && availability.available !== false
          ? null
          : status.active
            ? {
                key: `unavailable:${availability.reason}:${availability.movedTo || ''}`,
                banner: availability.reason === 'moved' && availability.movedTo
                  ? `The notebook folder “${folderName(status.root)}” was moved or renamed. It looks like it now lives at ${availability.movedTo}.`
                  : `The notebook folder “${folderName(status.root)}” was removed or renamed.`,
                movedTo: availability.reason === 'moved' ? availability.movedTo : null,
                startedWithoutNotebook: false,
              }
            : {
                key: `no-notebook:${status.notice || ''}`,
                banner: status.notice || null,
                movedTo: null,
                startedWithoutNotebook: true,
              }
        setGate(current => (current?.key === next?.key ? current : next))
      } catch {
        if (cancelled) return
        setError('Could not connect to Hypercanvas. Check that the app is running, then refresh.')
        // setGate(current => current || {
        //   key: 'core-unavailable',
        //   banner: 'Hypercanvas Core is unavailable. Keep the app running while using this browser.',
        //   movedTo: null,
        //   startedWithoutNotebook: true,
        // })
      }
    }
    refresh()
    const timer = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [browserCoreMode])

  async function openNotebookPath(notebookPath) {
    if (!notebookPath) return
    setError(null)
    setOpeningPath(notebookPath)
    try {
      await openNotebookViaCore(notebookPath)
      setGate(null)
    } catch (failure) {
      setError(failure?.message || 'The Notebook could not be opened.')
    } finally {
      setOpeningPath(null)
    }
  }

  if (!enabledRef.current || !gate || coreDisconnected || notebookSwitching) return null

  return (
    <div className={css.backdrop} role="presentation">
      {gate.banner && (
        <div className={css.banner} role="status">{gate.banner}</div>
      )}
      {gate.movedTo && (
        <button
          type="button"
          className={css.primaryAction}
          disabled={openingPath === gate.movedTo}
          onClick={() => openNotebookPath(gate.movedTo)}
        >
          {openingPath === gate.movedTo ? 'Opening…' : `Open “${folderName(gate.movedTo)}”`}
        </button>
      )}
      {error && <p className={css.error} role="alert">{error}</p>}
      <NotebookDialog open onOpenChange={() => {}} title="Select Notebook" dismissible={false} />
    </div>
  )
}
