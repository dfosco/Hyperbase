import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import WidgetChrome from './widgets/WidgetChrome.jsx'
import ConnectorLayer from './ConnectorLayer.jsx'
import { squadFeatures, squadConnectors } from './squadControls.js'
import { setSquadBroadcast } from './canvasApi.js'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const widgets = [
  { id: 'leader', type: 'agent', position: { x: 100, y: 100 }, props: { width: 500, height: 300 } },
  { id: 'peer', type: 'agent', position: { x: 800, y: 100 }, props: { alias: 'Research', width: 500, height: 300 } },
]
const squad = { squadId: 'squad-test', name: 'Research Squad', leaderId: 'leader', members: { leader: {}, peer: {} }, activeMemberIds: ['leader', 'peer'], broadcast: { canvasId: 'welcome', enabled: true }, work: [{ state: 'awaiting_leader_ack' }] }

describe('Squad relationship controls', () => {
  it('offers broadcast before membership exists and exposes a pressed toggle without a composer', () => {
    const off = squadFeatures(widgets[0], [], widgets)
    const onAction = vi.fn()
    const view = render(<WidgetChrome widgetId="leader" widgetType="agent" selected features={off} onAction={onAction}>Agent input</WidgetChrome>)
    const toggle = view.getByRole('button', { name: /Turn broadcast on/ })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.querySelector('svg')).toBeTruthy()
    fireEvent.click(toggle)
    expect(onAction).toHaveBeenCalledWith('squad-broadcast:on')
    expect(view.queryByRole('dialog')).toBeNull()
    expect(view.queryByRole('textbox')).toBeNull()
  })

  it('keeps peer actions in one dropdown and renders SVGs rather than raw action IDs', () => {
    const onAction = vi.fn()
    const features = squadFeatures(widgets[0], [squad], widgets)
    expect(features).toHaveLength(2)
    const view = render(<WidgetChrome widgetId="leader" widgetType="agent" selected features={features} onAction={onAction}>Agent input</WidgetChrome>)
    expect(view.getByRole('button', { name: /Turn broadcast off/ }).getAttribute('aria-pressed')).toBe('true')
    expect(view.queryByRole('button', { name: 'Promote Research' })).toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'Squad status and actions' }))
    expect(view.getByRole('button', { name: /1 pending · 0 done/ })).toBeTruthy()
    const promote = view.getByRole('button', { name: 'Promote Research' })
    expect(promote.querySelector('svg')).toBeTruthy()
    expect(view.getByRole('button', { name: 'Nudge Research' }).querySelector('svg')).toBeTruthy()
    expect(view.container.textContent).not.toContain('squad-promote:')
    expect(view.container.textContent).not.toContain('squad-refresh')
    fireEvent.click(promote)
    expect(onAction).toHaveBeenCalledWith('squad-promote:squad-test:peer', expect.any(Object))
  })

  it('marks only active agent relationships as dotted and removes that marker when off', () => {
    const connections = [{ id: 'edge', start: { widgetId: 'leader', anchor: 'right' }, end: { widgetId: 'peer', anchor: 'left' } }]
    const active = squadConnectors(connections, { leader: [squad] })
    const view = render(<ConnectorLayer widgets={widgets} connectors={active} />)
    expect(view.container.querySelectorAll('[data-connector-id="edge"][data-squad-broadcast="true"]')).toHaveLength(2)
    const disabled = squadConnectors(connections, { leader: [{ ...squad, activeMemberIds: [], broadcast: { ...squad.broadcast, enabled: false } }] })
    view.rerender(<ConnectorLayer widgets={widgets} connectors={disabled} />)
    expect(view.container.querySelector('[data-squad-broadcast]')).toBeNull()
    expect(view.container.querySelector('[data-connector-id="edge"]')).toBeTruthy()
    const docEdge = [{ ...connections[0], end: { widgetId: 'document', anchor: 'left' } }]
    expect(squadConnectors(docEdge, { leader: [squad] })[0]).toBe(docEdge[0])
  })

  it('keeps the group off switch reachable when a member is disconnected', () => {
    const features = squadFeatures(widgets[1], [{ ...squad, activeMemberIds: ['leader'] }], widgets)
    expect(features[0]).toMatchObject({ active: true, action: 'squad-broadcast:off:squad-test' })
    expect(features[1].items).toMatchObject([{ label: 'Research Squad · Disconnected from peers' }])
  })

  it('uses branch-prefixed Core routes and propagates a failed mode update', async () => {
    vi.stubEnv('BASE_URL', '/branch--squad-fix/')
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetch)
    await setSquadBroadcast('welcome', 'leader', false, 'squad-test')
    expect(fetch).toHaveBeenCalledWith('/branch--squad-fix/_hypercanvas/messages/broadcast', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ canvasId: 'welcome', widgetId: 'leader', enabled: false, squadId: 'squad-test' }),
    }))
    fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Connect another agent' }) })
    await expect(setSquadBroadcast('welcome', 'leader', true)).rejects.toThrow('Connect another agent')
  })
})
