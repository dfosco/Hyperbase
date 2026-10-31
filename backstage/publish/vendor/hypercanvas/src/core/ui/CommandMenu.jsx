/**
 * CommandMenu — ⌘ trigger + config-driven dropdown menu.
 * Renders actions from the command action registry by type:
 *   default  → DropdownMenu.Item
 *   toggle   → DropdownMenu.CheckboxItem
 *   submenu  → DropdownMenu.Sub with SubTrigger + SubContent
 */

import './CommandMenu.css';
import { useState, useEffect, useMemo, useCallback } from 'react'
import * as DropdownMenu from '../lib/components/ui/dropdown-menu/index.js'
import * as Panel from '../lib/components/ui/panel/index.js'
import { TriggerButton } from '../lib/components/ui/trigger-button/index.js'
import Icon from './Icon.jsx'
import { getActionsForMode, executeAction, getActionChildren, subscribeToCommandActions } from '../stores/commandActions.js'
import { getToolbarToolState, isToolbarToolLocalOnly, subscribeToToolbarToolStates } from '../stores/toolStateStore.js'
import { getCurrentMode, subscribeToMode } from '../modes/modes.js'
import { sbNavigate } from '../navigation/sbNavigate.js'

const localDotStyle = {
  display: 'inline-block',
  width: 4,
  height: 4,
  background: '#1a7f37',
  borderRadius: '50%',
  flexShrink: 0,
}

