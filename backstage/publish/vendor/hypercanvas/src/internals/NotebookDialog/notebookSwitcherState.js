export function notebookRootKey(root) {
  const normalized = String(root || '').replaceAll('\\', '/').replace(/\/+$/, '')
  return normalized || '/'
}

/** Keep history identity separate from the active binding so forgetting the
 * current entry cannot hide or unload the Notebook that is already open. */
export function mergeNotebookEntries(recent, status) {
  const entries = []
  const indexes = new Map()
  for (const entry of Array.isArray(recent) ? recent : []) {
    if (typeof entry?.root !== 'string' || !entry.root) continue
    const key = notebookRootKey(entry.root)
    if (indexes.has(key)) continue
    indexes.set(key, entries.length)
    entries.push({
      name: entry.title || entry.root.split(/[\\/]/).filter(Boolean).pop() || 'Notebook',
      path: entry.root,
      available: entry.available !== false,
      current: false,
      recent: true,
      lastOpened: entry.lastOpened || null,
    })
  }

  if (status?.active && typeof status.root === 'string' && status.root) {
    const key = notebookRootKey(status.root)
    const currentName = status.notebook?.manifest?.title
      || status.root.split(/[\\/]/).filter(Boolean).pop()
      || 'Notebook'
    const index = indexes.get(key)
    if (index !== undefined) {
      entries[index] = { ...entries[index], name: currentName, available: true, current: true }
    } else {
      entries.unshift({ name: currentName, path: status.root, available: true, current: true, recent: false, lastOpened: null })
    }
  }

  return entries
}
