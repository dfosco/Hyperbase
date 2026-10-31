import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Button } from '../../../lib/components/ui/button/index.js'
import { Input } from '../../../lib/components/ui/input/index.js'
import { Label } from '../../../lib/components/ui/label/index.js'
import * as Panel from '../../../lib/components/ui/panel/index.js'
import * as Alert from '../../../lib/components/ui/alert/index.js'

const CREATE_NEW_PAGE_VALUE = '__create_new_page__'

const selectClass =
  "hc-flex hc-h-9 hc-w-full hc-rounded-md hc-border hc-border-input hc-bg-transparent hc-px-3 hc-py-1 hc-text-sm hc-shadow-xs hc-transition-colors hc-focus-visible:outline-none hc-focus-visible:ring-1 hc-focus-visible:ring-ring hc-disabled:cursor-not-allowed hc-disabled:opacity-50"

function getApiUrl() {
  const basePath = window.__HYPERCANVAS_BASE_PATH__ || '/'
  return basePath.replace(/\/$/, '') + '/_hypercanvas/workshop/flows'
}

export default function CreateFlowForm({ onClose }) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [selectedPrototype, setSelectedPrototype] = useState('')
  const [description, setDescription] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [startingPage, setStartingPage] = useState('')
  const [newPagePath, setNewPagePath] = useState('')
  const [newPageTemplate, setNewPageTemplate] = useState('')

  const [prototypes, setPrototypes] = useState([])
  const [flows, setFlows] = useState([])
  const [partials, setPartials] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Derived values
  const kebabName = useMemo(
    () => name.replace(/[^a-zA-Z0-9\s_-]/g, '').trim().replace(/[\s_]+/g, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, ''),
    [name]
  )
  const autoTitle = useMemo(
    () => kebabName ? kebabName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') : '',
    [kebabName]
  )
  const displayTitle = titleTouched ? title : autoTitle
  const filePreview = kebabName ? `${kebabName}.flow.json` : ''
  const nameError = useMemo(() => {
    if (name.trim() && !kebabName) return 'Name must contain at least one alphanumeric character'
    if (name.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(kebabName)) return 'Name must be kebab-case'
    return null
  }, [name, kebabName])

  const selectedProtoEntry = useMemo(
    () => selectedPrototype ? prototypes.find(p => p.name === selectedPrototype) : null,
    [selectedPrototype, prototypes]
  )
  const copyFromFlows = useMemo(
    () => selectedPrototype
      ? flows.filter(f => {
          if (f.prototype !== selectedPrototype) return false
          return (f.folder || '') === (selectedProtoEntry?.folder || '')
        })
      : [],
    [selectedPrototype, flows, selectedProtoEntry]
  )
  const prototypeRoutes = useMemo(() => selectedProtoEntry?.routes || [], [selectedProtoEntry])
  const showNewPageFields = startingPage === CREATE_NEW_PAGE_VALUE
  const newPagePrefix = selectedPrototype ? `/${selectedPrototype}/` : '/prototype-name/'
  const templateChoices = useMemo(
    () => selectedPrototype
      ? partials.filter(p => p.scope === 'global' || (p.prototype === selectedPrototype && (p.folder || '') === (selectedProtoEntry?.folder || '')))
      : partials.filter(p => p.scope === 'global'),
    [selectedPrototype, partials, selectedProtoEntry]
  )
  const globalTemplateChoices = useMemo(() => templateChoices.filter(p => p.scope === 'global'), [templateChoices])
  const localTemplateChoices = useMemo(() => templateChoices.filter(p => p.scope === 'prototype'), [templateChoices])
  const localTemplateHeading = selectedPrototype || ''
  const startingPageError = showNewPageFields && !newPagePath.trim() ? 'Please provide a new page path' : null
  const canSubmit = !!kebabName && !!selectedPrototype && !nameError && !startingPageError && !submitting

  // Fetch data on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(getApiUrl())
        if (res.ok && !cancelled) {
          const data = await res.json()
          setPrototypes(data.prototypes || [])
          setFlows(data.flows || [])
          setPartials(data.partials || [])
        }
      } catch { /* defaults */ } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Effect 1: when selectedPrototype changes, reset/cascade fields
  const prevProtoRef = useRef(selectedPrototype)
  useEffect(() => {
    if (!selectedPrototype) {
      setCopyFrom('')
      setStartingPage('')
      setNewPagePath('')
      setNewPageTemplate('')
      prevProtoRef.current = selectedPrototype
      return
    }

    const routes = selectedProtoEntry?.routes || []

    setStartingPage(prev => {
      if (!prev || (prev !== CREATE_NEW_PAGE_VALUE && !routes.includes(prev))) {
        return routes[0] || ''
      }
      return prev
    })

    setNewPagePath(prev => {
      const prefix = `/${selectedPrototype}/`
      if (startingPage === CREATE_NEW_PAGE_VALUE && !prev.startsWith(prefix)) {
        return `${prefix}new-page`
      }
      return prev
    })

    setCopyFrom(prev => {
      const activeStillValid = prev && copyFromFlows.some(f => f.path === prev)
      if (activeStillValid) return prev
      const matchPage = startingPage && startingPage !== CREATE_NEW_PAGE_VALUE
        ? copyFromFlows.find(f => f.route === startingPage)
        : null
      return matchPage?.path || ''
    })

    prevProtoRef.current = selectedPrototype
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPrototype])

  // Effect 2: clear template if no longer available
  useEffect(() => {
    if (!newPageTemplate) return
    if (!templateChoices.some(c => c.id === newPageTemplate)) {
      setNewPageTemplate('')
    }
  }, [templateChoices, newPageTemplate])

  function handleTitleInput(e) {
    setTitle(e.target.value)
    setTitleTouched(true)
  }
  function handleTitleBlur() {
    if (!title.trim()) setTitleTouched(false)
  }

  const submit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: kebabName,
          title: displayTitle,
          prototype: selectedPrototype,
          folder: selectedProtoEntry?.folder || undefined,
          description: description.trim() || undefined,
          copyFrom: copyFrom || undefined,
          startingPage: showNewPageFields ? newPagePath.trim() : (startingPage || undefined),
          createPage: showNewPageFields ? {
            path: newPagePath.trim(),
            template: newPageTemplate || undefined,
          } : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create flow'); return }
      setSuccess(`Created ${data.path}`)
    } catch (err) {
      setError(err.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, kebabName, displayTitle, selectedPrototype, selectedProtoEntry, description, copyFrom, showNewPageFields, newPagePath, startingPage, newPageTemplate])

  function handleKeydown(e) {
    if (e.key === 'Enter' && canSubmit) submit()
  }

  return (
    <>
      <Panel.Header>
        <Panel.Title>Create flow</Panel.Title>
        <Panel.Close />
      </Panel.Header>

      <div className="hc-p-4 hc-pt-2 hc-space-y-5" onKeyDown={handleKeydown}>
        {/* Name */}
        <div className="hc-space-y-1">
          <Label htmlFor="sb-flow-name">Name</Label>
          <Input id="sb-flow-name" placeholder="e.g. empty-state" autoComplete="off" spellCheck={false} value={name} onChange={e => setName(e.target.value)} />
          {nameError && <p className="hc-text-sm hc-text-destructive">{nameError}</p>}
          {filePreview && (
            <p className="hc-text-xs hc-text-muted-foreground">
              File: <code className="hc-px-1 hc-py-0.5 hc-bg-muted hc-rounded hc-font-mono hc-text-foreground hc-text-xs">{filePreview}</code>
            </p>
          )}
        </div>

        {/* Title */}
        <div className="hc-space-y-1">
          <Label htmlFor="sb-flow-title">Title</Label>
          <Input id="sb-flow-title" placeholder={autoTitle || 'Auto-derived from name'} value={displayTitle} onChange={handleTitleInput} onBlur={handleTitleBlur} />
        </div>

        {/* Prototype */}
        <div className="hc-space-y-1">
          <Label htmlFor="sb-flow-prototype">Prototype</Label>
          <select className={selectClass} id="sb-flow-prototype" value={selectedPrototype} onChange={e => setSelectedPrototype(e.target.value)} disabled={loading}>
            <option value="">Select prototype</option>
            {prototypes.map(p => (
              <option key={p.name} value={p.name}>{p.folder ? `${p.folder} / ${p.name}` : p.name}</option>
            ))}
          </select>
        </div>

        {/* Copy from existing flow */}
        <div className="hc-space-y-1">
          <Label htmlFor="sb-flow-copy">Copy from existing flow <span className="hc-text-muted-foreground">(optional)</span></Label>
          <select className={selectClass} id="sb-flow-copy" value={copyFrom} onChange={e => setCopyFrom(e.target.value)} disabled={loading || !selectedPrototype}>
            {!selectedPrototype
              ? <option value="">Select a prototype first</option>
              : <>
                  <option value="">None</option>
                  {copyFromFlows.map(f => (
                    <option key={f.path} value={f.path}>{f.title} ({f.name})</option>
                  ))}
                </>
            }
          </select>
        </div>

        {/* Starting page */}
        <div className="hc-space-y-1">
          <Label htmlFor="sb-flow-starting-page">Starting page <span className="hc-text-muted-foreground">(optional)</span></Label>
          <select className={selectClass} id="sb-flow-starting-page" value={startingPage} onChange={e => setStartingPage(e.target.value)} disabled={loading || !selectedPrototype}>
            {!selectedPrototype
              ? <option value="">Select a prototype first</option>
              : <>
                  <option value="">None</option>
                  {prototypeRoutes.map(route => (
                    <option key={route} value={route}>{route}</option>
                  ))}
                  <option value={CREATE_NEW_PAGE_VALUE}>Create new page</option>
                </>
            }
          </select>
          <p className="hc-text-xs hc-text-muted-foreground">Users will be redirected to this page</p>
        </div>

        {/* New page fields */}
        {showNewPageFields && (
          <>
            <div className="hc-space-y-1">
              <Label htmlFor="sb-flow-new-page-path">New page path</Label>
              <div className="hc-flex hc-items-center hc-gap-2">
                <span className="hc-text-xs hc-text-muted-foreground hc-font-mono">{newPagePrefix}</span>
                <Input
                  id="sb-flow-new-page-path"
                  placeholder="new-page"
                  value={newPagePath.startsWith(newPagePrefix) ? newPagePath.slice(newPagePrefix.length) : ''}
                  onChange={e => {
                    const suffix = e.target.value.replace(/^\/+/, '')
                    setNewPagePath(`${newPagePrefix}${suffix}`)
                  }}
                />
              </div>
            </div>
            <div className="hc-space-y-1">
              <Label htmlFor="sb-flow-new-page-template">Template / recipe</Label>
              <select className={selectClass} id="sb-flow-new-page-template" value={newPageTemplate} onChange={e => setNewPageTemplate(e.target.value)} disabled={!selectedPrototype}>
                <option value="">Blank page</option>
                {globalTemplateChoices.length > 0 && (
                  <optgroup label="Global">
                    {globalTemplateChoices.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
                {localTemplateChoices.length > 0 && (
                  <optgroup label={localTemplateHeading}>
                    {localTemplateChoices.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            {startingPageError && <p className="hc-text-sm hc-text-destructive">{startingPageError}</p>}
          </>
        )}

        {/* Description */}
        <div className="hc-space-y-1">
          <Label htmlFor="sb-flow-desc">Description</Label>
          <Input id="sb-flow-desc" placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {/* Alerts */}
        {error && (
          <Alert.Root variant="destructive">
            <Alert.Description>{error}</Alert.Description>
          </Alert.Root>
        )}
        {success && (
          <Alert.Root>
            <Alert.Description className="hc-text-success">{success}</Alert.Description>
          </Alert.Root>
        )}
      </div>

      <Panel.Footer>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!canSubmit}>{submitting ? 'Creating\u2026' : 'Create'}</Button>
      </Panel.Footer>
    </>
  )
}
