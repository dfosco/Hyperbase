import { Select } from '@base-ui/react/select'
import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { Button } from '../lib/components/ui/button/index.js'
import { TriggerButton } from '../lib/components/ui/trigger-button/index.js'
import * as DropdownMenu from '../lib/components/ui/dropdown-menu/index.js'
import Icon from './Icon.jsx'
import css from './PublishControl.module.css'
import { sidePanelState, openPanel, togglePanel } from '../stores/sidePanelStore.js'
import { formatSiteTerminalOutput } from '../site/terminal-output.js'
import { subscribeToStorage } from '../session/localStorage.js'
import {
  cancelGitHubConnection,
  connectGitHub,
  connectPublishingRepository,
  deriveGitHubPublishingView,
  getPublishingSnapshot,
  publishWebsite,
  publishingEnabled,
  recheckGitHubConnection,
  retainPublishing,
  retryGitHubCliSetup,
  retryPublishingOperation,
  subscribePublishing,
} from '../stores/publishingStore.js'

const VISIBILITY_OPTIONS = [{ value: 'public', label: 'Public' }, { value: 'private', label: 'Private' }]

const publishingDisabled = () => false

function usePublishingEnabled() {
  return useSyncExternalStore(subscribeToStorage, publishingEnabled, publishingDisabled)
}

// Polls /status only while a mounted surface needs it, and stops with the flag.
function usePublishingState(enabled) {
  useEffect(() => {
    if (!enabled) return undefined
    return retainPublishing()
  }, [enabled])
  return useSyncExternalStore(subscribePublishing, getPublishingSnapshot, getPublishingSnapshot)
}

const STEP_STATUS_MARK = { succeeded: '✓', failed: '!' }

function OperationProgress({ operation }) {
  if (!operation?.steps?.length) return null
  return (
    <ol className={css.steps} aria-label="Publishing progress">
      {operation.steps.map((step, index) => (
        <li key={`${step.name}-${index}`} data-status={step.status}>
          <span aria-hidden="true">{STEP_STATUS_MARK[step.status] ?? '·'}</span>
          {step.name.replaceAll('-', ' ')}
        </li>
      ))}
    </ol>
  )
}

function LoginTerminal({ login }) {
  const output = formatSiteTerminalOutput((login?.output || []).map(message => ({ message })))
  if (!output) return null
  return (
    <details className={css.technical}>
      <summary>Technical output</summary>
      <section className={css.terminal} aria-label="GitHub sign-in terminal output" aria-live="polite">
        <pre>{output}</pre>
      </section>
    </details>
  )
}

// The real one-time code printed by `gh auth login`, the page to enter it on, and the waiting state.
function GitHubSignIn({ login, busy }) {
  const [copied, setCopied] = useState(false)
  const waiting = login.status === 'awaiting_browser'
  const uri = login.verificationUri
  function copy() {
    const write = globalThis.navigator?.clipboard?.writeText
    if (!write) return
    Promise.resolve(write.call(globalThis.navigator.clipboard, login.code)).then(() => setCopied(true), () => {})
  }
  return (
    <section className={css.section} aria-label="GitHub sign-in">
      <p className={css.status} role="status">
        {waiting ? 'Waiting for you to approve in your browser…' : login.status === 'verifying' ? 'Confirming your GitHub account…' : 'Starting GitHub sign-in…'}
      </p>
      {login.code && (
        <div className={css.codeBlock}>
          <span className={css.codeLabel}>Enter this code on GitHub</span>
          <code className={css.code} aria-label="GitHub one-time code">{login.code}</code>
          <div className={css.links}>
            <Button type="button" className={css.codeAction} onClick={copy}>{copied ? 'Copied' : 'Copy code'}</Button>
            {uri && <Button type="button" className={css.codeAction} onClick={() => window.open(uri, '_blank', 'noopener,noreferrer')}>{login.browserOpenFailed ? 'Open GitHub' : 'Reopen GitHub'}</Button>}
          </div>
        </div>
      )}
      {login.browserOpenFailed && <p className={css.authWarning} role="status">{login.message}</p>}
      <Button type="button" className={css.wide} disabled={busy === 'cancel-connect' || login.status === 'verifying'} onClick={() => cancelGitHubConnection()}>Cancel</Button>
      <LoginTerminal login={login} />
    </section>
  )
}

