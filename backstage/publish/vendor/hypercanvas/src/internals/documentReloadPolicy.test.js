import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDocumentReloadPolicy, recoverInitialModuleFailure } from './documentReloadPolicy.js'

afterEach(() => vi.useRealTimers())

const snapshot = {
  schemaVersion: 1,
  sequence: 12,
  phase: 'recovering',
  incident: { incidentId: 'incident-a', correlationId: 'correlation-a' },
  actions: ['reload-page'],
}

function createPolicy(overrides = {}) {
  const hot = { send: vi.fn() }
  const authorizeAction = vi.fn().mockResolvedValue({ accepted: true, snapshot })
  const getCurrentSnapshot = vi.fn().mockResolvedValue(snapshot)
  const isUnsavedStateKnownClean = vi.fn().mockReturnValue(true)
  const isTargetLive = vi.fn().mockReturnValue(true)
  const getCurrentUrl = vi.fn().mockReturnValue('http://localhost/branch--test/canvas/demo')
  const navigate = vi.fn()
  const setPending = vi.fn()
  const policy = createDocumentReloadPolicy({
    hot,
    role: 'canvas-host',
    targetId: 'target-canvas-demo-123456',
    authorizeAction,
    getCurrentSnapshot,
    isUnsavedStateKnownClean,
    isTargetLive,
    getCurrentUrl,
    navigate,
    setPending,
    requestId: () => 'request-a',
    ...overrides,
  })
  return {
    policy,
    hot,
    authorizeAction: overrides.authorizeAction || authorizeAction,
    getCurrentSnapshot,
    isUnsavedStateKnownClean,
    isTargetLive,
    getCurrentUrl,
    navigate,
    setPending,
  }
}

