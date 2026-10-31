/**
 * CreatePrototypeForm — workshop form for creating a new prototype.
 * Uses Radix-style React components for all form elements.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '../../../lib/components/ui/button/index.js'
import { Input } from '../../../lib/components/ui/input/index.js'
import { Label } from '../../../lib/components/ui/label/index.js'
import { Checkbox } from '../../../lib/components/ui/checkbox/index.js'
import * as Panel from '../../../lib/components/ui/panel/index.js'
import * as DropdownMenu from '../../../lib/components/ui/dropdown-menu/index.js'
import * as Alert from '../../../lib/components/ui/alert/index.js'

function getApiUrl() {
  const basePath = window.__HYPERCANVAS_BASE_PATH__ || '/'
  return basePath.replace(/\/$/, '') + '/_hypercanvas/workshop/prototypes'
}

export default function CreatePrototypeForm({ onClose }) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [folder, setFolder] = useState('')
  const [partial, setPartial] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [createFlow, setCreateFlow] = useState(false)
  const [isExternal, setIsExternal] = useState(false)
  const [externalUrl, setExternalUrl] = useState('')

  const [folders, setFolders] = useState([])
  const [partials, setPartials] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false)

  // Derived values
  const kebabName = useMemo(
    () => name.replace(/[^a-zA-Z0-9\s_-]/g, '').trim().replace(/[\s_]+/g, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, ''),
    [name]
  )
  const autoTitle = useMemo(
    () => kebabName ? kebabName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('').replace(/([A-Z])/g, ' $1').trim() : '',
    [kebabName]
  )
  const displayTitle = titleTouched ? title : autoTitle
  const routePreview = kebabName ? `/${kebabName}` : ''
  const nameError = useMemo(() => {
    if (name.trim() && !kebabName) return 'Name must contain at least one alphanumeric character'
    if (name.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(kebabName)) return 'Name must be kebab-case'
    return null
  }, [name, kebabName])
  const urlError = useMemo(() => {
    if (!isExternal || !externalUrl.trim()) return null
    try {
      const parsed = new URL(externalUrl.trim())
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'Must use http: or https: protocol'
      return null
    } catch { return 'Must be a valid URL (e.g. https://example.com)' }
  }, [isExternal, externalUrl])
  const canSubmit = !!kebabName && !nameError && !submitting && (!isExternal || (!!externalUrl.trim() && !urlError))

  const selectedFolderLabel = folder ? `${folder}.folder` : ''
  const scopedPartials = useMemo(
    () => partials.filter(p => p.scope === 'global' || (!folder ? false : p.folder === folder)),
    [partials, folder]
  )
  const templateLabel = partial ? scopedPartials.find(p => p.id === partial)?.name ?? partial : 'No template'
  const templates = useMemo(() => scopedPartials.filter(p => p.kind === 'template'), [scopedPartials])
  const recipes = useMemo(() => scopedPartials.filter(p => p.kind === 'recipe'), [scopedPartials])
  const globalTemplates = useMemo(() => templates.filter(p => p.scope === 'global'), [templates])
  const globalRecipes = useMemo(() => recipes.filter(p => p.scope === 'global'), [recipes])
  const localTemplates = useMemo(() => templates.filter(p => p.scope === 'prototype'), [templates])
  const localRecipes = useMemo(() => recipes.filter(p => p.scope === 'prototype'), [recipes])

  // Clear partial if no longer in scopedPartials
  useEffect(() => {
    if (!partial) return
    const stillAvailable = scopedPartials.some(p => p.id === partial)
    if (!stillAvailable) setPartial('')
  }, [scopedPartials, partial])

  // Fetch folders and partials on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(getApiUrl())
        if (res.ok && !cancelled) {
          const data = await res.json()
          setFolders(data.folders || [])
          if (data.partials?.length) setPartials(data.partials)
        }
      } catch { /* defaults */ } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function handleTitleInput(e) { setTitle(e.target.value); setTitleTouched(true) }
  function handleTitleBlur() { if (!title.trim()) setTitleTouched(false) }

  const submit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true); setError(null); setSuccess(null)
    try {
      const payload = { name: kebabName, title: displayTitle, folder: folder || undefined, author: author.trim() || undefined, description: description.trim() || undefined }
      if (isExternal) {
        payload.url = externalUrl.trim()
      } else {
        payload.partial = partial || undefined
        payload.createFlow = createFlow
      }
      const res = await fetch(getApiUrl(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create prototype'); return }
      setSuccess(`Created ${data.path}`)
      if (data.isExternal) {
        setTimeout(() => onClose?.(), 1500)
      } else {
        setTimeout(() => { const base = (window.__HYPERCANVAS_BASE_PATH__ || '/').replace(/\/$/, ''); window.location.href = base + data.route }, 1500)
      }
    } catch (err) { setError(err.message || 'Network error') } finally { setSubmitting(false) }
  }, [canSubmit, kebabName, displayTitle, folder, author, description, isExternal, externalUrl, partial, createFlow, onClose])

  function handleKeydown(e) { if (e.key === 'Enter' && canSubmit) submit() }

  return (
    <>
      <Panel.Header>
        <Panel.Title>Create prototype</Panel.Title>
        <Panel.Close />
      </Panel.Header>

      <div className="hc-p-4 hc-pt-2 hc-space-y-3" onKeyDown={handleKeydown}>
        <div className="hc-space-y-1">
          <Label htmlFor="sb-proto-name">Name</Label>
          <Input id="sb-proto-name" placeholder="e.g. my-prototype" autoComplete="off" spellCheck={false} value={name} onChange={e => setName(e.target.value)} />
          {nameError && <p className="hc-text-sm hc-text-destructive">{nameError}</p>}
          {routePreview && !isExternal && <p className="hc-text-xs hc-text-muted-foreground">Route: <code className="hc-px-1 hc-py-0.5 hc-bg-muted hc-rounded hc-font-mono hc-text-foreground hc-text-xs">{routePreview}</code></p>}
        </div>

        <div className="hc-flex hc-items-center hc-gap-2">
          <Checkbox id="sb-proto-external" checked={isExternal} onCheckedChange={setIsExternal} />
          <Label htmlFor="sb-proto-external" className="hc-text-sm hc-font-normal hc-cursor-pointer">External prototype</Label>
        </div>

        {isExternal && (
          <div className="hc-space-y-1">
            <Label htmlFor="sb-proto-url">URL</Label>
            <Input id="sb-proto-url" placeholder="https://example.com/prototype" autoComplete="off" spellCheck={false} value={externalUrl} onChange={e => setExternalUrl(e.target.value)} />
            {urlError && <p className="hc-text-sm hc-text-destructive">{urlError}</p>}
          </div>
        )}

        <div className="hc-space-y-1">
          <Label htmlFor="sb-proto-title">Title</Label>
          <Input id="sb-proto-title" placeholder={autoTitle || 'Auto-derived from name'} value={displayTitle} onChange={handleTitleInput} onBlur={handleTitleBlur} />
        </div>

        <div className="hc-grid hc-grid-cols-2 hc-gap-3">
          <div className="hc-space-y-1">
            <Label htmlFor="sb-proto-folder">Folder</Label>
            <select
              className="hc-flex hc-h-9 hc-w-full hc-rounded-md hc-border hc-border-input hc-bg-transparent hc-px-3 hc-py-1 hc-text-sm hc-shadow-xs hc-transition-colors hc-focus-visible:outline-none hc-focus-visible:ring-1 hc-focus-visible:ring-ring hc-disabled:cursor-not-allowed hc-disabled:opacity-50"
              id="sb-proto-folder"
              value={folder}
              onChange={e => setFolder(e.target.value)}
              disabled={loading}
            >
              <option value="">None</option>
              {folders.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          {!isExternal && (
            <div className="hc-space-y-1">
              <Label>Template</Label>
              <DropdownMenu.Root open={templateMenuOpen} onOpenChange={setTemplateMenuOpen}>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="hc-flex hc-h-9 hc-w-full hc-items-center hc-justify-between hc-rounded-md hc-border hc-border-input hc-bg-transparent hc-px-3 hc-py-1 hc-text-sm hc-shadow-xs hc-transition-colors hc-focus-visible:outline-none hc-focus-visible:ring-1 hc-focus-visible:ring-ring hc-disabled:cursor-not-allowed hc-disabled:opacity-50"
                    disabled={loading}
                  >
                    <span className={partial ? "hc-text-foreground" : "hc-text-muted-foreground"}>{templateLabel}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hc-text-muted-foreground"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content side="left" align="start" sideOffset={8} className="hc-min-w-[180px]">
                  {partial && (
                    <>
                      <DropdownMenu.Item onSelect={() => { setPartial(''); setTemplateMenuOpen(false) }}>
                        <span className="hc-text-muted-foreground">Clear selection</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                    </>
                  )}

                  {globalTemplates.length > 0 && (
                    <DropdownMenu.Group>
                      <DropdownMenu.GroupHeading>Templates</DropdownMenu.GroupHeading>
                      {globalTemplates.map(t => (
                        <DropdownMenu.Item key={t.id} onSelect={() => { setPartial(t.id); setTemplateMenuOpen(false) }}>
                          {t.name}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Group>
                  )}

                  {localTemplates.length > 0 && (
                    <>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Group>
                        <DropdownMenu.GroupHeading>{selectedFolderLabel || 'Prototype local'} / Templates</DropdownMenu.GroupHeading>
                        {localTemplates.map(t => (
                          <DropdownMenu.Item key={t.id} onSelect={() => { setPartial(t.id); setTemplateMenuOpen(false) }}>
                            {t.name}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Group>
                    </>
                  )}

                  {globalRecipes.length > 0 && (
                    <>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Group>
                        <DropdownMenu.GroupHeading>Recipes</DropdownMenu.GroupHeading>
                        {globalRecipes.map(r => (
                          <DropdownMenu.Item key={r.id} onSelect={() => { setPartial(r.id); setTemplateMenuOpen(false) }}>
                            {r.name}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Group>
                    </>
                  )}

                  {localRecipes.length > 0 && (
                    <>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Group>
                        <DropdownMenu.GroupHeading>{selectedFolderLabel || 'Prototype local'} / Recipes</DropdownMenu.GroupHeading>
                        {localRecipes.map(r => (
                          <DropdownMenu.Item key={r.id} onSelect={() => { setPartial(r.id); setTemplateMenuOpen(false) }}>
                            {r.name}
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Group>
                    </>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          )}
        </div>

        <div className="hc-space-y-1">
          <Label htmlFor="sb-proto-author">Author</Label>
          <Input id="sb-proto-author" placeholder="GitHub handle(s), comma-separated" value={author} onChange={e => setAuthor(e.target.value)} />
        </div>

        <div className="hc-space-y-1">
          <Label htmlFor="sb-proto-desc">Description</Label>
          <Input id="sb-proto-desc" placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {!isExternal && (
          <div className="hc-flex hc-items-center hc-gap-2">
            <Checkbox id="sb-proto-flow" checked={createFlow} onCheckedChange={setCreateFlow} />
            <Label htmlFor="sb-proto-flow" className="hc-text-sm hc-font-normal hc-cursor-pointer">Create flow file</Label>
          </div>
        )}

        {error && <Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>}
        {success && <Alert.Root><Alert.Description className="hc-text-success">{success}</Alert.Description></Alert.Root>}
      </div>

      <Panel.Footer>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!canSubmit}>{submitting ? 'Creating\u2026' : 'Create'}</Button>
      </Panel.Footer>
    </>
  )
}
