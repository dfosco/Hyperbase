import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../chrome/ui/button.jsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../chrome/ui/dialog.jsx'
import { TreeIcon } from './TreeIcons.jsx'
import css from './NotebookSidebarTree.module.css'

function folderByPath(tree, path) {
  if (!path) return tree?.root || null
  const visit = nodes => {
    for (const node of nodes || []) {
      if (node.kind !== 'folder') continue
      if (node.path === path) return node
      const match = visit(node.children)
      if (match) return match
    }
    return null
  }
  return visit(tree?.root?.children)
}

function hasHiddenDirectory(path, hideDefaultSupport = false) {
  return (path || '').split('/').filter(Boolean).some(segment => segment.startsWith('_') || (hideDefaultSupport && ['backstage', 'publish'].includes(segment)))
}

function pruneHiddenSubtrees(tree) {
  if (!tree?.root) return tree
  // Canonical trees already applied their effective gitignore rules. An
  // explicit [] must survive; older/fallback trees still hide support folders.
  const hideDefaultSupport = !Array.isArray(tree.sidebarIgnored)
  const prune = nodes => (nodes || []).filter(node => {
    const hidden = node.kind === 'folder'
      ? node.name.startsWith('_') || hasHiddenDirectory(node.path, hideDefaultSupport) || hasHiddenDirectory(node.parentPath, hideDefaultSupport)
      : hasHiddenDirectory(node.path || node.parentPath, hideDefaultSupport)
    return !hidden
  }).map(node => node.kind === 'folder' ? { ...node, children: prune(node.children) } : node)
  return { ...tree, root: { ...tree.root, children: prune(tree.root.children) } }
}

function findArtifactPath(tree, pageId) {
  let found = null
  const visit = (nodes, ancestors) => {
    for (const node of nodes || []) {
      if (node.kind === 'folder') visit(node.children, [...ancestors, node])
      else if (node.pageId === pageId || node.id === pageId) found = ancestors
    }
  }
  visit(tree?.root?.children, [])
  return found || []
}

function findArtifactParentPath(tree, pageId) {
  let parentPath = ''
  const visit = nodes => {
    for (const node of nodes || []) {
      if (node.kind === 'folder') visit(node.children)
      else if (node.pageId === pageId || node.id === pageId) parentPath = node.parentPath || ''
    }
  }
  visit(tree?.root?.children)
  return parentPath
}

function childMatches(node, search) {
  if (!search) return true
  if (node.kind === 'artifact') return `${node.title} ${node.name} ${node.artifactKind} ${node.diagnostics?.map(item => item.message).join(' ') || ''}`.toLowerCase().includes(search)
  return node.name.toLowerCase().includes(search) || node.children.some(child => childMatches(child, search))
}

function treeDiagnostics(tree, topLevel = []) {
  const result = []
  const seen = new Set()
  const append = diagnostic => {
    if (!(diagnostic?.nestedArtifact || diagnostic?.containingArtifact || diagnostic?.code === 'NESTED_ARTIFACT')) return
    const key = diagnosticKey(diagnostic)
    if (seen.has(key)) return
    seen.add(key)
    result.push(diagnostic)
  }
  for (const diagnostic of topLevel || []) append(diagnostic)
  const visit = nodes => (nodes || []).forEach(node => {
    if (node.kind === 'folder') visit(node.children)
    else for (const diagnostic of node.diagnostics || []) append({ ...diagnostic, artifactId: node.id, artifactPath: node.path })
  })
  visit(tree?.root?.children)
  return result
}

function diagnosticKey(diagnostic) {
  return [
    diagnostic?.code || '',
    diagnostic?.nestedArtifact?.kind || '',
    diagnostic?.nestedArtifact?.path || diagnostic?.path || '',
    diagnostic?.containingArtifact?.kind || '',
    diagnostic?.containingArtifact?.path || '',
    diagnostic?.repairParentPath ?? '',
    diagnostic?.proposedDestination || '',
  ].join(':')
}

function nearestShallowAncestor(tree, path) {
  const parts = (path || '').split('/').filter(Boolean)
  for (let length = parts.length - 1; length > 0; length--) {
    const candidate = folderByPath(tree, parts.slice(0, length).join('/'))
    if (candidate && candidate.depth <= 2) return candidate
  }
  return null
}