describe('document reload policy', () => {
  it('registers one document policy, refreshes it, and unregisters on dispose', () => {
    vi.useFakeTimers()
    const { policy, hot } = createPolicy()

    expect(hot.send).toHaveBeenNthCalledWith(1, 'storyboard:document-policy', expect.objectContaining({
      schemaVersion: 1,
      active: true,
      role: 'canvas-host',
      targetId: 'target-canvas-demo-123456',
    }))
    vi.advanceTimersByTime(3000)
    expect(hot.send).toHaveBeenCalledTimes(2)
    policy.dispose()
    expect(hot.send).toHaveBeenLastCalledWith('storyboard:document-policy', expect.objectContaining({ active: false }))
  })

  it('navigates only after Go and the latest local snapshot authorize the same live clean document', async () => {
    const { policy, authorizeAction, navigate } = createPolicy()

    await expect(policy.authorizeReload({ expectedSnapshot: snapshot })).resolves.toBe(true)
    expect(authorizeAction).toHaveBeenCalledWith({
      action: 'reload-page', incidentId: 'incident-a', expectedSequence: 12, requestId: 'request-a',
    })
    expect(navigate).toHaveBeenCalledOnce()
  })

  it('checks the latest snapshot before sending an action to Go', async () => {
    const newer = { ...snapshot, sequence: 13 }
    const { policy, authorizeAction, navigate, setPending } = createPolicy({
      getCurrentSnapshot: vi.fn().mockResolvedValue(newer),
    })

    await expect(policy.authorizeReload({ expectedSnapshot: snapshot })).resolves.toBe(false)
    expect(authorizeAction).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(setPending).toHaveBeenCalledWith({ kind: 'recovery', reason: 'authorization-stale-or-target-changed' })
  })

  it('enables a retry without authorizing until activation, then reconciles an advanced episode without navigation', async () => {
    const retrySnapshot = { ...snapshot, actions: ['retry-core'] }
    const accepted = {
      schemaVersion: 1,
      sequence: 13,
      phase: 'recovering',
      incident: { incidentId: 'incident-b', correlationId: 'correlation-b' },
      actions: [],
    }
    const latest = { ...accepted, sequence: 14, phase: 'starting', incident: null }
    const getCurrentSnapshot = vi.fn()
      .mockResolvedValueOnce(retrySnapshot)
      .mockResolvedValueOnce(latest)
    const { policy, authorizeAction, navigate } = createPolicy({
      getCurrentSnapshot,
      authorizeAction: vi.fn().mockResolvedValue({ accepted: true, snapshot: accepted }),
    })

    expect(policy.canAuthorizeRecoveryAction({ action: 'retry-core', expectedSnapshot: retrySnapshot })).toBe(true)
    expect(authorizeAction).not.toHaveBeenCalled()
    await expect(policy.authorizeRecoveryAction({ action: 'retry-core', expectedSnapshot: retrySnapshot }))
      .resolves.toEqual({ accepted: true, snapshot: latest })
    expect(authorizeAction).toHaveBeenCalledWith({
      action: 'retry-core', incidentId: 'incident-a', expectedSequence: 12, requestId: 'request-a',
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('keeps a child authorization local to that child document', async () => {
    const parent = createPolicy({
      role: 'canvas-host',
      targetId: 'target-parent-canvas-12345',
    })
    const child = createPolicy({
      role: 'prototype-content',
      targetId: 'target-child-prototype-12345',
    })

    await expect(child.policy.authorizeReload({ expectedSnapshot: snapshot })).resolves.toBe(true)
    expect(child.navigate).toHaveBeenCalledOnce()
    expect(parent.navigate).not.toHaveBeenCalled()
    expect(parent.authorizeAction).not.toHaveBeenCalled()
  })

  it('consumes duplicate request IDs before awaiting authorization', async () => {
    let resolveAuthorization
    const { policy, authorizeAction, navigate, setPending } = createPolicy({
      authorizeAction: vi.fn(() => new Promise(resolve => { resolveAuthorization = resolve })),
    })

    const first = policy.authorizeReload({ expectedSnapshot: snapshot })
    await expect(policy.authorizeReload({ expectedSnapshot: snapshot })).resolves.toBe(false)
    expect(authorizeAction).toHaveBeenCalledOnce()
    resolveAuthorization({ accepted: true, snapshot })
    await expect(first).resolves.toBe(true)
    expect(navigate).toHaveBeenCalledOnce()
    expect(setPending).toHaveBeenCalledWith({ kind: 'recovery', reason: 'duplicate' })
  })

  it('leaves recovery pending when authorization is stale, the document changes, or cleanliness is unknown', async () => {
    const stale = { ...snapshot, sequence: 13 }
    const staleResult = createPolicy({ authorizeAction: vi.fn().mockResolvedValue({ accepted: false, snapshot: stale }) })
    await expect(staleResult.policy.authorizeReload({ expectedSnapshot: snapshot })).resolves.toBe(false)
    expect(staleResult.navigate).not.toHaveBeenCalled()

    const staleCurrent = createPolicy({ getCurrentSnapshot: vi.fn().mockResolvedValue(stale) })
    await expect(staleCurrent.policy.authorizeReload({ expectedSnapshot: snapshot })).resolves.toBe(false)
    expect(staleCurrent.navigate).not.toHaveBeenCalled()

    const changedUrl = createPolicy({ getCurrentUrl: vi.fn().mockReturnValueOnce('/canvas/demo').mockReturnValueOnce('/canvas/other') })
    await expect(changedUrl.policy.authorizeReload({ expectedSnapshot: snapshot })).resolves.toBe(false)
    expect(changedUrl.navigate).not.toHaveBeenCalled()

    const unknownDirty = createPolicy({ isUnsavedStateKnownClean: vi.fn().mockReturnValue(null) })
    await expect(unknownDirty.policy.authorizeReload({ expectedSnapshot: snapshot })).resolves.toBe(false)
    expect(unknownDirty.authorizeAction).not.toHaveBeenCalled()
    expect(unknownDirty.navigate).not.toHaveBeenCalled()

    const unavailableTarget = createPolicy({ isTargetLive: vi.fn().mockReturnValue(false) })
    await expect(unavailableTarget.policy.authorizeReload({ expectedSnapshot: snapshot })).resolves.toBe(false)
    expect(unavailableTarget.authorizeAction).not.toHaveBeenCalled()
  })

  it('does not navigate if the registration is disposed while authorization is pending', async () => {
    let resolveAuthorization
    const { policy, navigate, setPending } = createPolicy({
      authorizeAction: () => new Promise(resolve => { resolveAuthorization = resolve }),
    })
    const pending = policy.authorizeReload({ expectedSnapshot: snapshot })
    await vi.waitFor(() => expect(resolveAuthorization).toBeTypeOf('function'))
    policy.dispose()
    resolveAuthorization({ accepted: true, snapshot })

    await expect(pending).resolves.toBe(false)
    expect(navigate).not.toHaveBeenCalled()
    expect(setPending).toHaveBeenCalledWith({ kind: 'recovery', reason: 'authorization-stale-or-target-changed' })
  })

  it('keeps the notice pending when the desktop authorization bridge is unavailable', async () => {
    const { policy, navigate, setPending } = createPolicy({
      authorizeAction: vi.fn().mockRejectedValue(new Error('bridge unavailable')),
    })

    await expect(policy.authorizeReload({ expectedSnapshot: snapshot })).resolves.toBe(false)
    expect(navigate).not.toHaveBeenCalled()
    expect(setPending).toHaveBeenCalledWith({ kind: 'recovery', reason: 'authorization-unavailable' })
  })
})

function initialHost(storage = new Map()) {
  return {
    __hypercanvasInitialLoad: { reason: vi.fn(() => null) },
    location: { href: 'http://localhost/branch--test/canvas/first', reload: vi.fn() },
    sessionStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  }
}
const moduleError = new TypeError('Importing a module script failed.')
const moduleReceipt = { accepted: true, buildRevision: 'a'.repeat(40) }

describe('initial module import recovery', () => {
  it('journals before one reload and retains budget across new documents at the exact URL/build', async () => {
    const storage = new Map()
    const host = initialHost(storage)
    const report = vi.fn(async decision => {
      expect(host.location.reload).not.toHaveBeenCalled()
      if (decision === 'retrying') expect([...storage.values()]).toEqual(['1'])
      return moduleReceipt
    })
    expect(await recoverInitialModuleFailure(moduleError, { host, report })).toEqual({ decision: 'retrying' })
    expect(report.mock.calls.map(([decision]) => decision)).toEqual(['observed', 'retrying'])
    expect(host.location.reload).toHaveBeenCalledOnce()
    const next = initialHost(storage)
    expect(await recoverInitialModuleFailure(moduleError, { host: next, report: async () => moduleReceipt }))
      .toEqual({ decision: 'budget-exhausted' })
    expect(next.location.reload).not.toHaveBeenCalled()
  })

  it.each(['user-interacted', 'route-already-ready', 'document-changed', 'initial-state-unavailable'])('does not override %s', async reason => {
    const host = initialHost()
    host.__hypercanvasInitialLoad.reason.mockReturnValue(reason)
    const report = vi.fn(async () => moduleReceipt)
    expect(await recoverInitialModuleFailure(moduleError, { host, report })).toEqual({ decision: reason })
    expect(report).toHaveBeenCalledWith(reason)
    expect(host.location.reload).not.toHaveBeenCalled()
  })

  it('does not classify render or syntax exceptions as transport errors', async () => {
    const host = initialHost()
    expect(await recoverInitialModuleFailure(new Error('Cannot read properties of undefined'), { host, report: async () => moduleReceipt }))
      .toEqual({ decision: 'non-import-error' })
    expect(host.location.reload).not.toHaveBeenCalled()
  })

  it('fails closed for missing evidence, bridge/build metadata and durable storage', async () => {
    const missing = initialHost(); delete missing.__hypercanvasInitialLoad
    expect((await recoverInitialModuleFailure(moduleError, { host: missing, report: async () => moduleReceipt })).decision).toBe('initial-state-unavailable')
    const host = initialHost()
    expect((await recoverInitialModuleFailure(moduleError, { host, report: async () => ({ accepted: true }) })).decision).toBe('telemetry-unavailable')
    host.sessionStorage.setItem = () => { throw new Error('quota') }
    expect((await recoverInitialModuleFailure(moduleError, { host, report: async () => moduleReceipt })).decision).toBe('storage-unavailable')
    expect(host.location.reload).not.toHaveBeenCalled()
  })

  it.each(['observed', 'retrying'])('rechecks interaction after asynchronous %s receipt', async pendingDecision => {
    const host = initialHost()
    const report = vi.fn(async decision => {
      if (decision === pendingDecision) host.__hypercanvasInitialLoad.reason.mockReturnValue('user-interacted')
      return moduleReceipt
    })
    expect((await recoverInitialModuleFailure(moduleError, { host, report })).decision).toBe('user-interacted')
    expect(host.location.reload).not.toHaveBeenCalled()
  })

  it('deduplicates overlapping effects and respects cancellation', async () => {
    const host = initialHost()
    const report = vi.fn(async () => moduleReceipt)
    const [first, second] = await Promise.all([
      recoverInitialModuleFailure(moduleError, { host, report }),
      recoverInitialModuleFailure(moduleError, { host, report }),
    ])
    expect(first).toEqual(second)
    expect(host.location.reload).toHaveBeenCalledOnce()
    const aborted = new AbortController(); aborted.abort()
    const another = initialHost()
    expect((await recoverInitialModuleFailure(moduleError, { host: another, report, signal: aborted.signal })).decision).toBe('cancelled')
    expect(another.location.reload).not.toHaveBeenCalled()
  })

  it('bounds a bridge that never responds without navigating', async () => {
    vi.useFakeTimers()
    const host = initialHost()
    const result = recoverInitialModuleFailure(moduleError, { host, report: () => new Promise(() => {}) })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await result).toEqual({ decision: 'telemetry-unavailable' })
    expect(host.location.reload).not.toHaveBeenCalled()
  })
})

it('allows the live StrictMode effect after the first effect is cancelled before budget consumption', async () => {
  const host = initialHost()
  const controller = new AbortController()
  let resolveObservation
  const report = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveObservation = resolve }))
    .mockResolvedValue(moduleReceipt)
  const first = recoverInitialModuleFailure(moduleError, { host, report, signal: controller.signal })
  await Promise.resolve()
  controller.abort()
  const second = recoverInitialModuleFailure(moduleError, { host, report })
  resolveObservation(moduleReceipt)
  expect(await first).toEqual({ decision: 'cancelled' })
  expect(await second).toEqual({ decision: 'retrying' })
  expect(host.location.reload).toHaveBeenCalledOnce()
})
