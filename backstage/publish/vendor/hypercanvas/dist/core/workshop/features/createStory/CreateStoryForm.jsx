import { useState, useMemo, useEffect } from 'react'
import { Button } from '../../../lib/components/ui/button/index.js'
import { Input } from '../../../lib/components/ui/input/index.js'
import { Label } from '../../../lib/components/ui/label/index.js'
import * as Panel from '../../../lib/components/ui/panel/index.js'
import * as Alert from '../../../lib/components/ui/alert/index.js'

const STORY_SUCCESS_KEY = 'sb-story-created'

function getApiUrl() {
  const basePath = window.__HYPERCANVAS_BASE_PATH__ || '/'
  return basePath.replace(/\/$/, '') + '/_hypercanvas/canvas'
}

export default function CreateStoryForm({ onClose }) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('canvas')
  const [format, setFormat] = useState('jsx')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [createdPath, setCreatedPath] = useState(null)
  const [canvasId, setCanvasId] = useState('')

  const kebabName = useMemo(
    () => name.replace(/[^a-zA-Z0-9\s_-]/g, '').trim().replace(/[\s_]+/g, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, ''),
    [name]
  )

  const nameError = useMemo(() => {
    if (name.trim() && !kebabName) return 'Name must contain at least one alphanumeric character'
    if (name.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(kebabName)) return 'Name must be kebab-case'
    return null
  }, [name, kebabName])

  const filePreview = kebabName ? `${kebabName}.story.${format}` : ''
  const canSubmit = !!kebabName && !nameError && !submitting

  useEffect(() => {
    try {
      const bridgeState = window.__storyboardCanvasBridgeState
      if (bridgeState?.canvasId) setCanvasId(bridgeState.canvasId)
      else if (bridgeState?.name) setCanvasId(bridgeState.name)
    } catch { /* empty */ }

    try {
      const saved = sessionStorage.getItem(STORY_SUCCESS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setSuccess(parsed.success)
        setCreatedPath(parsed.path)
        sessionStorage.removeItem(STORY_SUCCESS_KEY)
      }
    } catch { /* empty */ }
  }, [])

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setCreatedPath(null)
    try {
      const res = await fetch(getApiUrl() + '/create-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: kebabName,
          location,
          format,
          canvasName: location === 'canvas' ? canvasId : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create story'); return }
      setSuccess(`Created ${data.path}`)
      setCreatedPath(data.path)
      try {
        sessionStorage.setItem(STORY_SUCCESS_KEY, JSON.stringify({
          success: `Created ${data.name}.story.${format}`,
          path: data.path,
        }))
      } catch { /* empty */ }
    } catch (err) {
      setError(err.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && canSubmit) submit()
  }

  return (
    <>
      <Panel.Header>
        <Panel.Title>Create story</Panel.Title>
        <Panel.Close />
      </Panel.Header>

      <div className="hc-p-4 hc-pt-2 hc-space-y-3" onKeyDown={handleKeydown}>
        <div className="hc-space-y-1">
          <Label htmlFor="sb-story-name">Component name</Label>
          <Input
            id="sb-story-name"
            placeholder="e.g. user-card"
            autoComplete="off"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {nameError && <p className="hc-text-sm hc-text-destructive">{nameError}</p>}
          {filePreview && (
            <p className="hc-text-xs hc-text-muted-foreground">
              File: <code className="hc-px-1 hc-py-0.5 hc-bg-muted hc-rounded hc-font-mono hc-text-foreground hc-text-xs">{filePreview}</code>
            </p>
          )}
        </div>

        <fieldset className="hc-space-y-1.5">
          <Label>Location</Label>
          <div className="hc-flex hc-flex-col hc-gap-1.5">
            <label className="hc-flex hc-items-center hc-gap-2 hc-text-sm hc-cursor-pointer">
              <input
                type="radio"
                name="sb-story-location"
                value="canvas"
                checked={location === 'canvas'}
                onChange={() => setLocation('canvas')}
                className="hc-accent-primary"
              />
              This canvas directory
            </label>
            <label className="hc-flex hc-items-center hc-gap-2 hc-text-sm hc-cursor-pointer">
              <input
                type="radio"
                name="sb-story-location"
                value="components"
                checked={location === 'components'}
                onChange={() => setLocation('components')}
                className="hc-accent-primary"
              />
              <code className="hc-text-xs hc-bg-muted hc-px-1 hc-py-0.5 hc-rounded">src/components/</code>
            </label>
          </div>
        </fieldset>

        <fieldset className="hc-space-y-1.5">
          <Label>Format</Label>
          <div className="hc-flex hc-gap-3">
            <label className="hc-flex hc-items-center hc-gap-2 hc-text-sm hc-cursor-pointer">
              <input
                type="radio"
                name="sb-story-format"
                value="jsx"
                checked={format === 'jsx'}
                onChange={() => setFormat('jsx')}
                className="hc-accent-primary"
              />
              JSX
            </label>
            <label className="hc-flex hc-items-center hc-gap-2 hc-text-sm hc-cursor-pointer">
              <input
                type="radio"
                name="sb-story-format"
                value="tsx"
                checked={format === 'tsx'}
                onChange={() => setFormat('tsx')}
                className="hc-accent-primary"
              />
              TSX
            </label>
          </div>
        </fieldset>

        {error && (
          <Alert.Root variant="destructive">
            <Alert.Description>{error}</Alert.Description>
          </Alert.Root>
        )}
        {success && (
          <Alert.Root>
            <Alert.Description className="hc-text-success">
              {success}
              {createdPath && (
                <>
                  <br />
                  <span className="hc-text-xs hc-text-muted-foreground">
                    To edit your component, go to{' '}
                    <code className="hc-px-1 hc-py-0.5 hc-bg-muted hc-rounded hc-font-mono hc-text-xs">{createdPath}</code>
                  </span>
                </>
              )}
            </Alert.Description>
          </Alert.Root>
        )}
      </div>

      <Panel.Footer>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {submitting ? 'Creating\u2026' : 'Create'}
        </Button>
      </Panel.Footer>
    </>
  )
}
