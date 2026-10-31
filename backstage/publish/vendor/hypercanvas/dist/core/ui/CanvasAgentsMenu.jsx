/** CoreUIBar dropdown for launching configured agent widgets on the active canvas. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MessageCircleCode from '../../internals/lucide/icons/message-circle-code.js'
import { TriggerButton } from '../lib/components/ui/trigger-button/index.js'
import * as DropdownMenu from '../lib/components/ui/dropdown-menu/index.js'
import Icon from './Icon.jsx'
import { createHostToolsBrowserClient } from '../host-tools/browser-client.js'
import { notifyAgentRuntimeStateChanged } from '../agent-chat/agent-chat-client.js'
import { getConfig } from '../index.js'

function availability(preflight, agentId, requestState) {
  if (requestState === 'loading' || requestState === 'idle') return { label: 'Checking…', kind: 'loading' }
  if (requestState === 'failed') return { label: 'Check failed', kind: 'failed' }
  if (preflight?.status === 'unsupported' || preflight?.support?.status === 'unsupported') {
    return { label: 'Unsupported', kind: 'unsupported' }
  }
  const tool = preflight?.agents?.[agentId]
  if (tool?.status === 'installed' && typeof tool.path === 'string' && tool.path.startsWith('/')) {
    if (tool.reason) return { label: 'Found, version check failed', kind: 'installed' }
    return { label: tool.version || 'Found', kind: 'installed' }
  }
  if (tool?.status === 'missing') return { label: 'Not found', kind: 'missing' }
  if (tool?.status === 'failed_verification') return { label: 'Found, version check failed', kind: 'installed' }
  if (tool?.status === 'unsupported') return { label: 'Unsupported', kind: 'unsupported' }
  return { label: 'Status unavailable', kind: 'failed' }
}

function baselineLabel(preflight, requestState) {
  if (requestState === 'loading' || requestState === 'idle') return 'Checking host tools…'
  if (requestState === 'failed') return 'Host check failed'
  const status = preflight?.baseline?.status
  if (status === 'valid') return 'Core Node/npm baseline: valid. Agent availability is independent.'
  if (status === 'outdated') return 'Core Node/npm baseline: outdated. Agent availability is independent.'
  if (status === 'partial') return 'Core Node/npm baseline: incomplete. Agent availability is independent.'
  if (status === 'missing') return 'Core Node/npm baseline: missing. Agent availability is independent.'
  if (preflight?.status === 'unsupported') return 'Host diagnostics are unsupported on this platform.'
  return 'Core Node/npm baseline status unavailable.'
}

export default function CanvasAgentsMenu({
  config = {},
  data: _data,
  canvasName = '',
  zoom: _zoom,
  tabindex,
  basePath = '/',
  hostToolsClient: providedHostToolsClient,
}) {
  void _data
  void _zoom
  const [menuOpen, setMenuOpen] = useState(false)
  const [preflight, setPreflight] = useState(null)
  const [requestState, setRequestState] = useState('idle')
  const previousPreflightRef = useRef(null)
  const hostToolsClient = useMemo(
    () => providedHostToolsClient || createHostToolsBrowserClient({ basePath }),
    [basePath, providedHostToolsClient],
  )

  const updatePreflight = useCallback((snapshot) => {
    const previous = previousPreflightRef.current
    previousPreflightRef.current = snapshot
    setPreflight(snapshot)
    setRequestState('ready')
    if (JSON.stringify(previous) !== JSON.stringify(snapshot)) {
      notifyAgentRuntimeStateChanged({ source: 'host-tools-preflight' })
    }
  }, [])

  const agents = useMemo(() => {
    const agentsConfig = getConfig('canvas')?.agents
    if (!agentsConfig || typeof agentsConfig !== 'object') return []
    return Object.entries(agentsConfig).map(([id, cfg]) => ({
      id,
      label: cfg.label || id,
      icon: cfg.icon,
      startupCommand: cfg.startupCommand || id,
      defaultWidth: cfg.defaultWidth,
      defaultHeight: cfg.defaultHeight,
    }))
  }, [])

  const loadPreflight = useCallback(async () => {
    setRequestState('loading')
    try {
      updatePreflight(await hostToolsClient.preflight())
    } catch {
      setPreflight(null)
      setRequestState('failed')
    }
  }, [hostToolsClient, updatePreflight])

  useEffect(() => {
    if (!menuOpen) return
    let active = true
    hostToolsClient.preflight().then((snapshot) => {
      if (active) updatePreflight(snapshot)
    }).catch(() => {
      if (!active) return
      setPreflight(null)
      setRequestState('failed')
    })
    return () => { active = false }
  }, [hostToolsClient, menuOpen, updatePreflight])

  function addAgent(agent) {
    document.dispatchEvent(new CustomEvent('storyboard:canvas:add-widget', {
      detail: {
        type: 'agent',
        canvasName,
        props: {
          agentId: agent.id,
          startupCommand: agent.startupCommand,
          ...(agent.defaultWidth ? { width: agent.defaultWidth } : {}),
          ...(agent.defaultHeight ? { height: agent.defaultHeight } : {}),
        },
      },
    }))
    setMenuOpen(false)
  }

  function changeMenuOpen(nextOpen) {
    if (nextOpen) setRequestState('loading')
    setMenuOpen(nextOpen)
  }

  function selectAgent(agent) {
    if (availability(preflight, agent.id, requestState).kind === 'unsupported') return
    addAgent(agent)
  }

  if (agents.length === 0) return null

  return (
    <DropdownMenu.Root open={menuOpen} onOpenChange={changeMenuOpen}>
      <DropdownMenu.Trigger asChild>
        <TriggerButton
          active={menuOpen}
          size="icon-xl"
          aria-label={config.ariaLabel || 'Add agent'}
          tabIndex={tabindex}
        >
          <MessageCircleCode size={16} aria-hidden="true" />
        </TriggerButton>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content side="top" align="start" sideOffset={16} className="hc-min-w-[240px]">
        <DropdownMenu.Label>Add agent</DropdownMenu.Label>
        {agents.map((agent) => {
          const state = availability(preflight, agent.id, requestState)
          const disabled = state.kind === 'loading' || state.kind === 'unsupported'
          return (
            <DropdownMenu.Item key={agent.id} disabled={disabled} onClick={() => selectAgent(agent)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, width: '100%' }}>
                {agent.icon ? <Icon name={agent.icon} size={16} /> : <MessageCircleCode size={16} aria-hidden="true" />}
                <span style={{ flex: 1 }}>{agent.label}</span>
                <span style={{ color: 'var(--hc-color-foreground-muted)', fontSize: '11px' }}>{state.label}</span>
              </span>
            </DropdownMenu.Item>
          )
        })}
        <DropdownMenu.Separator />
        <DropdownMenu.Item closeOnSelect={false} onClick={loadPreflight}>Refresh host diagnostics</DropdownMenu.Item>
        <div className="hc-px-2 hc-py-1.5 hc-text-xs hc-text-muted-foreground">
          {baselineLabel(preflight, requestState)}
          <br />
          Missing CLIs are user-managed. Follow the publisher&apos;s install instructions, then refresh.
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