export default function CommandMenu({
  basePath = '/',
  open: controlledOpen,
  onOpenChange,
  tabindex,
  icon = 'iconoir/key-command',
  iconMeta = {},
  flowDialogOpen: controlledFlowDialogOpen,
  onFlowDialogOpenChange,
  flowName = 'default',
  flowJson = '',
  flowError = null,
  shortcuts = {},
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = useCallback((v) => {
    const val = typeof v === 'function' ? v(open) : v
    if (onOpenChange) onOpenChange(val)
    else setInternalOpen(val)
  }, [onOpenChange, open])

  const [internalFlowDialogOpen, setInternalFlowDialogOpen] = useState(false)
  const flowDialogOpen = controlledFlowDialogOpen !== undefined ? controlledFlowDialogOpen : internalFlowDialogOpen
  const setFlowDialogOpen = useCallback((v) => {
    const val = typeof v === 'function' ? v(flowDialogOpen) : v
    if (onFlowDialogOpenChange) onFlowDialogOpenChange(val)
    else setInternalFlowDialogOpen(val)
  }, [onFlowDialogOpenChange, flowDialogOpen])

  const [actionsVersion, setActionsVersion] = useState(0)
  const [mode, setMode] = useState(getCurrentMode)

  useEffect(() => {
    const unsub = subscribeToCommandActions(() => setActionsVersion(v => v + 1))
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeToToolbarToolStates(() => setActionsVersion(v => v + 1))
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeToMode(() => setMode(getCurrentMode()))
    return unsub
  }, [])

  const resolvedActions = useMemo(() => {
    void actionsVersion
    const raw = getActionsForMode(mode)
    return raw.filter(a => {
      if (a.hideFromCommandMenu) return false
      if (!a.toolKey) return true
      const state = getToolbarToolState(a.toolKey)
      return state !== 'disabled' && state !== 'hidden'
    })
  }, [actionsVersion, mode])

  function handleAction(action) {
    executeAction(action.id)
    setOpen(false)
  }

  function handleToggleSelect(e, action) {
    e.preventDefault()
    executeAction(action.id)
  }

  function handleSubmenuChildSelect(e, child) {
    e.preventDefault()
    if (child.execute) child.execute()
    setActionsVersion(v => v + 1)
  }

  function handleOpenChange(isOpen) {
    if (isOpen) setActionsVersion(v => v + 1)
    setOpen(isOpen)
  }

  function _renderLocalDot(toolKey) {
    if (!toolKey || !isToolbarToolLocalOnly(toolKey)) return null
    return <span style={localDotStyle} />
  }
  void _renderLocalDot

  function renderAction(action, i) {
    const key = action.id || `_${action.type}_${i}`

    if (action.type === 'separator') {
      return <DropdownMenu.Separator key={key} />
    }

    if (action.type === 'header') {
      return <DropdownMenu.Label key={key}>{action.label}</DropdownMenu.Label>
    }

    if (action.type === 'footer') {
      return [
        <DropdownMenu.Separator key={`${key}-sep`} />,
        <div key={key} className="hc-px-2 hc-py-1.5 hc-text-xs hc-text-muted-foreground hc-font-mono">{action.label}</div>,
      ]
    }

    if (action.type === 'toggle') {
      return (
        <DropdownMenu.CheckboxItem
          key={key}
          checked={action.active}
          onSelect={(e) => handleToggleSelect(e, action)}
        >
          {action.label}
        </DropdownMenu.CheckboxItem>
      )
    }

    if (action.type === 'submenu') {
      const itemState = action.toolKey ? getToolbarToolState(action.toolKey) : 'active'
      const itemLocalOnly = action.toolKey ? isToolbarToolLocalOnly(action.toolKey) : false

      if (itemState !== 'inactive') {
        return (
          <DropdownMenu.Sub key={key}>
            <DropdownMenu.SubTrigger className={itemState === 'dimmed' ? "hc-opacity-50" : ''}>
              <span className="hc-flex hc-items-center hc-justify-between hc-w-full hc-gap-2">
                <span>{action.label}</span>
                {itemLocalOnly && <span style={localDotStyle} />}
              </span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent className="hc-min-w-[160px]">
              {getActionChildren(action.id).map(child => {
                const childKey = child.id || child.label
                if (child.type === 'toggle') {
                  return (
                    <DropdownMenu.CheckboxItem
                      key={childKey}
                      checked={child.active}
                      onSelect={(e) => handleSubmenuChildSelect(e, child)}
                    >
                      {child.label}
                    </DropdownMenu.CheckboxItem>
                  )
                }
                return (
                  <DropdownMenu.Item
                    key={childKey}
                    onClick={() => { if (child.execute) child.execute(); setOpen(false) }}
                  >
                    {child.label}
                  </DropdownMenu.Item>
                )
              })}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        )
      }

      return (
        <DropdownMenu.Item key={key} disabled>
          <span className="hc-flex hc-items-center hc-justify-between hc-w-full hc-gap-2">
            <span>{action.label}</span>
            {itemLocalOnly && <span style={localDotStyle} />}
          </span>
        </DropdownMenu.Item>
      )
    }

    if (action.type === 'link' && action.url) {
      const itemState = action.toolKey ? getToolbarToolState(action.toolKey) : 'active'
      const itemLocalOnly = action.toolKey ? isToolbarToolLocalOnly(action.toolKey) : false
      return (
        <DropdownMenu.Item
          key={key}
          onClick={() => {
            setOpen(false)
            if (action.url.startsWith('/') && !action.url.startsWith('//')) {
              const base = (basePath || '/').replace(/\/+$/, '')
              sbNavigate((base === '/' ? '' : base) + action.url)
            } else {
              sbNavigate(action.url)
            }
          }}
          disabled={itemState === 'inactive'}
          className={itemState === 'dimmed' ? "hc-opacity-50" : ''}
        >
          <span className="hc-flex hc-items-center hc-justify-between hc-w-full hc-gap-2">
            <span>{action.label}</span>
            {itemLocalOnly && <span style={localDotStyle} />}
          </span>
        </DropdownMenu.Item>
      )
    }

    // Default action
    const itemState = action.toolKey ? getToolbarToolState(action.toolKey) : 'active'
    const itemLocalOnly = action.toolKey ? isToolbarToolLocalOnly(action.toolKey) : false
    return (
      <DropdownMenu.Item
        key={key}
        onClick={() => handleAction(action)}
        disabled={itemState === 'inactive'}
        className={itemState === 'dimmed' ? "hc-opacity-50" : ''}
      >
        <span className="hc-flex hc-items-center hc-justify-between hc-w-full hc-gap-2">
          <span>{action.label}</span>
          {itemLocalOnly && <span style={localDotStyle} />}
        </span>
      </DropdownMenu.Item>
    )
  }

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={handleOpenChange}>
        <DropdownMenu.Trigger>
          <TriggerButton
            active={open}
            className="hc-text-2xl"
            aria-label="Command Menu"
            tabIndex={tabindex}
          >
            <Icon name={icon} size={16} {...iconMeta} />
          </TriggerButton>
        </DropdownMenu.Trigger>

        <DropdownMenu.Content side="top" align="end" sideOffset={16} alignOffset={4} className="hc-min-w-[200px]">
          {resolvedActions.flatMap((action, i) => renderAction(action, i))}
          {(shortcuts.hideChrome || shortcuts.openCommandMenu) && (
            <>
              <DropdownMenu.Separator />
              <div className="hc-px-2 hc-py-1.5 hc-flex hc-flex-col hc-gap-0.5">
                {shortcuts.hideChrome && (
                  <div className="hc-text-xs hc-text-muted-foreground hc-font-mono">{shortcuts.hideChrome.label}</div>
                )}
                {shortcuts.openCommandMenu && (
                  <div className="hc-text-xs hc-text-muted-foreground hc-font-mono">{shortcuts.openCommandMenu.label}</div>
                )}
              </div>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <Panel.Root open={flowDialogOpen} onOpenChange={setFlowDialogOpen}>
        <Panel.Content>
          <Panel.Header>
            <Panel.Title>Flow: {flowName}</Panel.Title>
            <Panel.Close />
          </Panel.Header>
          <Panel.Body>
            {flowError ? (
              <span className="hc-text-destructive hc-text-sm">{flowError}</span>
            ) : (
              <pre className="hc-m-0 hc-bg-transparent hc-text-sm hc-font-mono hc-leading-relaxed hc-whitespace-pre-wrap hc-break-words">{flowJson}</pre>
            )}
          </Panel.Body>
        </Panel.Content>
      </Panel.Root>
    </>
  )
}
