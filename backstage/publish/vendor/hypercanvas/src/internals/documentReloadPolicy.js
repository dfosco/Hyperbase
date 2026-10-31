import { reportDesktopModuleRecovery } from '../core/notebook/browserBridge.js'

const HEARTBEAT_MS = 3000
const executableActions = new Set(['retry-core', 'reload-page'])
const supportedActions = new Set(['retry-core', 'reload-page', 'restart-app', 'open-diagnostics'])

function sameRuntimeEvidence(left, right) {
  return Boolean(left && right
    && left.schemaVersion === 1 && right.schemaVersion === 1
    && left.sequence === right.sequence
    && left.phase === right.phase
    && left.incident?.incidentId === right.incident?.incidentId
    && left.incident?.correlationId === right.incident?.correlationId)
}

function hasReloadPermission(snapshot, expected) {
  return sameRuntimeEvidence(snapshot, expected)
    && snapshot.actions?.includes('reload-page') === true
}

function hasActionPermission(snapshot, expected, action) {
  return isSupportedSnapshot(snapshot) && isSupportedSnapshot(expected)
    && sameRuntimeEvidence(snapshot, expected)
    && sameActionSet(snapshot?.actions, expected?.actions)
    && snapshot.actions?.includes(action) === true
}

function sameActionSet(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every(action => right.includes(action))
}

function isSupportedSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    || snapshot.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 1
    || typeof snapshot.phase !== 'string' || !Array.isArray(snapshot.actions)
    || snapshot.actions.some(action => typeof action !== 'string' || !supportedActions.has(action))) return false
  if (snapshot.incident === null) return true
  return Boolean(snapshot.incident && typeof snapshot.incident === 'object'
    && typeof snapshot.incident.incidentId === 'string'
    && typeof snapshot.incident.correlationId === 'string')
}

function sameSnapshot(left, right) {
  return sameRuntimeEvidence(left, right)
    && sameActionSet(left?.actions, right?.actions)
    && JSON.stringify(left?.incident ?? null) === JSON.stringify(right?.incident ?? null)
}

function newRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `reload-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Register this document with Vite's single document reload policy and expose
 * a guarded adapter for typed desktop recovery reloads.
 */
export function createDocumentReloadPolicy({
  hot,
  role,
  targetId,
  configurationAutoReload = false,
  authorizeAction,
  getCurrentSnapshot,
  isUnsavedStateKnownClean,
  isTargetLive,
  getCurrentUrl = () => globalThis.location?.href ?? '',
  navigate = () => globalThis.location?.reload(),
  setPending = () => {},
  requestId = newRequestId,
}) {
  const registration = { instance: Symbol('document-registration'), generation: 1 }
  let active = true
  let heartbeat = null
  const consumedRequestIds = new Set()
  const activeAuthorizations = new Set()

  function currentConfigurationPreference() {
    return typeof configurationAutoReload === 'function'
      ? configurationAutoReload() === true
      : configurationAutoReload === true
  }

  function publish(activeValue = true) {
    hot?.send('storyboard:document-policy', {
      schemaVersion: 1,
      active: activeValue,
      role,
      targetId,
      configurationAutoReload: currentConfigurationPreference(),
    })
  }

  if (hot) {
    publish()
    heartbeat = setInterval(() => publish(), HEARTBEAT_MS)
  }

  function refresh() {
    if (active) publish()
  }

  function dispose() {
    if (!active) return
    active = false
    registration.generation += 1
    if (heartbeat !== null) clearInterval(heartbeat)
    heartbeat = null
    publish(false)
  }

  function canAuthorizeRecoveryAction({ action, expectedSnapshot } = {}) {
    if (!active || !executableActions.has(action)
      || !hasActionPermission(expectedSnapshot, expectedSnapshot, action)
      || typeof expectedSnapshot.incident?.incidentId !== 'string'
      || typeof expectedSnapshot.incident?.correlationId !== 'string') return false
    try {
      const currentUrl = getCurrentUrl()
      return isUnsavedStateKnownClean() === true
        && isTargetLive(targetId) === true
        && typeof currentUrl === 'string'
        && currentUrl.length > 0
    } catch {
      return false
    }
  }

  async function authorizeRecoveryAction({ action, expectedSnapshot, requestId: suppliedRequestId } = {}) {
    const id = suppliedRequestId || requestId()
    if (!executableActions.has(action) || !active || !isSupportedSnapshot(expectedSnapshot)
      || !hasActionPermission(expectedSnapshot, expectedSnapshot, action)
      || typeof expectedSnapshot.incident?.incidentId !== 'string'
      || typeof expectedSnapshot.incident?.correlationId !== 'string') {
      setPending({ kind: 'recovery', reason: 'unavailable' })
      return { accepted: false, reason: 'unavailable' }
    }

    // Consume before the first await so repeated clicks cannot race Go.
    const authorizationKey = `${action}:${expectedSnapshot.incident.incidentId}:${expectedSnapshot.sequence}`
    if (consumedRequestIds.has(id) || activeAuthorizations.has(authorizationKey)) {
      setPending({ kind: 'recovery', reason: 'duplicate' })
      return { accepted: false, reason: 'duplicate' }
    }
    consumedRequestIds.add(id)
    activeAuthorizations.add(authorizationKey)

    const capturedRegistration = registration
    const capturedGeneration = registration.generation
    let capturedUrl = null
    let cleanAtRequest = false
    let liveAtRequest = false
    try {
      capturedUrl = getCurrentUrl()
      cleanAtRequest = isUnsavedStateKnownClean() === true
      liveAtRequest = isTargetLive(targetId) === true
    } catch { /* unavailable safety state must fail closed */ }
    if (!cleanAtRequest || !liveAtRequest || typeof capturedUrl !== 'string' || capturedUrl.length === 0) {
      activeAuthorizations.delete(authorizationKey)
      setPending({ kind: 'recovery', reason: !cleanAtRequest ? 'unsaved-state-unknown-or-dirty' : 'target-unavailable' })
      return { accepted: false, reason: !cleanAtRequest ? 'unsaved-state-unknown-or-dirty' : 'target-unavailable' }
    }

    try {
      const beforeActionSnapshot = await getCurrentSnapshot()
      const stillRegisteredBeforeAction = active && registration === capturedRegistration
        && registration.generation === capturedGeneration
      const stillCleanBeforeAction = isUnsavedStateKnownClean() === true
      const stillLiveBeforeAction = isTargetLive(targetId) === true
      const stillAtSameDocumentBeforeAction = getCurrentUrl() === capturedUrl
      if (!isSupportedSnapshot(beforeActionSnapshot)
        || !hasActionPermission(beforeActionSnapshot, expectedSnapshot, action)
        || !stillRegisteredBeforeAction || !stillCleanBeforeAction
        || !stillLiveBeforeAction || !stillAtSameDocumentBeforeAction) {
        setPending({ kind: 'recovery', reason: 'authorization-stale-or-target-changed' })
        return { accepted: false, reason: 'authorization-stale-or-target-changed' }
      }

      const result = await authorizeAction({
        action,
        incidentId: expectedSnapshot.incident.incidentId,
        expectedSequence: expectedSnapshot.sequence,
        requestId: id,
      })
      let currentSnapshot = null
      try { currentSnapshot = await getCurrentSnapshot() }
      catch { /* the accepted Go retry response remains authoritative */ }
      const stillRegistered = active && registration === capturedRegistration
        && registration.generation === capturedGeneration
      const stillClean = isUnsavedStateKnownClean() === true
      const stillLive = isTargetLive(targetId)
      const stillAtSameDocument = getCurrentUrl() === capturedUrl
      const resultSnapshot = result?.snapshot

      if (!result?.accepted || !isSupportedSnapshot(resultSnapshot)
        || !stillRegistered || !stillClean || !stillLive || !stillAtSameDocument) {
        setPending({ kind: 'recovery', reason: 'authorization-stale-or-target-changed' })
        return { accepted: false, reason: 'authorization-stale-or-target-changed' }
      }

      if (action === 'reload-page') {
        if (!hasReloadPermission(resultSnapshot, expectedSnapshot)
          || !hasReloadPermission(currentSnapshot, expectedSnapshot)) {
          setPending({ kind: 'recovery', reason: 'authorization-stale-or-target-changed' })
          return { accepted: false, reason: 'authorization-stale-or-target-changed' }
        }
        navigate()
        return { accepted: true, snapshot: resultSnapshot }
      }

      // A successful retry is an action. Go may advance the sequence, phase,
      // or episode; reconcile its authoritative response instead of comparing
      // it to the pre-action snapshot or navigating this document.
      if (resultSnapshot.sequence <= expectedSnapshot.sequence) {
        setPending({ kind: 'recovery', reason: 'authorization-stale-or-target-changed' })
        return { accepted: false, reason: 'authorization-stale-or-target-changed' }
      }
      if (isSupportedSnapshot(currentSnapshot)) {
        if (currentSnapshot.sequence === resultSnapshot.sequence && !sameSnapshot(currentSnapshot, resultSnapshot)) {
          setPending({ kind: 'recovery', reason: 'authorization-stale-or-target-changed' })
          return { accepted: false, reason: 'authorization-stale-or-target-changed' }
        }
        if (currentSnapshot.sequence > resultSnapshot.sequence) {
          return { accepted: true, snapshot: currentSnapshot }
        }
      }
      return { accepted: true, snapshot: resultSnapshot }
    } catch {
      setPending({ kind: 'recovery', reason: 'authorization-unavailable' })
      return { accepted: false, reason: 'authorization-unavailable' }
    } finally {
      activeAuthorizations.delete(authorizationKey)
    }
  }

  async function authorizeReload({ expectedSnapshot, requestId: suppliedRequestId } = {}) {
    const result = await authorizeRecoveryAction({ action: 'reload-page', expectedSnapshot, requestId: suppliedRequestId })
    return result.accepted
  }

  return { dispose, refresh, canAuthorizeRecoveryAction, authorizeRecoveryAction, authorizeReload, registration }
}

export { hasActionPermission, hasReloadPermission, isSupportedSnapshot, sameRuntimeEvidence, sameSnapshot }

// A separate, narrow initial-load policy. General document clean-state remains
// unknown; this path requires evidence captured before any application module.
const initialModuleRecoveries = new WeakMap()
const importFailure = /^(?:Importing a module script failed\.?|Failed to fetch dynamically imported module(?::.*)?|error loading dynamically imported module(?::.*)?|Loading chunk [\w-]+ failed(?:[\s\S]*)?)$/i

export function recoverInitialModuleFailure(error, { signal, host = globalThis.window, report = reportDesktopModuleRecovery } = {}) {
  if (!host || typeof host !== 'object') return Promise.resolve({ decision: 'initial-state-unavailable' })
  const existing = initialModuleRecoveries.get(host)
  if (existing) return existing.then(result => result.decision === 'cancelled' && !signal?.aborted
    ? recoverInitialModuleFailure(error, { signal, host, report }) : result)
  const work = runInitialModuleRecovery(error, { signal, host, report }).catch(() => ({ decision: 'initial-state-unavailable' }))
  initialModuleRecoveries.set(host, work)
  const cleanup = () => { if (initialModuleRecoveries.get(host) === work) initialModuleRecoveries.delete(host) }
  void work.then(cleanup, cleanup)
  return work
}

async function boundedModuleReport(report, decision) {
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(() => report(decision)),
      new Promise(resolve => { timer = setTimeout(() => resolve(null), 1000) }),
    ])
  } catch { return null }
  finally { clearTimeout(timer) }
}

async function runInitialModuleRecovery(error, { signal, host, report }) {
  const capturedURL = host?.location?.href
  const capturedLatch = host?.__hypercanvasInitialLoad
  const localReason = () => {
    if (signal?.aborted) return 'cancelled'
    if (!capturedLatch || typeof capturedLatch.reason !== 'function') return 'initial-state-unavailable'
    if (host.__hypercanvasInitialLoad !== capturedLatch || host.location.href !== capturedURL) return 'document-changed'
    try {
      const reason = capturedLatch.reason()
      return reason === null || ['user-interacted', 'route-already-ready', 'document-changed', 'initial-state-unavailable'].includes(reason)
        ? reason : 'initial-state-unavailable'
    }
    catch { return 'initial-state-unavailable' }
  }
  const finish = async decision => {
    if (decision !== 'cancelled') await boundedModuleReport(report, decision)
    return { decision }
  }
  if (!importFailure.test(typeof error?.message === 'string' ? error.message : '')) return finish('non-import-error')
  let reason = localReason()
  if (reason) return finish(reason)
  const observation = await boundedModuleReport(report, 'observed')
  reason = localReason()
  if (reason) return finish(reason)
  if (!observation?.accepted || !/^[a-f0-9]{7,64}(?::[a-f0-9]{7,64})?$/i.test(observation.buildRevision || '')) {
    return { decision: 'telemetry-unavailable' }
  }
  const key = '__hypercanvas_initial_module_retry__:' + observation.buildRevision + ':' + capturedURL
  try {
    if (host.sessionStorage.getItem(key) !== null) return finish('budget-exhausted')
    // Persist before awaiting the journal receipt and before navigation. A failed
    // receipt leaves the budget consumed rather than creating a reload loop.
    host.sessionStorage.setItem(key, '1')
    if (host.sessionStorage.getItem(key) !== '1') return finish('storage-unavailable')
  } catch { return finish('storage-unavailable') }
  const receipt = await boundedModuleReport(report, 'retrying')
  reason = localReason()
  if (reason) return finish(reason)
  if (!receipt?.accepted || receipt.buildRevision !== observation.buildRevision) return { decision: 'telemetry-unavailable' }
  try {
    if (host.sessionStorage.getItem(key) !== '1') return finish('storage-unavailable')
  } catch { return finish('storage-unavailable') }
  host.location.reload()
  return { decision: 'retrying' }
}
