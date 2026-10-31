import { useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import Tooltip from '../../Tooltip.jsx'
import { getConnectorConfig, getInteractGate } from './widgetConfig.js'
import { getConfig } from '../../../core/stores/configStore.js'
import { getFrameActionUpdates } from './frameActionUpdates.js'
import { ICON_REGISTRY } from './widgetIcons.jsx'
import styles from './WidgetChrome.module.css'
import overlayStyles from './embedOverlay.module.css'
import { copyCanvasText } from '../clipboard.js'

const STICKY_NOTE_COLORS = {
  yellow: { bg: '#fff8c5', border: '#d4a72c', dot: '#e8c846' },
  blue:   { bg: '#ddf4ff', border: '#54aeff', dot: '#74b9ff' },
  green:  { bg: '#dafbe1', border: '#4ac26b', dot: '#6dd58c' },
  pink:   { bg: '#ffebe9', border: '#ff8182', dot: '#ff9a9e' },
  purple: { bg: '#fbefff', border: '#c297ff', dot: '#d4a8ff' },
  orange: { bg: '#fff1e5', border: '#d18616', dot: '#e8a844' },
}

function MoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z" />
    </svg>
  )
}

/** Danger-styled actions in the overflow menu. */
const DANGER_ACTIONS = new Set(['delete'])

/**
 * useAltKey — tracks whether the Alt/Option key is currently held.
 * Uses useSyncExternalStore for tear-free reads across concurrent renders.
 */
let altKeyHeld = false
const altKeyListeners = new Set()
function notifyAltKeyListeners() {
  for (const cb of altKeyListeners) cb()
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' && !altKeyHeld) { altKeyHeld = true; notifyAltKeyListeners() }
  })
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' && altKeyHeld) { altKeyHeld = false; notifyAltKeyListeners() }
  })
  window.addEventListener('blur', () => {
    if (altKeyHeld) { altKeyHeld = false; notifyAltKeyListeners() }
  })
}

function subscribeAltKey(cb) {
  altKeyListeners.add(cb)
  return () => altKeyListeners.delete(cb)
}
function getAltKeySnapshot() { return altKeyHeld }

function useAltKey() {
  return useSyncExternalStore(subscribeAltKey, getAltKeySnapshot, () => false)
}

/**
 * Overflow menu — `...` button that opens a dropdown with menu-only actions.
 */