const LOGIN_FAILURE_LABEL = { cancelled: 'GitHub sign-in was cancelled.' }

function RepositoryForm({ account, busy, onSubmit }) {
  const id = useId()
  const [repositoryMode, setRepositoryMode] = useState('create')
  const [owner, setOwner] = useState('')
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState('public')
  const ownerValue = owner || account || ''

  function submit(event) {
    event.preventDefault()
    onSubmit({ repositoryMode, owner: ownerValue.trim(), name: name.trim(), visibility })
  }

  return (
    <form className={css.form} onSubmit={submit}>
      <div className={css.tabs} role="group" aria-label="Repository setup">
        <button type="button" aria-pressed={repositoryMode === 'create'} className={repositoryMode === 'create' ? css.active : ''} onClick={() => setRepositoryMode('create')}>New repository</button>
        <button type="button" aria-pressed={repositoryMode === 'connect'} className={repositoryMode === 'connect' ? css.active : ''} onClick={() => setRepositoryMode('connect')}>Existing repository</button>
      </div>
      <div className={css.field}>
        <label htmlFor={`${id}-owner`}>GitHub owner</label>
        <input id={`${id}-owner`} required value={ownerValue} onChange={(event) => setOwner(event.target.value)} placeholder="username or organization" />
      </div>
      <div className={css.field}>
        <label htmlFor={`${id}-name`}>Repository name</label>
        <input id={`${id}-name`} required value={name} onChange={(event) => setName(event.target.value)} placeholder="my-notebook-site" />
      </div>
      {repositoryMode === 'create' && (
        <div className={css.field}>
          <label htmlFor={`${id}-visibility`}>Source visibility</label>
          <Select.Root value={visibility} onValueChange={setVisibility} items={VISIBILITY_OPTIONS}>
            <Select.Trigger id={`${id}-visibility`} className={css.selectTrigger}>
              <Select.Value />
              <Select.Icon className={css.selectIcon} aria-hidden="true">▾</Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner className={css.selectPositioner} sideOffset={4} alignItemWithTrigger={false}>
                <Select.Popup className={css.selectPopup}>
                  {VISIBILITY_OPTIONS.map(option => (
                    <Select.Item key={option.value} value={option.value} className={css.selectItem}>
                      <Select.ItemText>{option.label}</Select.ItemText>
                      <Select.ItemIndicator className={css.selectCheck}>✓</Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <p className={css.hint}>Free GitHub Pages sites need a public repository.</p>
        </div>
      )}
      <Button type="submit" className={css.wide} disabled={busy || !ownerValue.trim() || !name.trim()}>
        {busy ? 'Connecting…' : repositoryMode === 'create' ? 'Create repository' : 'Connect repository'}
      </Button>
    </form>
  )
}

/** Publish control rendered by the command toolbar. First use opens the panel; a configured site opens a compact menu. */
export default function PublishControl({ config = {}, tabIndex }) {
  const [panel, setPanel] = useState({ open: false, activeTab: 'inspector' })
  const [menuOpen, setMenuOpen] = useState(false)
  const enabled = usePublishingEnabled()
  const publishing = usePublishingState(enabled)
  const open = panel.open && panel.activeTab === 'publish'

  useEffect(() => sidePanelState.subscribe(setPanel), [])

  if (!enabled) return null

  const view = deriveGitHubPublishingView(publishing)
  const icon = <Icon name={config.icon || 'iconoir/upload-square'} size={20} {...(config.meta || {})} />
  const size = config.size || 'icon-xl'
  const label = config.ariaLabel || 'Publish'

  if (!view.repository) {
    return (
      <TriggerButton
        active={open}
        size={size}
        aria-label={label}
        aria-expanded={open}
        tabIndex={tabIndex}
        onClick={() => { if (publishingEnabled()) togglePanel('publish') }}
      >
        {icon}
      </TriggerButton>
    )
  }

  const busy = Boolean(view.busy) || view.phase === 'running'
  const retryable = view.phase === 'failed' && Boolean(view.operation?.id)
  const primaryLabel = retryable ? 'Retry publish' : view.phase === 'published' ? 'Publish changes' : 'Publish'
  // A successful operation confirms the push and Pages configuration only; it never reports a live site.
  const statusText = view.phase === 'running' ? 'Publishing…' : view.phase === 'failed' ? 'Publish failed' : view.phase === 'published' ? 'Deployment pending' : 'Not published'
  // Offered only when the latest recorded publish result names a Pages URL.
  const websiteUrl = view.phase === 'published' ? view.operation?.result?.pagesUrl || null : null

  function runPrimary() {
    setMenuOpen(false)
    if (!publishingEnabled()) return
    openPanel('publish')
    if (retryable) retryPublishingOperation(view.operation.id)
    else publishWebsite()
  }

  return (
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenu.Trigger nativeButton>
        <TriggerButton
          active={open || menuOpen}
          size={size}
          aria-label={label}
          tabIndex={tabIndex}
        >
          {icon}
        </TriggerButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content side="top" align="end" sideOffset={16} className="hc-min-w-[220px]">
        <DropdownMenu.Label>GitHub Pages · {statusText}</DropdownMenu.Label>
        <DropdownMenu.Item disabled={busy} onClick={runPrimary}>{primaryLabel}</DropdownMenu.Item>
        {websiteUrl && (
          <DropdownMenu.Item onClick={() => { setMenuOpen(false); window.open(websiteUrl, '_blank', 'noopener,noreferrer') }}>Open website</DropdownMenu.Item>
        )}
        <DropdownMenu.Separator />
        <DropdownMenu.Item onClick={() => { setMenuOpen(false); if (publishingEnabled()) openPanel('publish') }}>Publishing settings</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}

/** GitHub Pages publishing panel hosted by the shared SidePanel. */
export function PublishPanel() {
  const enabled = usePublishingEnabled()
  const publishing = usePublishingState(enabled)
  const view = deriveGitHubPublishingView(publishing)

  if (!enabled) return null

  const { phase, repository, operation, error, busy } = view
  const working = Boolean(busy) || phase === 'running'
  const succeeded = phase === 'published'
  const result = operation?.result
  const technicalOutput = formatSiteTerminalOutput((operation?.output || []).map(message => ({ message })))

  return (
    <div className={css.publishPanel}>
      <p className={css.description}>Publish this notebook as a GitHub Pages website. Hypercanvas pushes the whole notebook to a GitHub repository, and GitHub Pages serves the site.</p>

      {phase === 'loading' && <p className={css.status} role="status">Checking GitHub…</p>}
      {phase === 'unavailable' && (
        <section className={css.section} aria-label="GitHub CLI setup">
          <p className={view.cli?.status === 'failed' ? css.error : css.authWarning} role="status">{view.hint}</p>
          {view.cli?.status === 'installing' && <p className={css.hint}>Publishing setup runs in the background. You can keep using Hypercanvas.</p>}
          {view.cli?.status !== 'installing' && (
            <div className={css.links}>
              {view.cli?.retryable && <Button type="button" disabled={Boolean(busy)} onClick={() => retryGitHubCliSetup()}>Retry setup</Button>}
              <Button type="button" disabled={Boolean(busy)} onClick={() => recheckGitHubConnection()}>Recheck</Button>
            </div>
          )}
        </section>
      )}

      {phase === 'connecting' && view.login && <GitHubSignIn login={view.login} busy={busy} />}

      {phase === 'signin' && (
        <section className={css.section} aria-label="GitHub connection">
          <p className={css.hint}>Hypercanvas signs in through the GitHub CLI in your browser. Your credentials stay with GitHub.</p>
          <p className={css.authWarning} role="status">{view.hint}</p>
          {view.login && (view.login.status === 'failed' || view.login.status === 'cancelled') && (
            <div className={css.error} role="alert">
              <strong>{view.login.status === 'cancelled' ? LOGIN_FAILURE_LABEL.cancelled : view.login.message}</strong>
            </div>
          )}
          <div className={css.links}>
            {view.offline
              ? <Button type="button" className={css.wide} disabled={Boolean(busy)} onClick={() => recheckGitHubConnection()}>Recheck</Button>
              : <Button type="button" className={css.wide} disabled={Boolean(busy)} onClick={() => connectGitHub()}>{view.needsPermission ? 'Grant permission' : 'Connect GitHub'}</Button>}
          </div>
          {view.login && view.login.status !== 'succeeded' && <LoginTerminal login={view.login} />}
        </section>
      )}

      {phase === 'repository' && (
        <section className={css.section} aria-label="Connect repository">
          {view.account && <p className={css.hint}>Connected to GitHub as {view.account}.</p>}
          <p className={css.hint}>Choose the GitHub repository for this notebook. Publishing pushes the notebook there.</p>
          <RepositoryForm account={view.account} busy={busy === 'repository'} onSubmit={connectPublishingRepository} />
        </section>
      )}

      {repository && (
        <dl className={css.metadata}>
          <dt>Repository</dt>
          <dd>{repository.owner}/{repository.name}</dd>
          <dt>Source</dt>
          <dd>{repository.visibility === 'private' ? 'Private' : 'Public'} · {repository.branch}</dd>
        </dl>
      )}

      {(phase === 'ready' || succeeded) && (
        <Button type="button" className={css.wide} disabled={working} onClick={() => publishWebsite()}>
          {succeeded ? 'Publish changes' : 'Push and publish website'}
        </Button>
      )}

      {phase === 'failed' && operation?.id && (
        <Button type="button" className={css.wide} disabled={working} onClick={() => retryPublishingOperation(operation.id)}>Retry publish</Button>
      )}

      {(phase === 'running' || phase === 'failed' || succeeded) && <OperationProgress operation={operation} />}

      {operation?.error && (
        <div className={css.error} role="alert">
          <strong>{operation.error.message}</strong>
          {operation.error.hint && <p>{operation.error.hint}</p>}
        </div>
      )}

      {error && (
        <output className={css.error} role="alert">
          <strong>{error.message}</strong>
          {error.hint && <p>{error.hint}</p>}
        </output>
      )}

      {succeeded && (
        <div className={css.result} role="status">
          <p>Pushed to GitHub. Pages deployment isn’t confirmed yet.</p>
          <div className={css.links}>
            {result?.pagesUrl && <a href={result.pagesUrl} target="_blank" rel="noreferrer">Website</a>}
            {result?.repoUrl && <a href={result.repoUrl} target="_blank" rel="noreferrer">Repository</a>}
            {result?.runUrl && <a href={result.runUrl} target="_blank" rel="noreferrer">Actions run</a>}
          </div>
        </div>
      )}

      {succeeded && result?.warnings?.length > 0 && (
        <div className={css.warning} role="status">
          <strong>Published with notes</strong>
          <ul>{result.warnings.map((warning, index) => <li key={`${warning.widgetId || 'frame'}-${index}`}>{warning.message}</li>)}</ul>
        </div>
      )}

      {operation && (
        <details className={css.technical}>
          <summary>Technical output</summary>
          <section className={css.terminal} aria-label="Publish terminal output" aria-live="polite">
            <pre>{technicalOutput || (working ? 'Waiting for terminal output…' : 'No Git output was recorded.')}</pre>
          </section>
        </details>
      )}
    </div>
  )
}
