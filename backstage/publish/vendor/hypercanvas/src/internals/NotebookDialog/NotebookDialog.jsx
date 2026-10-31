import { useCallback, useEffect, useRef, useState } from 'react'
import MinusIcon from '../lucide/icons/minus.js'
import XIcon from '../lucide/icons/x.js'
import { validateDirectory } from '../DirectoryPicker/DirectoryPicker.jsx'
import { coreRequestJson, createNotebookPath, openNotebookPath, selectNotebookDirectory } from '../../core/notebook/browserBridge.js'
import errorMessage from './errorMessage.js'
import { mergeNotebookEntries, notebookRootKey } from './notebookSwitcherState.js'
import css from './NotebookDialog.module.css'

function devlog(message, details = {}) {
  console.debug('[devlog][NotebookDialog]', message, details)
}

function folderName(folderPath) {
  return String(folderPath || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || 'Notebook'
}

/**
 * Notebook switcher: pick a recent Notebook, select an existing folder, or
 * scaffold a blank Notebook in a folder. Both folder actions open the system
 * folder picker directly. Pass `dismissible={false}` for a blocking screen.
 */
export default function NotebookDialog({ open, onOpenChange, title = 'Switch notebook', dismissible = true }) {
  const closeRef = useRef(null)
  const pickerBusyRef = useRef(false)
  const [notebooks, setNotebooks] = useState([])
  const [switcherError, setSwitcherError] = useState(null)
  const [switcherLoading, setSwitcherLoading] = useState(false)
  const [currentNotebookStatus, setCurrentNotebookStatus] = useState(null)
  const [openingPath, setOpeningPath] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const closeDialog = useCallback(() => {
    setActionError(null)
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return undefined
    closeRef.current?.focus()
    const handleKeyDown = event => {
      if (dismissible && event.key === 'Escape') closeDialog()
    }
    const handleOpened = () => closeDialog()
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('storyboard:notebook-opened', handleOpened)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('storyboard:notebook-opened', handleOpened)
    }
  }, [open, closeDialog, dismissible])

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    setSwitcherLoading(true)
    setSwitcherError(null)
    let recentEntries = []
    let status = null
    let recentFailure = null
    let statusFailure = null
    const update = () => {
      if (controller.signal.aborted) return
      setCurrentNotebookStatus(status)
      setNotebooks(mergeNotebookEntries(recentEntries, status))
      const failure = recentFailure || statusFailure
      setSwitcherError(failure?.message || (failure ? 'Could not load recent Notebooks.' : null))
    }
    const recentRequest = coreRequestJson('/_hypercanvas/notebook-runtime/recent', { cache: 'no-store', signal: controller.signal })
      .then(data => { recentEntries = Array.isArray(data?.notebooks) ? data.notebooks : []; update() })
      .catch(failure => { recentFailure = failure; update() })
    const statusRequest = coreRequestJson('/_hypercanvas/notebook-runtime/status', { cache: 'no-store', signal: controller.signal })
      .then(value => { status = value; update() })
      .catch(failure => { statusFailure = failure; update() })
    Promise.allSettled([recentRequest, statusRequest]).finally(() => {
      if (!controller.signal.aborted) setSwitcherLoading(false)
    })
    return () => controller.abort()
  }, [open])

  if (!open) return null

  async function switchNotebook(notebook) {
    if (!notebook?.path || notebook.available === false) return
    if (notebook.current) {
      closeDialog()
      return
    }
    setOpeningPath(notebook.path)
    setSwitcherError(null)
    try {
      await openNotebookPath(notebook.path)
      closeDialog()
    } catch (failure) {
      setSwitcherError(failure?.message || 'The Notebook could not be opened.')
    } finally {
      setOpeningPath(null)
    }
  }

  async function forgetNotebook(notebook) {
    if (!notebook?.path || !notebook.recent) return
    try {
      await coreRequestJson('/_hypercanvas/notebook-runtime/forget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: notebook.path }),
      })
      setNotebooks(entries => entries.flatMap(entry => notebookRootKey(entry.path) !== notebookRootKey(notebook.path)
        ? [entry]
        : entry.current ? [{ ...entry, recent: false }] : []))
      setSwitcherError(null)
    } catch (failure) {
      setSwitcherError(failure?.message || 'Could not remove this Notebook from recent history.')
    }
  }

  async function pickAndRun(action) {
    if (pickerBusyRef.current) return
    pickerBusyRef.current = true
    setBusy(true)
    setActionError(null)
    try {
      const folderPath = await selectNotebookDirectory()
      devlog('Core directory picker returned', { hasPath: Boolean(folderPath) })
      if (folderPath) await action(String(folderPath))
    } catch (failure) {
      devlog('notebook folder action failed', { name: failure?.name, message: failure?.message })
      setActionError(errorMessage(failure, 'The folder could not be used.'))
    } finally {
      pickerBusyRef.current = false
      setBusy(false)
    }
  }

  const selectNotebook = () => pickAndRun(async folderPath => {
    if (currentNotebookStatus?.active
      && notebookRootKey(folderPath) === notebookRootKey(currentNotebookStatus.root)) {
      closeDialog()
      return
    }
    await validateDirectory(folderPath, { allowExistingNotebook: true })
    await openNotebookPath(folderPath)
    closeDialog()
  })

  const createNotebook = () => pickAndRun(async folderPath => {
    await validateDirectory(folderPath)
    await createNotebookPath(folderPath, folderName(folderPath))
    closeDialog()
  })

  return (
    <div className={css.backdrop} role="presentation" onMouseDown={event => dismissible && event.target === event.currentTarget && closeDialog()}>
      <section className={css.dialog} role="dialog" aria-modal="true" aria-labelledby="notebook-switcher-title">
        <header className={css.header}>
          <div>
            <h2 id="notebook-switcher-title">{title}</h2>
            <p className={css.description}>Select a notebook or create a new one</p>
          </div>
          {dismissible && <button ref={closeRef} className={css.closeButton} type="button" aria-label="Close" onClick={closeDialog}>
            <XIcon size={18} />
          </button>}
        </header>
        <div className={css.notebookList}>
          {switcherLoading && notebooks.length === 0 && <p className={css.description}>Loading Notebooks…</p>}
          {!switcherLoading && notebooks.length === 0 && <p className={css.description}>{switcherError || 'No recent Notebooks yet.'}</p>}
          {notebooks.map(notebook => (
            <div key={notebookRootKey(notebook.path)} className={css.notebookRow}>
              <button
                className={css.notebookSelect}
                type="button"
                aria-label={`${notebook.current ? 'Current Notebook' : 'Open Notebook'}: ${notebook.name}, ${notebook.path}`}
                disabled={openingPath === notebook.path || notebook.available === false}
                onClick={() => switchNotebook(notebook)}
              >
                <span className={css.notebookDetails}>
                  <span className={css.notebookTitle}>{notebook.name}</span>
                  <span className={css.notebookPath} title={notebook.path}>{notebook.path}</span>
                </span>
                <span className={css.notebookStatus}>
                  {notebook.current && <span className={css.currentBadge}>Current</span>}
                  {notebook.available === false && <span>Folder missing</span>}
                  {openingPath === notebook.path && <span>Opening…</span>}
                </span>
              </button>
              {notebook.recent && <button
                className={css.removeNotebookButton}
                type="button"
                aria-label={`Remove ${notebook.name} at ${notebook.path} from recent Notebooks`}
                title="Remove from recent Notebooks"
                onClick={() => forgetNotebook(notebook)}
              ><MinusIcon size={16} /></button>}
            </div>
          ))}
        </div>
        {switcherError && notebooks.length > 0 && <p className={css.error} role="alert">{switcherError}</p>}
        {actionError && <p className={css.error} role="alert">{actionError}</p>}
        <footer className={css.footer}>
          <button className={css.primaryButton} type="button" disabled={busy} onClick={selectNotebook}>Select notebook</button>
          <button className={css.secondaryButton} type="button" disabled={busy} onClick={createNotebook}>Create notebook</button>
        </footer>
      </section>
    </div>
  )
}