function WidgetOverflowMenu({ widgetId, menuFeatures, onAction, group = false }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const triggerRef = useRef(null)
  const altHeld = useAltKey()

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const handleItemClick = useCallback((feature, e) => {
    e.stopPropagation()
    const action = (e.altKey && feature.alt) ? feature.alt.action : feature.action
    if (!group && action === 'copy-link') {
      const url = new URL(window.location.href)
      url.searchParams.set('widget', widgetId)
      void copyCanvasText(url.toString(), 'widget link')
    } else if (!group && action === 'copy-widget-id') {
      const canvasId = window.__storyboardCanvasBridgeState?.canvasId || ''
      void copyCanvasText(`${canvasId}::${widgetId}`, 'widget ID')
    } else {
      onAction?.(action, { altKey: e.altKey })
    }
    setOpen(false)
    if (action === 'copy-link' || action === 'copy-widget-id') {
      queueMicrotask(() => triggerRef.current?.focus())
    }
  }, [widgetId, onAction, group])

  return (
    <div ref={menuRef} className={styles.overflowWrapper}>
      <Tooltip text="More actions" direction="n">
        <button
          ref={triggerRef}
          className={styles.featureBtn}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          aria-label="More actions"
          aria-expanded={open}
        >
          <MoreIcon />
        </button>
      </Tooltip>
      {open && (
        <div className={styles.overflowMenu}>
          {menuFeatures.map((feature) => {
            const Icon = ICON_REGISTRY[feature.icon]
            const hasAlt = !!feature.alt
            const label = (altHeld && hasAlt) ? feature.alt.label : (feature.label || feature.action)
            const isDanger = DANGER_ACTIONS.has(feature.action)
            return (
              <button
                key={feature.id}
                disabled={feature.disabled || feature.enabled === false}
                className={`${styles.overflowItem} ${isDanger ? styles.overflowItemDanger : ''}`}
                onClick={(e) => handleItemClick(feature, e)}
              >
                {Icon && <Icon />}
                <span>{label}</span>
                {hasAlt && (
                  <span className={`${styles.altHint} ${altHeld ? styles.altHintActive : ''}`}>⌥ alt</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Dropdown feature — a chevron button that opens a menu of actions.
 * Items and their icons/labels come from config.
 */
function dropdownItemState(item, targets) {
  if (!item.stateProp || !targets?.length) return { checked: false, mixed: false }
  const values = targets.map(target => {
    if (item.stateProp === 'frameThemeOverride' && target.type === 'prototype') {
      try {
        const url = new URL(target.props?.src || '', window.location.href)
        const fromUrl = url.searchParams.get('theme')
        if (fromUrl === 'system') return item.defaultValue
        if (fromUrl) return fromUrl
      } catch { /* use the legacy canvas override */ }
    }
    return target.props?.[item.stateProp] ?? item.defaultValue
  })
  const matches = values.map(value => item.type === 'checkbox'
    ? Boolean(value) === Boolean(item.checkedValue ?? true)
    : value === item.value)
  const checkedCount = matches.filter(Boolean).length
  return { checked: checkedCount === matches.length, mixed: checkedCount > 0 && checkedCount < matches.length }
}

function dropdownItems(feature) {
  if (feature.id !== 'frame-theme') return feature.items || []
  const themes = getConfig('theming')?.themes || {}
  return Object.entries(themes).map(([value, theme]) => ({
    id: `theme-${value}`,
    type: 'radio',
    label: theme?.label || value,
    action: 'set-frame-theme',
    value,
    toggleValue: 'inherit',
    stateProp: 'frameThemeOverride',
    defaultValue: 'inherit',
  }))
}

const DEFAULT_DROPDOWN_ICONS = {
  'frame-device': 'iconoir/computer',
  'frame-theme': 'primer/sun',
}

function DropdownFeature({ feature, widgetRef, targets = [], onAction }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const altHeld = useAltKey()
  // Subscribe only while open. Runtime dropdown state belongs to the widget,
  // rather than persisted canvas props (which would trigger context updates).
  const subscribe = useCallback(listener => open
    ? widgetRef?.current?.subscribeMenuState?.(listener) || (() => {})
    : () => {}, [open, widgetRef])
  const getSnapshot = useCallback(() => open
    ? widgetRef?.current?.getMenuState?.() ?? null : null, [open, widgetRef])
  const menuState = useSyncExternalStore(subscribe, getSnapshot, () => null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const TriggerIcon = ICON_REGISTRY[feature.icon]
    || ICON_REGISTRY[DEFAULT_DROPDOWN_ICONS[feature.id]]
    || ChevronDownIcon

  return (
    <div ref={menuRef} className={styles.overflowWrapper}>
      <Tooltip text={feature.label || 'Actions'} direction="n">
        <button
          className={styles.featureBtn}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          disabled={feature.disabled || feature.enabled === false}
          aria-label={feature.label || 'Actions'}
          aria-expanded={open}
        >
          <TriggerIcon />
        </button>
      </Tooltip>
      {open && (
        <div className={styles.overflowMenu} role="menu" aria-label={feature.label || 'Actions'}>
          {feature.content === 'widget' ? menuState?.[feature.id] : dropdownItems(feature).map((item, index) => {
            if (item.type === 'separator') {
              return <div key={item.id || `${feature.id}-separator-${index}`} className={styles.overflowSeparator} role="separator" />
            }
            const Icon = ICON_REGISTRY[item.icon]
            const hasAlt = !!item.alt
            const label = (altHeld && hasAlt) ? item.alt.label : (item.label || item.action)
            const action = (altHeld && hasAlt) ? item.alt.action : item.action
            const state = dropdownItemState(item, targets)
            // ARIA exposes mixed values for checkbox menu items. A radio item
            // remains checked/unchecked and announces the mixed selection in
            // its description, while the shared visual marker shows a dash.
            const checked = item.type === 'checkbox' && state.mixed
              ? 'mixed'
              : state.checked
            const nextValue = item.type === 'checkbox'
              ? (state.checked ? (item.uncheckedValue ?? false) : (item.checkedValue ?? true))
              : state.checked && item.toggleValue !== undefined ? item.toggleValue : item.value
            return (
              <button
                key={item.id || `${action}-${index}`}
                type="button"
                role={item.type === 'checkbox' ? 'menuitemcheckbox' : item.type === 'radio' ? 'menuitemradio' : undefined}
                aria-checked={item.type === 'checkbox' || item.type === 'radio' ? checked : undefined}
                aria-description={state.mixed ? `Mixed across ${targets.length} selected widgets` : undefined}
                disabled={item.disabled}
                className={`${styles.overflowItem}${state.checked ? ` ${styles.overflowItemChecked}` : ''}${state.mixed ? ` ${styles.overflowItemMixed}` : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onAction?.(action, item.type === 'checkbox'
                    ? { altKey: altHeld, value: nextValue }
                    : { altKey: altHeld, ...(item.value !== undefined ? { value: nextValue } : {}) })
                  setOpen(false)
                }}
              >
                {(item.type === 'checkbox' || item.type === 'radio') && <span className={styles.menuItemState} aria-hidden="true">{state.mixed ? '−' : state.checked ? '✓' : ''}</span>}
                {Icon && <Icon />}
                <span>{label}</span>
                {hasAlt && (
                  <span className={`${styles.altHint} ${altHeld ? styles.altHintActive : ''}`}>⌥ alt</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * ColorPicker feature button — shows a dot that reveals color options on click.
 * Closes on click-outside or Escape.
 */
function ColorPickerFeature({ currentColor, options, onColorChange, disabled = false }) {
  const palette = STICKY_NOTE_COLORS[currentColor] ?? STICKY_NOTE_COLORS.yellow
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handleClickOutside, true)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div
      ref={wrapperRef}
      className={styles.colorPickerWrapper}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        className={styles.featureBtn}
        style={{ background: palette.dot }}
        disabled={disabled}
        aria-expanded={open}
        aria-label="Change color"
        title="Change color"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={styles.colorDotInner} style={{ background: palette.dot }} />
      </button>
      <div className={`${styles.colorPopup} ${open ? styles.colorPopupOpen : ''}`}>
        {(options || Object.keys(STICKY_NOTE_COLORS)).map((colorName) => {
          const c = STICKY_NOTE_COLORS[colorName]
          if (!c) return null
          return (
            <button
              key={colorName}
              className={`${styles.colorOption} ${colorName === currentColor ? styles.colorOptionActive : ''}`}
              style={{ background: c.bg, borderColor: c.border }}
              onClick={(e) => {
                e.stopPropagation()
                onColorChange(colorName)
                setOpen(false)
              }}
              title={colorName}
              aria-label={`Set color to ${colorName}`}
            />
          )
        })}
      </div>
    </div>
  )
}

/** Shared action button, including the existing widget state guards. */
/* eslint-disable react-hooks/refs -- Existing widget action state is exposed through the imperative widget ref. */
function ActionFeature({ feature, widgetType, widgetProps, widgetRef, onAction }) {
  const altHeld = useAltKey()
  let Icon = ICON_REGISTRY[feature.icon]
  let label = feature.label || feature.action

  // Toggle-private: swap icon/label based on current state
  if (feature.action === 'toggle-private') {
    const isTerminal = widgetType === 'terminal' || widgetType === 'agent'
    if (widgetProps?.private) {
      Icon = ICON_REGISTRY['eye-closed']
      label = isTerminal
        ? 'Private terminal — snapshots hidden from git'
        : 'Private image — only visible locally'
    } else {
      label = isTerminal
        ? 'Public terminal — snapshots committed to git'
        : 'Published image — deployed with canvas'
    }
  }

  // Show-code toggle: swap label based on widget state
  if (feature.action === 'show-code' && widgetRef?.current?.getState?.('showCode')) {
    label = 'Show component'
  }

  // Expand-output toggle: swap icon/label, hide when no session
  if (feature.action === 'expand-output') {
    const hasSession = widgetRef?.current?.getState?.('hasSession')
    if (!hasSession) return null
    const isActive = widgetRef?.current?.getState?.('showOutput')
    if (isActive) {
      Icon = ICON_REGISTRY['fold']
      label = 'Hide output'
    } else {
      label = 'Show output'
    }
  }

  // Expand: alt+click → Fullscreen (Immersive)
  if (feature.action === 'expand' && altHeld) {
    label = 'Fullscreen (Immersive)'
  }

  // Open-terminal: hide when no session
  if (feature.action === 'open-terminal') {
    const hasSession = widgetRef?.current?.getState?.('hasSession')
    if (!hasSession) return null
  }

  // Determine active state for toggle buttons
  const isActive = feature.active || (
    feature.action === 'expand-output' && widgetRef?.current?.getState?.('showOutput')
  )

  return (
    <Tooltip text={label} direction="n">
      <button
        disabled={feature.disabled || feature.enabled === false}
        className={`${styles.featureBtn}${isActive ? ` ${styles.featureBtnActive}` : ''}`}
        onClick={(e) => { e.stopPropagation(); onAction?.(feature.action, e) }}
        aria-label={label}
        aria-pressed={feature.toggle ? Boolean(isActive) : undefined}
      >
        {Icon ? <Icon /> : feature.action}
      </button>
    </Tooltip>
  )
}
/* eslint-enable react-hooks/refs */

/** Render a targeted feature inside WidgetChrome's existing feature row. */
function SelectionFeature({ entry: { feature, widgetIds }, widgets, onAction, onPropChange }) {
  let targets = widgets.filter(widget => widgetIds.includes(widget.id))
  if (feature.disabled || feature.enabled === false) return null
  // Mirror the single-widget session guard. A subset action may use only ready
  // targets; an exclusive action requires every selected target to be ready.
  if (feature.action === 'open-terminal' || feature.action === 'expand-output') {
    const ready = targets.filter(widget => widget.widgetRef?.current?.getState?.('hasSession'))
    if (feature.multiSelection?.exclusive !== false && ready.length !== widgetIds.length) return null
    targets = ready
    widgetIds = ready.map(widget => widget.id)
    if (!widgetIds.length) return null
  }
  const dispatch = (action, opts) => onAction?.({ ...feature, action }, widgetIds, opts)
  if (feature.menu) {
    return <WidgetOverflowMenu group menuFeatures={[feature]} onAction={dispatch} />
  }
  if (feature.type === 'color-picker') {
    const colors = targets.map(widget => widget.props?.[feature.prop] || 'yellow')
    const currentColor = colors.every(color => color === colors[0]) ? colors[0] : null
    return <ColorPickerFeature currentColor={currentColor} options={feature.options}
      onColorChange={(value) => onPropChange?.(feature.prop, value, widgetIds)} />
  }
  if (feature.type === 'dropdown' && feature.content !== 'widget') {
    return <DropdownFeature feature={feature} targets={targets} onAction={dispatch} />
  }
  if (feature.type === 'action') {
    return <ActionFeature feature={feature}
      widgetType={targets[0]?.type} widgetProps={targets[0]?.props} widgetRef={targets[0]?.widgetRef}
      onAction={(action, e) => dispatch(action, { altKey: e.altKey })} />
  }
  return null
}

/**
 * WidgetChrome — universal hover toolbar rendered below every canvas widget.
 *
 * Provides:
 * - A trigger dot (visible at rest) that transitions to a toolbar on hover
 * - Feature buttons (left) driven by widget config
 * - A select handle (right) for selection toggling
 * - A purple selection-shaped outline for `nudgeInRange` drop targets,
 *   without activating selection or its controls
 *
 * Widget components can expose imperative action handlers via a ref:
 *   useImperativeHandle(ref, () => ({ handleAction(actionId) { ... } }))
 * WidgetChrome will call widgetRef.current.handleAction(actionId) for
 * non-standard actions (anything other than 'delete').
 *
 * ## Per-widget chrome / interaction switches
 *
 * Three booleans (read from the widget definition by CanvasPage) gate the
 * built-in chrome surface. Defaults match historical behavior so existing
 * widgets are unaffected.
 *
 * - `chromeEnabled` (default true) — When false, the entire WidgetChrome
 *   wrapper short-circuits and renders `children` inside a minimal
 *   `<div data-widget-id>` shell. No toolbar, no anchors, no select handle,
 *   no interact gate. Use this for fully custom client widgets that own
 *   their own visual chrome.
 * - `movable` (default true) — When false, the `tc-drag-surface` class is
 *   omitted from the inner slot so tiny-canvas won't treat the widget as
 *   draggable. Useful for pinned/locked widgets (background stickers,
 *   decorative chrome).
 * - `selectable` (default true) — When false, the select handle button is
 *   not rendered and select-via-handle is unavailable. Canvas-level click
 *   selection (configured elsewhere) is independent of this flag.
 */
export default function WidgetChrome({
  widgetId,
  widgetType,
  features = [],
  selectionActions,
  selectionWidgets = [],
  onSelectionAction,
  onSelectionPropChange,
  selected = false,
  multiSelected = false,
  nudgeInRange = false,
  widgetProps,
  widgetRef,
  onSelect,
  onHandlePointerDown,
  onHandleKeyDown,
  handleLabel,
  onDeselect, // eslint-disable-line no-unused-vars
  onAction,
  onUpdate,
  onConnectorDragStart,
  children,
  readOnly = false,
  chromeEnabled = true,
  movable = true,
  selectable = true,
}) {
  const [hovered, setHovered] = useState(false)
  const leaveTimer = useRef(null)

  const handleMouseEnter = useCallback(() => {
    clearTimeout(leaveTimer.current)
    setHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setHovered(false), 80)
  }, [])

  // Handle select via click — pointer events are intercepted by the drag
  // gate in Draggable, so onPointerDown never reaches React on the handle.
  // onClick fires reliably after pointer up.
  const handleHandleClick = useCallback((e) => {
    e.stopPropagation()
    onSelect?.(e.shiftKey)
  }, [onSelect])

  const handleActionClick = useCallback((actionId, e) => {
    e.stopPropagation()
    // Standard actions go through onAction (handled by CanvasPage)
    if (actionId === 'delete' || actionId === 'copy') {
      onAction?.(actionId, { altKey: e.altKey })
      return
    }
    // Widget-specific actions go through the widget's imperative ref
    if (widgetRef?.current?.handleAction) {
      const handled = widgetRef.current.handleAction(actionId, { altKey: e.altKey })
      if (handled !== false) return
    }
    // Fallback to generic handler
    onAction?.(actionId)
  }, [onAction, widgetRef])

  const handleColorChange = useCallback((color) => {
    onUpdate?.({ color })
  }, [onUpdate])

  // In readOnly mode, features are already filtered to prod-only by getFeatures.
  // Show toolbar if there are prod features even when readOnly.
  const hasFeatures = features.length > 0 || selectionActions?.length > 0
  const showToolbar = (hovered || selected) && (!readOnly || hasFeatures)
  const showFeatures = showToolbar && !multiSelected
  const menuFeatures = features.filter((f) => f.menu)

  // Interact gate — declarative overlay from widgets.config.json
  const gate = widgetType ? getInteractGate(widgetType) : { enabled: false }
  // An unconfigured Site Frame needs to accept clicks on its inline Site
  // picker before the live-preview interact gate becomes relevant.
  const gateEnabled = gate.enabled && !(widgetType === 'site-frame' && !widgetProps?.siteId)
  const [interacting, setInteracting] = useState(false)
  const slotRef = useRef(null)

  // Exit interact mode on click outside or double-Escape
  const lastEscapeRef = useRef(0)
  useEffect(() => {
    if (!gateEnabled || !interacting) return
    const handleMouseDown = (e) => {
      if (slotRef.current && !slotRef.current.contains(e.target)) {
        setInteracting(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        const now = Date.now()
        if (now - lastEscapeRef.current < 500) {
          // Double-Escape: exit interact mode but keep widget selected
          e.stopPropagation()
          e.preventDefault()
          setInteracting(false)
          lastEscapeRef.current = 0
        } else {
          // First Escape: let it pass to widget, record timestamp
          lastEscapeRef.current = now
        }
      }
    }
    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [gateEnabled, interacting])

  // Preserve the existing interact-gate lifecycle when selection ends.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Existing reset behavior; group action extraction does not change the interact gate lifecycle.
    if (!selected && !hovered && interacting) setInteracting(false)
  }, [selected, hovered, interacting])

  const handleGateClick = useCallback((e) => {
    e.stopPropagation()
    setInteracting(true)
    // Also trigger selection so the widget gets selected
    onSelect?.()
    // Widgets can react to gate activation (e.g. Site Frame starts its Site
    // server when the user asks to interact with a stopped Site).
    document.dispatchEvent(new CustomEvent('storyboard:interact-gate-activated', {
      detail: { widgetId, widgetType },
    }))
  }, [onSelect, widgetId, widgetType])

  // ── chrome.enabled: false short-circuit ──
  // Render the widget bare with just a minimal positioning shell. Keep
  // data-widget-id so DOM lookups (anchor port queries, scroll-to-widget,
  // selection state propagation) still work. All hooks above remain in
  // play so React's hook ordering is stable regardless of this flag.
  if (!chromeEnabled) {
    return (
      <div
        className={styles.chromeContainer}
        data-widget-id={widgetId}
        data-widget-type={widgetType}
        data-widget-chrome-disabled
        data-widget-selected={selected || undefined}
        data-widget-nudge-in-range={(nudgeInRange && !selected) || undefined}
      >
        {children}
      </div>
    )
  }

  // Drag surface class is omitted when `movable: false` — tiny-canvas only
  // initiates a drag from elements matching `data-tc-handle=".tc-drag-handle,
  // .tc-drag-surface"`, so dropping the class effectively pins the widget.
  const slotDragClass = movable ? 'tc-drag-surface' : ''

  return (
    <div
      className={styles.chromeContainer}
      data-widget-id={widgetId}
      data-widget-type={widgetType}
      data-widget-nudge-in-range={(nudgeInRange && !selected) || undefined}
      data-tc-elevated={(hovered || selected) || undefined}
      data-agent-status={widgetProps?.status || undefined}
      onMouseEnter={(readOnly && !hasFeatures) ? undefined : handleMouseEnter}
      onMouseLeave={(readOnly && !hasFeatures) ? undefined : handleMouseLeave}
    >
      <div ref={slotRef} className={`${slotDragClass} ${styles.widgetSlot} ${selected ? styles.widgetSlotSelected : ''} ${multiSelected ? styles.widgetSlotMultiSelected : ''}`} data-widget-selected={selected || undefined} data-widget-interacting={interacting || undefined}>
        {children}
        {gateEnabled && !interacting && !readOnly && (
          <div
            className={overlayStyles.interactOverlay}
            data-canvas-interact-gate="true"
            onClick={handleGateClick}
            role="button"
            tabIndex={0}
            aria-label={gate.label}
          >
            <span className={overlayStyles.interactHint}>{gate.label}</span>
          </div>
        )}
      </div>
      {!readOnly && onConnectorDragStart && (() => {
        const connConfig = widgetType ? getConnectorConfig(widgetType) : null
        return ['top', 'bottom', 'left', 'right']
          .filter((a) => !connConfig || connConfig.anchors[a] !== 'unavailable')
          .map((anchor) => {
            const disabled = connConfig?.anchors[anchor] === 'disabled'
            return (
              <div
                key={anchor}
                className={`${styles.anchorPort} ${styles[`anchorPort${anchor[0].toUpperCase()}${anchor.slice(1)}`]} ${disabled ? styles.anchorPortDisabled : ''}`}
                onPointerDown={disabled ? undefined : (e) => {
                  e.stopPropagation()
                  e.nativeEvent?.stopImmediatePropagation?.()
                  e.preventDefault()
                  onConnectorDragStart(widgetId, anchor, e)
                }}
                data-anchor={anchor}
              />
            )
          })
      })()}
      <div
        className={styles.toolbar}
      >
        {/* Trigger dot — visible at rest */}
        <span
          className={`${styles.triggerDot} ${showToolbar ? styles.triggerDotHidden : ''}`}
        />

        {/* Toolbar content — visible on hover */}
        <div className={`${styles.toolbarContent} ${showToolbar ? styles.toolbarContentVisible : ''}`}>
          {showFeatures && (
          <div className={styles.featureButtons}
            role={selectionActions ? 'group' : undefined}
            aria-label={selectionActions ? 'Selection actions' : undefined}
            onPointerDown={selectionActions ? (e) => e.stopPropagation() : undefined}
            onMouseDown={selectionActions ? (e) => e.stopPropagation() : undefined}>
            {selectionActions?.map((entry, index) => (
              <SelectionFeature key={`${entry.feature.id}-${index}`} entry={entry} widgets={selectionWidgets}
                onAction={onSelectionAction} onPropChange={onSelectionPropChange} />
            ))}
            {features.map((feature) => {
              // Menu features are rendered in WidgetOverflowMenu
              if (feature.menu) return null

              if (feature.type === 'color-picker') {
                return (
                  <ColorPickerFeature
                    key={feature.id}
                    currentColor={widgetProps?.[feature.prop] || 'yellow'}
                    options={feature.options}
                    disabled={feature.disabled || feature.enabled === false}
                    onColorChange={handleColorChange}
                  />
                )
              }

              if (feature.type === 'action') {
                return <ActionFeature key={feature.id} feature={feature} widgetType={widgetType}
                  widgetProps={widgetProps} widgetRef={widgetRef} onAction={handleActionClick} />
              }

              if (feature.type === 'dropdown') {
                return (
                  <DropdownFeature
                    key={feature.id}
                    feature={feature}
                    widgetRef={widgetRef}
                    targets={[{ type: widgetType, props: widgetProps }]}
                    onAction={(actionId, opts) => {
                      // A live prototype owns its URL theme state. Give its
                      // frame controller the first chance to apply the change
                      // in place before the legacy prop-only fallback runs.
                      if (actionId === 'set-frame-theme' && widgetRef?.current?.handleAction) {
                        const handled = widgetRef.current.handleAction(actionId, opts)
                        if (handled !== false) return
                      }
                      const frameUpdates = getFrameActionUpdates(
                        widgetType,
                        actionId,
                        opts,
                        widgetProps,
                        getConfig('theming')?.themes || {},
                      )
                      if (frameUpdates) {
                        onUpdate?.(frameUpdates)
                        return
                      }
                      if (widgetRef?.current?.handleAction) {
                        const handled = widgetRef.current.handleAction(actionId, opts)
                        if (handled !== false) return
                      }
                      onAction?.(actionId, opts)
                    }}
                  />
                )
              }

              return null
            })}
            {menuFeatures.length > 0 && (
              <WidgetOverflowMenu
                widgetId={widgetId}
                menuFeatures={menuFeatures}
                onAction={(actionId, opts) => {
                  // Route overflow menu actions through the widget ref first
                  if (actionId !== 'delete' && actionId !== 'copy' && widgetRef?.current?.handleAction) {
                    const handled = widgetRef.current.handleAction(actionId)
                    if (handled !== false) return
                  }
                  onAction?.(actionId, opts)
                }}
              />
            )}
          </div>
          )}

          {!readOnly && selectable && !multiSelected && (
            <div className={styles.selectHandleSlot}>
              <Tooltip text={selected ? (movable ? "Click and drag to move" : "Selected") : "Select"} direction="n">
                <button
                  className={`${movable ? 'tc-drag-handle ' : ''}${styles.selectHandle} ${selected ? styles.selectHandleActive : ''}`}
                  onClick={handleHandleClick}
                  onPointerDown={onHandlePointerDown}
                  onKeyDown={onHandleKeyDown}
                  aria-label={handleLabel || (selected ? (movable ? "Drag to move widget" : "Widget selected") : "Select widget")}
                  aria-pressed={selected}
                />
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
