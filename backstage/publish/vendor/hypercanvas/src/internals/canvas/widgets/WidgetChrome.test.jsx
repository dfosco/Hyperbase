import { afterEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import WidgetChrome from './WidgetChrome.jsx'
import { getFeatures, getMultiSelectionFeatures } from './widgetConfig.js'
import { getConfig, initConfig } from '../../../core/stores/configStore.ts'
import styles from './WidgetChrome.module.css'

const originalConfig = getConfig()

afterEach(() => initConfig(originalConfig))

function renderChrome(extra = {}) {
  return render(
    <WidgetChrome widgetId="w1" widgetType="sticky-note" {...extra}>
      <div data-testid="inner">inner</div>
    </WidgetChrome>
  )
}


// Group selection uses the same WidgetChrome and its existing toolbar/handle.
function SelectionChrome({ actions, widgets, onAction, onPropChange, ...props }) {
  return <WidgetChrome selected selectionActions={actions} selectionWidgets={widgets}
    onSelectionAction={onAction} onSelectionPropChange={onPropChange}
    handleLabel="Move selected widgets" {...props}><div style={{ width: 100, height: 100 }} /></WidgetChrome>
}

describe('WidgetChrome chrome/interaction switches', () => {
  it('renders the full chrome shell by default', () => {
    const { container, getByTestId } = renderChrome()
    expect(getByTestId('inner')).toBeTruthy()
    expect(container.querySelector('[data-widget-id="w1"]')).toBeTruthy()
    expect(container.querySelector('[data-widget-type="sticky-note"]')).toBeTruthy()
    // Drag surface is present (allows tiny-canvas drag) and select handle exists
    expect(container.querySelector('.tc-drag-surface')).toBeTruthy()
    expect(container.querySelector('.tc-drag-handle')).toBeTruthy()
    // Not flagged as chrome-disabled
    expect(container.querySelector('[data-widget-chrome-disabled]')).toBeNull()
  })

  it('chromeEnabled=false short-circuits to a minimal shell', () => {
    const { container, getByTestId } = renderChrome({ chromeEnabled: false })
    expect(getByTestId('inner')).toBeTruthy()
    const root = container.querySelector('[data-widget-id="w1"]')
    expect(root).toBeTruthy()
    expect(root.hasAttribute('data-widget-chrome-disabled')).toBe(true)
    expect(root.getAttribute('data-widget-type')).toBe('sticky-note')
    // No toolbar, no anchors, no select handle
    expect(container.querySelector('.tc-drag-surface')).toBeNull()
    expect(container.querySelector('.tc-drag-handle')).toBeNull()
    // Inner content rendered directly
    expect(root.contains(getByTestId('inner'))).toBe(true)
  })

  it('chromeEnabled=false propagates selected state for custom widgets', () => {
    const { container } = renderChrome({ chromeEnabled: false, selected: true })
    const root = container.querySelector('[data-widget-id="w1"]')
    expect(root.getAttribute('data-widget-selected')).toBe('true')
  })

  it('marks a nearby widget without selecting it or activating its toolbar', () => {
    const onSelect = vi.fn()
    const { container, queryByRole, rerender } = renderChrome({
      nudgeInRange: true,
      onSelect,
      features: [{ id: 'copy', type: 'button', action: 'copy', label: 'Copy widget' }],
      onConnectorDragStart: vi.fn(),
    })
    const root = container.querySelector('[data-widget-id="w1"]')
    expect(root.getAttribute('data-widget-nudge-in-range')).toBe('true')
    expect(root.hasAttribute('data-tc-elevated')).toBe(false)
    expect(container.querySelector('[data-widget-selected]')).toBeNull()
    expect(queryByRole('button', { name: 'Select widget' }).getAttribute('aria-pressed')).toBe('false')
    expect(queryByRole('button', { name: 'Copy widget' })).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()

    rerender(<WidgetChrome widgetId="w1" widgetType="sticky-note">inner</WidgetChrome>)
    expect(root.hasAttribute('data-widget-nudge-in-range')).toBe(false)
  })

  it.each([true, false])('keeps selected styling when chromeEnabled=%s and the widget is in nudge range', (chromeEnabled) => {
    const { container } = renderChrome({ chromeEnabled, selected: true, nudgeInRange: true })
    expect(container.querySelector('[data-widget-selected="true"]')).toBeTruthy()
    expect(container.querySelector('[data-widget-nudge-in-range]')).toBeNull()
  })

  it('marks chrome-disabled widgets in range without adding toolbar or anchors', () => {
    const { container } = renderChrome({ chromeEnabled: false, nudgeInRange: true, onConnectorDragStart: vi.fn() })
    const root = container.querySelector('[data-widget-id="w1"]')
    expect(root.getAttribute('data-widget-nudge-in-range')).toBe('true')
    expect(root.hasAttribute('data-widget-selected')).toBe(false)
    expect(root.querySelector('button')).toBeNull()
    expect(root.querySelector('[data-anchor]')).toBeNull()
  })

  it('movable=false omits the tc-drag-surface class from the slot', () => {
    const { container } = renderChrome({ movable: false })
    expect(container.querySelector('.tc-drag-surface')).toBeNull()
    // Select handle still renders (selectable default true) and is no longer
    // a drag handle — should NOT carry tc-drag-handle.
    const handle = container.querySelector('button[aria-label*="Select"], button[aria-label*="selected"], button[aria-pressed]')
    expect(handle).toBeTruthy()
    expect(handle.className.includes('tc-drag-handle')).toBe(false)
  })

  it('selectable=false hides the select handle', () => {
    const { container } = renderChrome({ selectable: false })
    // The select-handle button has aria-pressed; no other button in chrome
    // exposes aria-pressed by default (color picker, etc. use aria-label only)
    expect(container.querySelector('button[aria-pressed]')).toBeNull()
  })

  it('leaves multi-selected widgets to the sole group handle without changing content', () => {
    const { container, getByTestId } = renderChrome({ selected: true, multiSelected: true })
    expect(container.querySelector('.tc-drag-handle')).toBeNull()
    expect(container.querySelector('[data-widget-selected="true"]')).toBeTruthy()
    expect(getByTestId('inner')).toBeTruthy()
  })

  it('chromeEnabled=false skips select handle even when selectable=true', () => {
    const { container } = renderChrome({ chromeEnabled: false, selectable: true })
    expect(container.querySelector('button[aria-pressed]')).toBeNull()
  })

  it('dispatches a gate-activated event when the interact gate is clicked', () => {
    const activated = vi.fn()
    document.addEventListener('storyboard:interact-gate-activated', activated)
    const { getByRole, container } = renderChrome({ widgetType: 'site-frame', widgetId: 'frame-9', widgetProps: { siteId: 'docs' }, selected: true })
    fireEvent.click(getByRole('button', { name: 'Click to interact' }))
    expect(activated).toHaveBeenCalledTimes(1)
    expect(activated.mock.calls[0][0].detail).toEqual({ widgetId: 'frame-9', widgetType: 'site-frame' })
    expect(container.querySelector('[data-widget-interacting]')).toBeTruthy()
    document.removeEventListener('storyboard:interact-gate-activated', activated)
  })

  it('leaves the interact gate off while an empty Site Frame is choosing a Site', () => {
    const { queryByRole } = renderChrome({ widgetType: 'site-frame', widgetProps: {} })
    expect(queryByRole('button', { name: 'Click to interact' })).toBeNull()
  })

  it('exits interaction when deselected and still restores the gate', () => {
    const { getByRole, container, rerender } = renderChrome({ widgetType: 'site-frame', widgetProps: { siteId: 'docs' }, selected: true })
    fireEvent.click(getByRole('button', { name: 'Click to interact' }))
    expect(container.querySelector('[data-widget-interacting]')).toBeTruthy()
    rerender(<WidgetChrome widgetId="w1" widgetType="site-frame" widgetProps={{ siteId: 'docs' }}>inner</WidgetChrome>)
    expect(container.querySelector('[data-widget-interacting]')).toBeNull()
    expect(getByRole('button', { name: 'Click to interact' })).toBeTruthy()
  })

  it.each([{ disabled: true }, { enabled: false }])('keeps unavailable single-widget actions disabled: %j', guard => {
    const onAction = vi.fn()
    const { getByRole } = renderChrome({ selected: true, onAction, features: [{ id: 'run', type: 'action', action: 'run', label: 'Run', ...guard }] })
    fireEvent.click(getByRole('button', { name: 'Run' }))
    expect(onAction).not.toHaveBeenCalled()
  })
})

describe('WidgetChrome selection controls', () => {
  it('uses the existing toolbar, feature row and drag handle for grid and selection actions', () => {
    const onAction = vi.fn()
    const onHandlePointerDown = vi.fn()
    const onHandleKeyDown = vi.fn()
    const feature = { id: 'arrange-grid', type: 'action', action: 'arrange-grid', label: 'Arrange selected widgets as grid', icon: 'grid' }
    const { container, getByRole } = render(<SelectionChrome actions={[{ feature, widgetIds: ['a', 'b'] }]}
      onAction={onAction} onHandlePointerDown={onHandlePointerDown} onHandleKeyDown={onHandleKeyDown} />)
    expect(container.querySelectorAll(`.${styles.toolbar}`)).toHaveLength(1)
    const row = getByRole('group', { name: 'Selection actions' })
    expect(row.classList.contains(styles.featureButtons)).toBe(true)
    expect(row.parentElement.classList.contains(styles.toolbarContent)).toBe(true)
    const grid = getByRole('button', { name: 'Arrange selected widgets as grid' })
    expect(grid.classList.contains(styles.featureBtn)).toBe(true)
    fireEvent.click(grid)
    expect(onAction).toHaveBeenCalledExactlyOnceWith(feature, ['a', 'b'], { altKey: false })
    const handle = getByRole('button', { name: 'Move selected widgets' })
    expect(handle.classList.contains(styles.selectHandle)).toBe(true)
    fireEvent.pointerDown(handle, { button: 0 })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onHandlePointerDown).toHaveBeenCalledOnce()
    expect(onHandleKeyDown).toHaveBeenCalledOnce()
  })

  it('updates every eligible selected sticky through the shared color picker', () => {
    const onPropChange = vi.fn()
    const widgets = [{ id: 's1', type: 'sticky-note', props: { color: 'blue' } }, { id: 's2', type: 'sticky-note', props: { color: 'green' } }]
    const { getByRole } = render(<SelectionChrome widgets={widgets} actions={getMultiSelectionFeatures(widgets)} onPropChange={onPropChange} />)
    expect(getByRole('group', { name: 'Selection actions' })).toBeTruthy()
    fireEvent.click(getByRole('button', { name: 'Change color' }))
    fireEvent.click(getByRole('button', { name: 'Set color to purple' }))
    expect(onPropChange).toHaveBeenCalledExactlyOnceWith('color', 'purple', ['s1', 's2'])
  })

  it('leaves sticky color absent for a mixed selection under default exclusivity', () => {
    const widgets = [{ id: 's1', type: 'sticky-note' }, { id: 'm1', type: 'markdown' }]
    const { queryByRole } = render(<SelectionChrome widgets={widgets} actions={getMultiSelectionFeatures(widgets)} />)
    expect(queryByRole('button', { name: 'Change color' })).toBeNull()
  })

  it('dispatches a custom subset action with its feature, eligible IDs and modifier state', () => {
    const onAction = vi.fn()
    const feature = { id: 'run', type: 'action', label: 'Run', action: 'run', multiSelection: { exclusive: false } }
    const { getByRole } = render(<SelectionChrome actions={[{ feature, widgetIds: ['a'] }]} onAction={onAction} />)
    fireEvent.click(getByRole('button', { name: 'Run' }), { altKey: true })
    expect(onAction).toHaveBeenCalledExactlyOnceWith(feature, ['a'], { altKey: true })
  })

  it('reuses static dropdown items without dispatching disabled entries', () => {
    const onAction = vi.fn()
    const feature = { id: 'commands', type: 'dropdown', label: 'Commands', multiSelection: {}, items: [{ label: 'Run', action: 'run' }, { label: 'Delete', action: 'delete', disabled: true }] }
    const { getByRole } = render(<SelectionChrome actions={[{ feature, widgetIds: ['a', 'b'] }]} onAction={onAction} />)
    fireEvent.click(getByRole('button', { name: 'Commands' }))
    fireEvent.click(getByRole('button', { name: 'Delete' }))
    expect(onAction).not.toHaveBeenCalled()
    fireEvent.click(getByRole('button', { name: 'Run' }))
    expect(onAction).toHaveBeenCalledExactlyOnceWith({ ...feature, action: 'run' }, ['a', 'b'], { altKey: false })
  })

  it('shows mixed per-frame Theme state and dispatches through the canonical selection dropdown', () => {
    initConfig({ ...originalConfig, theming: { themes: { light: { label: 'Light' }, dark: { label: 'Dark' } } } })
    const widgets = [
      { id: 'p', type: 'prototype', props: { frameThemeOverride: 'dark' } },
      { id: 'c', type: 'component', props: { frameThemeOverride: null } },
    ]
    const actions = getMultiSelectionFeatures(widgets)
    const onAction = vi.fn()
    const { getByRole } = render(<SelectionChrome widgets={widgets} actions={actions} onAction={onAction} />)

    fireEvent.click(getByRole('button', { name: 'Theme' }))
    const menu = getByRole('menu', { name: 'Theme' })
    const dark = menu.querySelector('[role="menuitemradio"]:nth-of-type(2)')
    expect(menu.querySelectorAll('[role="menuitemradio"]')).toHaveLength(2)
    const darkItem = [...menu.querySelectorAll('[role="menuitemradio"]')].find(item => item.textContent.includes('Dark'))
    expect(darkItem).toHaveAttribute('aria-checked', 'false')
    expect(darkItem).toHaveAttribute('aria-description', 'Mixed across 2 selected widgets')
    expect(darkItem.querySelector('span[aria-hidden="true"]')).toHaveTextContent('−')
    expect(dark).toBeTruthy()

    fireEvent.click(darkItem)
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { ...actions.find(entry => entry.feature.id === 'frame-theme').feature, action: 'set-frame-theme' },
      ['p', 'c'],
      { altKey: false, value: 'dark' },
    )
  })

  it.each(['light', 'dark'])('clears a checked single-frame Theme (%s) back to inheritance', override => {
    initConfig({ ...originalConfig, theming: { themes: { light: { label: 'Light' }, dark: { label: 'Dark' } } } })
    const onUpdate = vi.fn()
    render(<WidgetChrome
      widgetId="prototype"
      widgetType="prototype"
      widgetProps={{ frameThemeOverride: override, frameDevice: 'mobile', width: 390 }}
      features={getFeatures('prototype')}
      selected
      onUpdate={onUpdate}
    >frame</WidgetChrome>)

    fireEvent.click(document.querySelector('[aria-label="Theme"]'))
    const menu = document.querySelector('[role="menu"][aria-label="Theme"]')
    expect([...menu.querySelectorAll('[role="menuitemradio"]')].map(item => item.textContent.replace('✓', '').trim()))
      .toEqual(['Light', 'Dark'])
    expect(menu.textContent).not.toContain('Use app theme')
    fireEvent.click(menu.querySelector(`[role="menuitemradio"][aria-checked="true"]`))
    expect(onUpdate).toHaveBeenLastCalledWith({ frameThemeOverride: null })
  })

  it('switches a single-frame Theme override between Light and Dark', () => {
    initConfig({ ...originalConfig, theming: { themes: { light: { label: 'Light' }, dark: { label: 'Dark' } } } })
    const onUpdate = vi.fn()
    render(<WidgetChrome
      widgetId="prototype"
      widgetType="prototype"
      widgetProps={{ frameThemeOverride: 'light' }}
      features={getFeatures('prototype')}
      selected
      onUpdate={onUpdate}
    >frame</WidgetChrome>)

    fireEvent.click(document.querySelector('[aria-label="Theme"]'))
    fireEvent.click(document.querySelector('[role="menuitemradio"]:not([aria-checked="true"])'))
    expect(onUpdate).toHaveBeenLastCalledWith({ frameThemeOverride: 'dark' })
  })

  it('shows the authored prototype URL theme as the selected frame theme', () => {
    initConfig({ ...originalConfig, theming: { themes: { light: { label: 'Light' }, dark: { label: 'Dark' } } } })
    window.history.replaceState(null, '', '/Canvas?theme=light')
    const view = render(<WidgetChrome
      widgetId="prototype"
      widgetType="prototype"
      widgetProps={{ src: '/Demo?theme=dark', frameThemeOverride: null }}
      features={getFeatures('prototype')}
      selected
    >frame</WidgetChrome>)

    fireEvent.click(view.getByRole('button', { name: 'Theme' }))
    const menu = view.getByRole('menu', { name: 'Theme' })
    const dark = [...menu.querySelectorAll('[role="menuitemradio"]')].find(item => item.textContent.includes('Dark'))
    expect(dark).toHaveAttribute('aria-checked', 'true')
  })

  it('routes a prototype theme choice through the live frame controller', () => {
    initConfig({ ...originalConfig, theming: { themes: { light: { label: 'Light' }, dark: { label: 'Dark' } } } })
    const handleAction = vi.fn(() => true)
    const onUpdate = vi.fn()
    const view = render(<WidgetChrome
      widgetId="prototype"
      widgetType="prototype"
      widgetProps={{ src: '/Demo', frameThemeOverride: null }}
      widgetRef={{ current: { handleAction } }}
      features={getFeatures('prototype')}
      selected
      onUpdate={onUpdate}
    >frame</WidgetChrome>)

    fireEvent.click(view.getByRole('button', { name: 'Theme' }))
    fireEvent.click(view.getByRole('menuitemradio', { name: 'Dark' }))
    expect(handleAction).toHaveBeenCalledWith('set-frame-theme', { altKey: false, value: 'dark' })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('uses configured frame icons and feature-id defaults for iconless legacy features', async () => {
    const prototypeFeatures = getFeatures('prototype')
    const componentFeatures = getFeatures('component')
    const siteFeatures = getFeatures('site-frame')
    expect(prototypeFeatures.find(feature => feature.id === 'frame-theme').icon).toBe('primer/sun')
    expect(componentFeatures.find(feature => feature.id === 'frame-theme').icon).toBe('primer/sun')
    expect(prototypeFeatures.find(feature => feature.id === 'frame-device').icon).toBe('iconoir/computer')
    expect(siteFeatures.find(feature => feature.id === 'frame-device').icon).toBe('iconoir/computer')
    expect(prototypeFeatures.find(feature => feature.id === 'frame-theme').items.map(item => item.label)).toEqual(['Light', 'Dark'])

    const { getByRole, unmount } = renderChrome({
      widgetType: 'prototype',
      selected: true,
      features: [
        { id: 'frame-theme', type: 'dropdown', label: 'Theme' },
        { id: 'frame-device', type: 'dropdown', label: 'Device' },
      ],
    })
    await waitFor(() => expect(getByRole('button', { name: 'Theme' }).querySelector('svg')).toHaveAttribute('viewBox', '0 0 16 16'))
    expect(getByRole('button', { name: 'Device' }).querySelector('svg')).toHaveAttribute('viewBox', '0 0 24 24')
    unmount()

    const { getByRole: getCustomRole } = renderChrome({
      widgetType: 'prototype',
      selected: true,
      features: [{ id: 'frame-device', type: 'dropdown', label: 'Device', icon: 'camera' }],
    })
    const customIcon = getCustomRole('button', { name: 'Device' }).querySelector('svg')
    expect(customIcon).toHaveAttribute('viewBox', '0 0 16 16')
    expect(customIcon.querySelectorAll('path')).toHaveLength(1)
  })

  it('labels the prototype route action Switch prototype and renders its switch icon', () => {
    const feature = getFeatures('prototype').find(item => item.id === 'edit-url')
    expect(feature).toMatchObject({ action: 'edit', label: 'Switch prototype', icon: 'iconoir/arrow-separate' })

    const { getByRole } = renderChrome({ widgetType: 'prototype', selected: true, features: [feature] })
    const button = getByRole('button', { name: 'Switch prototype' })
    expect(button.querySelector('svg')).toHaveAttribute('viewBox', '0 0 24 24')
    expect(button.querySelectorAll('svg path')).toHaveLength(2)
  })

  it('keeps a checked Device radio selected when clicked again', () => {
    const onUpdate = vi.fn()
    render(<WidgetChrome
      widgetId="prototype"
      widgetType="prototype"
      widgetProps={{ frameDevice: 'mobile', width: 390 }}
      features={getFeatures('prototype')}
      selected
      onUpdate={onUpdate}
    >frame</WidgetChrome>)

    fireEvent.click(document.querySelector('[aria-label="Device"]'))
    fireEvent.click(document.querySelector('[role="menuitemradio"][aria-checked="true"]'))
    expect(onUpdate).toHaveBeenLastCalledWith({ frameDevice: 'mobile', width: 390 })
  })

  it('keeps Device presets, mixed Clip height and the separator in the same dropdown', () => {
    const widgets = [
      { id: 'p', type: 'prototype', props: { frameDevice: 'desktop', frameClipHeight: true } },
      { id: 's', type: 'site-frame', props: { frameDevice: 'mobile', frameClipHeight: false } },
    ]
    const actions = getMultiSelectionFeatures(widgets)
    const onAction = vi.fn()
    const { getByRole } = render(<SelectionChrome widgets={widgets} actions={actions} onAction={onAction} />)

    fireEvent.click(getByRole('button', { name: 'Device' }))
    const menu = getByRole('menu', { name: 'Device' })
    expect(menu.querySelector('[role="separator"]')).toBeTruthy()
    const clip = getByRole('menuitemcheckbox', { name: 'Clip height' })
    expect(clip).toHaveAttribute('aria-checked', 'mixed')
    expect(clip).toHaveAttribute('aria-description', 'Mixed across 2 selected widgets')
    fireEvent.click(clip)
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { ...actions.find(entry => entry.feature.id === 'frame-device').feature, action: 'set-frame-clip-height' },
      ['p', 's'],
      { altKey: false, value: true },
    )
  })

  it('routes group overflow actions to the group instead of single-widget clipboard behavior', () => {
    const onAction = vi.fn()
    const feature = { id: 'copy', type: 'action', menu: true, label: 'Copy', action: 'copy', multiSelection: {} }
    const { getByRole } = render(<SelectionChrome actions={[{ feature, widgetIds: ['a', 'b'] }]} onAction={onAction} />)
    fireEvent.click(getByRole('button', { name: 'More actions' }))
    fireEvent.click(getByRole('button', { name: 'Copy' }))
    expect(onAction).toHaveBeenCalledExactlyOnceWith(feature, ['a', 'b'], { altKey: false })
  })

  it('hides unavailable features and enforces the existing session action guard', () => {
    const feature = { id: 'terminal', type: 'action', label: 'Terminal', action: 'open-terminal', multiSelection: {} }
    const widgets = [{ id: 'a', widgetRef: { current: { getState: () => true } } }, { id: 'b', widgetRef: { current: { getState: () => false } } }]
    const { queryByRole, rerender } = render(<SelectionChrome widgets={widgets} actions={[{ feature, widgetIds: ['a', 'b'] }]} />)
    expect(queryByRole('button', { name: 'Terminal' })).toBeNull()
    const onAction = vi.fn()
    rerender(<SelectionChrome widgets={widgets} actions={[{ feature: { ...feature, multiSelection: { exclusive: false } }, widgetIds: ['a', 'b'] }]} onAction={onAction} />)
    fireEvent.click(queryByRole('button', { name: 'Terminal' }))
    expect(onAction.mock.calls[0][1]).toEqual(['a'])
    rerender(<SelectionChrome actions={[{ feature: { ...feature, disabled: true }, widgetIds: ['a'] }]} />)
    expect(queryByRole('button', { name: 'Terminal' })).toBeNull()
  })

  it('preserves single-widget action ref routing after sharing the button renderer', () => {
    const handleAction = vi.fn()
    const { getByRole } = renderChrome({ selected: true, widgetRef: { current: { handleAction } }, features: [{ id: 'run', type: 'action', action: 'run', label: 'Run' }] })
    fireEvent.click(getByRole('button', { name: 'Run' }), { altKey: true })
    expect(handleAction).toHaveBeenCalledExactlyOnceWith('run', { altKey: true })
  })
})
