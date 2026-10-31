/** Squad toolbar and connector presentation share Core's effective participants. */
export function isSquadBroadcastOn(squad, widgetId) {
  return squad.broadcast?.enabled !== false && (squad.activeMemberIds || []).includes(widgetId)
    && squad.activeMemberIds.length > 1
}

export function squadFeatures(widget, memberships, widgets) {
  // A disconnected member can still switch its group's persisted mode off.
  const active = memberships.find((squad) => squad.broadcast?.enabled === true || isSquadBroadcastOn(squad, widget.id))
  const features = [{
    id: 'squad-broadcast', type: 'action', icon: 'broadcast', active: !!active,
    action: `squad-broadcast:${active ? 'off' : 'on'}${active ? `:${active.squadId}` : ''}`,
    label: active ? 'Turn broadcast off — keep visual connections' : 'Turn broadcast on — connect agents as a Squad',
    toggle: true,
  }]
  const items = []
  for (const squad of memberships) {
    if (!isSquadBroadcastOn(squad, widget.id)) {
      if (squad.broadcast?.enabled) items.push({ action: 'squad-refresh', icon: 'sync', label: `${squad.name || 'Squad'} · Disconnected from peers` })
      continue
    }
    const work = squad.work || []
    const pending = work.filter((entry) => entry.state !== 'completed').length
    const completed = work.filter((entry) => entry.state === 'completed').length
    items.push({
      action: 'squad-refresh', icon: 'sync',
      label: `${squad.name || 'Squad'} · ${pending} pending · ${completed} done · ${squad.deliveryCounts?.failed || 0} failed · ${squad.pendingPermissions?.length || 0} permissions`,
    })
    if (squad.leaderId !== widget.id) continue
    for (const memberId of squad.activeMemberIds) {
      if (memberId === widget.id) continue
      const peer = widgets.find((item) => item.id === memberId)
      const label = peer?.props?.alias || peer?.props?.prettyName || memberId
      items.push({ action: `squad-promote:${squad.squadId}:${memberId}`, label: `Promote ${label}`, icon: 'crown' },
        { action: `squad-nudge:${squad.squadId}:${memberId}`, label: `Nudge ${label}`, icon: 'send' })
    }
  }
  if (items.length) features.push({ id: 'squad-controls', type: 'dropdown', icon: 'chat', label: 'Squad status and actions', items })
  return features
}

export function squadConnectors(connectors, stateByWidget) {
  return connectors.map((connector) => {
    const startId = connector.start?.widgetId
    const endId = connector.end?.widgetId
    const active = (stateByWidget[startId] || []).some((squad) => isSquadBroadcastOn(squad, startId)
      && squad.activeMemberIds.includes(endId))
    return active ? { ...connector, data: { ...connector.data, 'squad-broadcast': 'true' } } : connector
  })
}
