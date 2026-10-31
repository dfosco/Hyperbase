import { useRef, useState } from 'react'
import { coreRequestJson, selectNotebookDirectory } from '../../core/notebook/browserBridge.js'
import { Button } from '../chrome/ui/button.jsx'
import css from './DirectoryPicker.module.css'

export function directoryName(directory) {
  return String(directory || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || ''
}

export async function validateDirectory(directory, { excludeSiteId, allowExistingNotebook = false } = {}) {
  const [notebookData, siteData] = await Promise.all([
    coreRequestJson('/_hypercanvas/notebook-runtime/recent'),
    coreRequestJson('/_hypercanvas/site/list'),
  ])
  const normalize = path => String(path || '').replace(/[\\/]+$/, '').toLowerCase()
  if (!allowExistingNotebook && notebookData?.notebooks?.some(item => item.available !== false && normalize(item.root) === normalize(directory))) {
    throw new Error('This folder is already registered as a Notebook.')
  }
  if (siteData?.sites?.some(site => site.id !== excludeSiteId && normalize(site.binding?.root) === normalize(directory))) {
    throw new Error('This folder is already registered as a Site.')
  }
}

/** Select a native directory and check registrations before exposing its path. */
export default function DirectoryPicker({ value, onChange, onError, label = 'Select folder', excludeSiteId, grantPurpose = 'notebook', allowExistingNotebook = false }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  async function select() {
    if (busyRef.current) return
    busyRef.current = true
    setError('')
    setBusy(true)
    try {
      const directory = await selectNotebookDirectory({ purpose: grantPurpose })
      if (!directory) return
      await validateDirectory(directory, { excludeSiteId, allowExistingNotebook })
      onChange(directory)
    } catch (cause) {
      const message = cause?.message || String(cause)
      setError(onError ? '' : message)
      onError?.(message)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className={css.picker}>
      <Button type="button" variant="outline" size="sm" onClick={select} disabled={busy}>{busy ? 'Selecting…' : label}</Button>
      {value && <span title={value}>{directoryName(value)}</span>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