export function NestedArtifactRepairDialog({ diagnostics = [], open, onOpenChange, onRepair }) {
  const [states, setStates] = useState({})
  useEffect(() => { if (!open) setStates({}) }, [open])
  const repair = async diagnostic => {
    const key = diagnosticKey(diagnostic)
    if (typeof onRepair !== 'function' || states[key]?.busy) return
    setStates(current => ({ ...current, [key]: { busy: true, error: '', success: false } }))
    try {
      await onRepair(diagnostic)
      setStates(current => ({ ...current, [key]: { busy: false, error: '', success: true } }))
    } catch (error) {
      const details = error?.data && typeof error.data === 'object' ? error.data : {}
      const collision = error?.code === 'REPAIR_DESTINATION_OCCUPIED' || error?.code === 'COLLISION'
      const destination = details.occupiedPath || diagnostic.proposedDestination || (diagnostic.repairParentPath === '' ? 'Notebook root' : diagnostic.repairParentPath)
      const collisionMessage = destination
        ? `The proposed destination ${destination === 'Notebook root' ? 'Notebook root' : `“${destination}”`} is occupied. Resolve that conflict, then retry this repair.`
        : 'The proposed destination is occupied. Resolve that conflict, then retry this repair.'
      const moved = details.moved === true
      const partialMessage = moved
        ? `${error?.message || 'The artifact moved, but reconciliation did not finish.'} Refresh the tree before taking further action. ${details.fromPath || diagnostic.nestedArtifact?.path || ''} → ${details.toPath || diagnostic.proposedDestination || ''}`
        : null
      setStates(current => ({ ...current, [key]: { busy: false, error: collision ? collisionMessage : partialMessage || error?.message || 'Could not repair this artifact.', success: false, moved } }))
    }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={css.repairDialog}>
      <DialogHeader><DialogTitle>Nested artifact diagnostics</DialogTitle><DialogDescription>Review each exact source and proposed destination. Nothing moves until you choose Repair.</DialogDescription></DialogHeader>
      <ul className={css.repairList}>
        {diagnostics.map((diagnostic, index) => {
          const key = diagnosticKey(diagnostic)
          const state = states[key] || {}
          const source = diagnostic.nestedArtifact?.path || diagnostic.path || diagnostic.artifactPath || 'Unknown path'
          const proposedDestination = diagnostic.proposedDestination || (diagnostic.repairParentPath === '' ? 'Notebook root' : diagnostic.repairParentPath)
          return <li key={`${key}:${index}`} className={css.repairItem}>
            <strong>{diagnostic.code}</strong>
            <p>{diagnostic.message}</p>
            <dl><dt>Nested artifact</dt><dd>{diagnostic.nestedArtifact?.kind || 'Artifact'} <code>{source}</code></dd>
              {diagnostic.containingArtifact && <><dt>Immediate container</dt><dd>{diagnostic.containingArtifact.kind || 'Artifact'} {diagnostic.containingArtifact.path && <code>{diagnostic.containingArtifact.path}</code>}</dd></>}
              {proposedDestination && <><dt>Proposed destination</dt><dd>{proposedDestination === 'Notebook root' ? proposedDestination : <code>{proposedDestination}</code>}</dd></>}
              {Object.hasOwn(diagnostic, 'repairParentPath') && <><dt>Destination parent</dt><dd>{diagnostic.repairParentPath === '' ? 'Notebook root' : <code>{diagnostic.repairParentPath}</code>}</dd></>}
            </dl>
            {state.error && <p className={css.error} role="alert">{state.error}</p>}
            {state.success && <p role="status">Repair completed. Waiting for refreshed diagnostics.</p>}
            <Button type="button" disabled={!onRepair || state.busy || state.success || state.moved} onClick={() => void repair(diagnostic)}>{state.busy ? 'Repairing…' : state.moved ? 'Refresh required' : state.error ? 'Retry repair' : state.success ? 'Repair completed' : onRepair ? 'Repair this path' : 'Repair service unavailable'}</Button>
          </li>
        })}
      </ul>
    </DialogContent>
  </Dialog>
}

export function NotebookSidebarTree({ tree, diagnostics: topLevelDiagnostics = [], diagnosticScopeKey = '', pages = [], sites = [], activePageId, published = false, search = '', onOpenPage, onRepair, renderArtifactActions, onContextChange }) {
  const [expanded, setExpanded] = useState({})
  const [panelPaths, setPanelPaths] = useState([])
  const [selectedPath, setSelectedPath] = useState('')
  const [manualRepairOpen, setManualRepairOpen] = useState(false)
  const [dismissedDiagnosticFingerprint, setDismissedDiagnosticFingerprint] = useState(null)
  const [previousDiagnosticFingerprint, setPreviousDiagnosticFingerprint] = useState('')
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const panelStateRef = useRef(new Map())
  const revealedPageRef = useRef(undefined)
  const visibleTree = useMemo(() => pruneHiddenSubtrees(tree), [tree])
  const diagnostics = useMemo(() => treeDiagnostics(visibleTree, topLevelDiagnostics), [visibleTree, topLevelDiagnostics])
  const needle = search.trim().toLowerCase()
  const folder = folderByPath(visibleTree, panelPaths.at(-1) || '')
  const visibleChildren = useMemo(() => (folder?.children || []).filter(node => childMatches(node, needle)), [folder, needle])

  const currentDiagnosticKeys = diagnostics.map(diagnosticKey)
  const diagnosticFingerprint = JSON.stringify([diagnosticScopeKey, [...new Set(currentDiagnosticKeys)].sort()])
  if (previousDiagnosticFingerprint !== diagnosticFingerprint) {
    setPreviousDiagnosticFingerprint(diagnosticFingerprint)
    if (diagnostics.length === 0 && dismissedDiagnosticFingerprint !== null) setDismissedDiagnosticFingerprint(null)
  }
  const repairOpen = diagnostics.length > 0 && (manualRepairOpen || dismissedDiagnosticFingerprint !== diagnosticFingerprint)
  const onRepairOpenChange = open => {
    if (open) {
      setManualRepairOpen(true)
      return
    }
    setManualRepairOpen(false)
    setDismissedDiagnosticFingerprint(diagnosticFingerprint)
  }

  useEffect(() => {
    if (revealedPageRef.current === activePageId) return
    if (!activePageId) { revealedPageRef.current = null; return }
    if (!visibleTree?.root) return
    revealedPageRef.current = activePageId
    // A route change must reveal the active page after the tree response is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedPath(findArtifactParentPath(visibleTree, activePageId))
    const artifactAncestors = findArtifactPath(visibleTree, activePageId)
    const ancestors = artifactAncestors.filter(node => node.depth >= 3)
    setExpanded(current => {
      const next = { ...current }
      for (const node of artifactAncestors) if (node.depth <= 2) next[node.path] = true
      return next
    })
    setPanelPaths(ancestors.map(node => node.path))
  }, [activePageId, visibleTree])

  useEffect(() => {
    // The authoritative tree can remove folders while a deep panel is focused.
    const focusedPath = panelPaths.at(-1) || selectedPath
    if (focusedPath && !folderByPath(visibleTree, focusedPath)) {
      const fallback = nearestShallowAncestor(visibleTree, focusedPath)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedPath(fallback?.path || '')
      setPanelPaths(current => current.filter(path => folderByPath(visibleTree, path) && folderByPath(visibleTree, path).depth >= 3))
      onContextChange?.(fallback?.path || '')
      return
    }
    let lastValid = -1
    for (let index = 0; index < panelPaths.length; index++) if (folderByPath(visibleTree, panelPaths[index])) lastValid = index
    if (lastValid !== panelPaths.length - 1) setPanelPaths(current => current.slice(0, lastValid + 1))
    const path = lastValid >= 0 ? panelPaths[lastValid] : ''
    onContextChange?.(path || selectedPath || '')
  }, [visibleTree, panelPaths, selectedPath, onContextChange])

  useEffect(() => {
    if (!restoreRef.current || !panelRef.current) return
    const { scrollTop, focusKey } = restoreRef.current
    restoreRef.current = null
    panelRef.current.scrollTop = scrollTop
    requestAnimationFrame(() => [...(panelRef.current?.querySelectorAll('[data-tree-key]') || [])].find(element => element.dataset.treeKey === focusKey)?.focus())
  }, [panelPaths])

  const openFolder = node => {
    setSelectedPath(node.path)
    if (node.depth < 3) {
      setExpanded(current => ({ ...current, [node.path]: current[node.path] === false }))
      onContextChange?.(node.path)
      return
    }
    panelStateRef.current.set(panelPaths.at(-1) || '', { scrollTop: panelRef.current?.scrollTop || 0, focusKey: document.activeElement?.dataset?.treeKey || '' })
    restoreRef.current = { scrollTop: 0, focusKey: '' }
    setPanelPaths(current => [...current, node.path])
  }

  const back = () => {
    const previousPath = panelPaths.length > 1 ? panelPaths.at(-2) : ''
    restoreRef.current = panelStateRef.current.get(previousPath) || { scrollTop: 0, focusKey: '' }
    setPanelPaths(current => current.length <= 1 ? [] : current.slice(0, -1))
  }

  const renderNodes = nodes => nodes.filter(node => childMatches(node, needle)).map(node => {
    const key = node.kind === 'folder' ? `folder:${node.path}` : `artifact:${node.id}:${node.path || node.siteId || ''}`
    if (node.kind === 'folder') {
      const inline = node.depth <= 2 && node.children.some(child => childMatches(child, needle))
      const isExpanded = inline && expanded[node.path] !== false
      return <li key={key} className={css.treeItem}>
        <div className={css.treeRow}>
          <button type="button" className={css.treeLabel} data-tree-key={key} aria-expanded={inline ? isExpanded : undefined} onClick={() => openFolder(node)} title={node.path}>
            <TreeIcon name="chevron" size={14} className={`${css.chevron} ${isExpanded ? css.chevronOpen : ''}`} /><TreeIcon name="folder" className={css.kindIcon} /><span className={css.labelText}>{node.name}</span>
          </button>
        </div>
        {inline && isExpanded && <ul className={css.treeChildren}>{renderNodes(node.children)}</ul>}
      </li>
    }
    const page = pages.find(item => item.id === node.pageId) || pages.find(item => item.id === node.id)
    const pageView = page ? { ...page, folderPath: node.path, id: node.pageId || node.id, type: node.artifactKind, title: node.title || node.name, route: node.route || page.route, path: node.payloadPath || node.path || page.path, siteId: node.siteId || page.siteId, available: node.available && page.available !== false, diagnostics: [...(node.diagnostics || []), ...(page.diagnostics || [])] } : { ...node, id: node.pageId || node.id, type: node.artifactKind, path: node.payloadPath || node.path, available: false }
    const openable = Boolean(node.pageId && page && node.available && node.ref)
    return <li key={key} className={css.treeItem}>
      <div className={css.treeRow} data-page-type={node.artifactKind}>
        <button type="button" className={css.treeLabel} data-tree-key={key} disabled={!openable} aria-current={node.pageId === activePageId ? 'page' : undefined} title={node.title || node.name} onClick={() => { if (openable) { setSelectedPath(node.parentPath); onContextChange?.(node.parentPath); onOpenPage?.(pageView) } }}>
          <TreeIcon name={node.artifactKind} className={css.kindIcon} /><span className={css.labelText}>{node.title || node.name}</span>
          {!node.available && <span className={css.statusMark} aria-label="Unavailable" title={node.diagnostics?.[0]?.message || 'Unavailable'}>!</span>}
          {node.siteId && <span className={css.siteStatus} title={`Site ${sites.find(site => site.id === node.siteId)?.binding?.status || 'unknown'}`}>{sites.find(site => site.id === node.siteId)?.binding?.status === 'running' ? '●' : '○'}</span>}
        </button>
        {diagnostics.some(item => item.artifactId === node.id && item.artifactPath === node.path) && <button type="button" className={css.treeDiagnostic} onClick={() => setManualRepairOpen(true)}>Diagnostics</button>}
        {!published && openable && renderArtifactActions?.(pageView)}
      </div>
    </li>
  })

  return <>
    <div ref={panelRef} className={css.treePanel} data-testid="notebook-tree-panel">
      {panelPaths.length > 0 && <div className={css.treePanelHeader}><button type="button" className={css.backButton} onClick={back} aria-label="Back"><TreeIcon name="back" size={16} /></button><strong>{folder?.name || 'Folder'}</strong></div>}
      <ul className={css.treeChildren} aria-label={panelPaths.length ? `${folder?.name || 'Folder'} contents` : 'Notebook folders and pages'}>{renderNodes(visibleChildren)}</ul>
    </div>
    {diagnostics.length > 0 && <Button type="button" variant="ghost" className={css.treeDiagnosticsButton} onClick={() => setManualRepairOpen(true)}>Nested artifact diagnostics ({diagnostics.length})</Button>}
    {diagnostics.length > 0 && <NestedArtifactRepairDialog diagnostics={diagnostics} open={repairOpen} onOpenChange={onRepairOpenChange} onRepair={onRepair} />}
  </>
}

export default NotebookSidebarTree
