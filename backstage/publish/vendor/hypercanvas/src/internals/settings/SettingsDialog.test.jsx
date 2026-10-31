import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import SettingsDialog from './SettingsDialog.jsx'

const flags = vi.hoisted(() => ({ setFlag: vi.fn() }))
vi.mock('../../core/stores/featureFlags.js', () => ({
  getAllFlags: () => ({
    usePaseoApp: { current: true, default: true },
    'lifecycle-debug-panel': { current: true, default: true },
  }),
  setFlag: flags.setFlag,
}))

afterEach(() => {
  cleanup()
  delete window.mygo
  delete window.__HYPERCANVAS_BASE_PATH__
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('native daily issue feedback settings', () => {
  const initial = overrides => ({
    repository: 'dfosco/hypercanvas', repositoryUrl: 'https://github.com/dfosco/hypercanvas',
    tokenConfigured: false, enabled: false, validationStatus: 'not_configured', lastUploadStatus: 'never', ...overrides,
  })
  const configure = (snapshot = initial(), save = async () => initial({ tokenConfigured: true, validationStatus: 'validated', accountLogin: 'octocat' })) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ config: {} }) })))
    const call = vi.fn(method => method === 'Bootstrap.GetIssueLogFeedbackSettings' ? Promise.resolve(snapshot) : save())
    window.mygo = { call, on: vi.fn() }
    return call
  }
  async function openFeedback(user) {
    await user.click(await screen.findByRole('button', { name: 'Feature Flags' }))
    await user.click(screen.getByRole('button', { name: 'Issue and log Feedback' }))
    return within(await screen.findByRole('dialog', { name: 'Issue and log Feedback' }))
  }

  it('opens an accessible native modal, defaults off and never persists the PAT through browser/config APIs', async () => {
    const user = userEvent.setup()
    let finish
    const pending = new Promise(resolve => { finish = resolve })
    const call = configure(initial(), () => pending)
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    const dialog = await openFeedback(user)
    const token = dialog.getByLabelText('GitHub personal access token')
    const daily = dialog.getByRole('checkbox', { name: 'Send daily error logs via issue' })
    expect(token).toHaveAttribute('type', 'password')
    expect(token).toHaveValue('')
    expect(daily).not.toBeChecked()
    expect(dialog.getByRole('link', { name: 'dfosco/hypercanvas' })).toHaveAttribute('href', 'https://github.com/dfosco/hypercanvas')
    const localWrites = vi.spyOn(Storage.prototype, 'setItem')
    await user.type(token, 'new-test-pat')
    await user.click(daily)
    expect(dialog.getByText(/Enabling and saving authorizes automatic/)).toBeTruthy()
    await user.click(dialog.getByRole('button', { name: 'Save' }))
    expect(call).toHaveBeenLastCalledWith('Bootstrap.SaveIssueLogFeedbackSettings', { token: 'new-test-pat', enabled: true })
    expect(token).toBeDisabled()
    expect(daily).toBeDisabled()
    expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    await act(async () => finish(initial({ tokenConfigured: true, enabled: true, validationStatus: 'validated', accountLogin: 'octocat' })))
    expect(dialog.getByText('Feedback settings saved.')).toBeTruthy()
    expect(dialog.getByText('Account: octocat')).toBeTruthy()
    expect(dialog.getByText(/GitHub account and repository access validated/)).toBeTruthy()
    expect(token).toHaveValue('')
    expect(localWrites).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps saved PAT hidden and supports offline opt-out and explicit removal', async () => {
    const user = userEvent.setup()
    const call = configure(initial({ tokenConfigured: true, enabled: true, validationStatus: 'unavailable', lastUploadStatus: 'failed' }))
    call.mockImplementation(async (method, request) => method === 'Bootstrap.GetIssueLogFeedbackSettings'
      ? initial({ tokenConfigured: true, enabled: true, validationStatus: 'unavailable', lastUploadStatus: 'failed' })
      : initial({ tokenConfigured: !request.clearToken, validationStatus: request.clearToken ? 'not_configured' : 'unavailable' }))
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    const dialog = await openFeedback(user)
    expect(dialog.getByLabelText('GitHub personal access token')).toHaveValue('')
    expect(dialog.getByText(/A token is saved/)).toBeTruthy()
    await user.click(dialog.getByRole('checkbox', { name: 'Send daily error logs via issue' }))
    await user.click(dialog.getByRole('button', { name: 'Save' }))
    expect(call).toHaveBeenLastCalledWith('Bootstrap.SaveIssueLogFeedbackSettings', { token: '', enabled: false })
    await dialog.findByText('Feedback settings saved.')
    await user.click(dialog.getByRole('button', { name: 'Remove token' }))
    expect(call).toHaveBeenLastCalledWith('Bootstrap.SaveIssueLogFeedbackSettings', { enabled: false, clearToken: true })
    expect(await dialog.findByText('Token removed. Daily feedback is off.')).toBeTruthy()
    expect(dialog.getByRole('checkbox')).not.toBeChecked()
    expect(dialog.getByRole('button', { name: 'Remove token' })).toBeDisabled()
  })

  it.each(['reject', 'snapshot'])('shows validation failure via %s without claiming new access or echoing secrets', async mode => {
    const user = userEvent.setup()
    configure(initial(), async () => {
      if (mode === 'reject') throw new Error('HTTP body with secret-pat')
      return initial({ error: 'HTTP body with secret-pat', validationStatus: 'invalid' })
    })
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    const dialog = await openFeedback(user)
    await user.type(dialog.getByLabelText('GitHub personal access token'), 'secret-pat')
    await user.click(dialog.getByRole('button', { name: 'Save' }))
    expect(await dialog.findByRole('alert')).toHaveTextContent('Check your token, repository access and network')
    expect(dialog.getByRole('alert')).not.toHaveTextContent('secret-pat')
    expect(dialog.queryByText('Feedback settings saved.')).toBeNull()
    expect(dialog.queryByText(/GitHub account and repository access validated/)).toBeNull()
    expect(dialog.getByRole('button', { name: 'Remove token' })).toBeDisabled()
  })

  it('disables controls when native settings are unavailable', async () => {
    const user = userEvent.setup()
    configure()
    delete window.mygo
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    const dialog = await openFeedback(user)
    expect(await dialog.findByRole('alert')).toHaveTextContent('Hypercanvas desktop app')
    expect(dialog.getByLabelText('GitHub personal access token')).toBeDisabled()
    expect(dialog.getByRole('checkbox')).toBeDisabled()
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('shows pending native reads and clears the modal and secret on parent close/reopen', async () => {
    const user = userEvent.setup()
    let finish
    configure()
    window.mygo.call.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const onOpenChange = vi.fn()
    const view = render(<SettingsDialog open onOpenChange={onOpenChange} />)
    let dialog = await openFeedback(user)
    expect(dialog.getByText('Reading native feedback settings…')).toBeTruthy()
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled()
    await act(async () => finish(initial()))
    await user.type(dialog.getByLabelText('GitHub personal access token'), 'transient-token')
    view.rerender(<SettingsDialog open={false} onOpenChange={onOpenChange} />)
    view.rerender(<SettingsDialog open onOpenChange={onOpenChange} />)
    await screen.findByRole('button', { name: 'Feature Flags' })
    expect(screen.queryByRole('dialog', { name: 'Issue and log Feedback' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Issue and log Feedback' }))
    dialog = within(await screen.findByRole('dialog', { name: 'Issue and log Feedback' }))
    expect(dialog.getByLabelText('GitHub personal access token')).toHaveValue('')
    await act(async () => finish(initial()))
  })

  it('ignores an obsolete StrictMode read after newer settings have been saved', async () => {
    const user = userEvent.setup()
    let finishOldRead
    const oldRead = new Promise(resolve => { finishOldRead = resolve })
    const call = configure()
    let reads = 0
    call.mockImplementation(method => {
      if (method === 'Bootstrap.GetIssueLogFeedbackSettings') return ++reads === 1 ? oldRead : Promise.resolve(initial({ tokenConfigured: true, enabled: true }))
      return Promise.resolve(initial({ tokenConfigured: true, enabled: false }))
    })
    render(<StrictMode><SettingsDialog open onOpenChange={vi.fn()} /></StrictMode>)
    const dialog = await openFeedback(user)
    expect(dialog.getByRole('checkbox')).toBeChecked()
    await user.click(dialog.getByRole('checkbox'))
    await user.click(dialog.getByRole('button', { name: 'Save' }))
    await dialog.findByText('Feedback settings saved.')
    await act(async () => finishOldRead(initial()))
    expect(dialog.getByRole('button', { name: 'Remove token' })).not.toBeDisabled()
    expect(dialog.getByRole('checkbox')).not.toBeChecked()
    expect(dialog.getByText('Feedback settings saved.')).toBeTruthy()
  })

  it('closes only the feedback modal with Escape and returns focus to its action', async () => {
    const user = userEvent.setup()
    configure()
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    await openFeedback(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Issue and log Feedback' })).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Issue and log Feedback' })).toHaveFocus())
  })
})

describe('startup-only Paseo setting', () => {
  it('loads configuration through a branch base without a trailing slash', async () => {
    window.__HYPERCANVAS_BASE_PATH__ = '/branch--notebook-chrome'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ config: {} }) })))
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    await screen.findByText('Custom Domain')
    expect(fetch).toHaveBeenCalledWith('/branch--notebook-chrome/_hypercanvas/config')
  })

  it('shows mandatory logging with live writer health and no disable control', async () => {
    const user = userEvent.setup()
    const initial = {
      schemaVersion: 1, sequence: 1, enabled: true, defaultEnabled: true,
      channel: 'prod', source: 'default', available: true, sessionAvailable: true,
    }
    let onPreference
    const call = vi.fn().mockResolvedValue(initial)
    window.mygo = { call, on: vi.fn((_event, listener) => { onPreference = listener; return vi.fn() }) }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ config: {} }) })))
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Diagnostics' }))
    expect(await screen.findByText(/Operational logging is always enabled/)).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
    onPreference({ ...initial, sequence: 2, sessionAvailable: false, sessionError: 'disk full' })
    expect(await screen.findByText('The local lifecycle journal writer is unavailable.')).toBeTruthy()
    expect(call).toHaveBeenCalledExactlyOnceWith('Bootstrap.GetDesktopLifecycleLoggingPreference')
  })

  it('shows bridge denial as unavailable without claiming a persisted preference', async () => {
    const user = userEvent.setup()
    window.mygo = {
      call: vi.fn().mockRejectedValue(new Error('this page is not allowed to call Go methods (see PageOptions.TrustedOrigins)')),
      on: vi.fn(() => { throw new Error('desktop event bridge unavailable') }),
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ config: {} }) })))
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Diagnostics' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Lifecycle logging settings could not be read from the desktop runtime.',
    )
    expect(screen.queryByRole('switch', { name: /enable lifecycle logging/i })).toBeNull()
    await user.click(screen.getByText('Diagnostic details'))
    expect(screen.getByText(/TrustedOrigins/)).toBeTruthy()
  })

  it('distinguishes a stored preference from an unavailable logging session', async () => {
    const user = userEvent.setup()
    const snapshot = {
      schemaVersion: 1, sequence: 1, enabled: true, defaultEnabled: false,
      channel: 'prod', source: 'user', available: true, sessionAvailable: false,
      sessionError: 'journal append failed',
    }
    window.mygo = { call: vi.fn().mockResolvedValue(snapshot), on: vi.fn(() => vi.fn()) }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ config: {} }) })))
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Diagnostics' }))

    expect(await screen.findByText(/Operational logging is always enabled/)).toBeTruthy()
    expect(screen.getByText('The local lifecycle journal writer is unavailable.')).toBeTruthy()
    await user.click(screen.getByText('Logging session details'))
    expect(screen.getByText('journal append failed')).toBeTruthy()
  })

  it('does not let a delayed initial read overwrite a newer preference event', async () => {
    const user = userEvent.setup()
    let resolveInitial
    const initial = new Promise(resolve => { resolveInitial = resolve })
    const newer = {
      schemaVersion: 1, sequence: 2, enabled: true, defaultEnabled: false,
      channel: 'prod', source: 'user', available: true, sessionAvailable: true,
    }
    let onPreference
    window.mygo = {
      call: vi.fn(() => initial),
      on: vi.fn((_event, listener) => { onPreference = listener; return vi.fn() }),
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ config: {} }) })))
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Diagnostics' }))
    onPreference(newer)
    resolveInitial({ ...newer, sequence: 1, enabled: false, source: 'default' })

    expect(await screen.findByText(/Operational logging is always enabled/)).toBeTruthy()
    expect(screen.getByText('The local lifecycle journal writer is available.')).toBeTruthy()
  })

  it('keeps a Go-reported event when the delayed initial read later fails', async () => {
    const user = userEvent.setup()
    let rejectInitial
    const initial = new Promise((_resolve, reject) => { rejectInitial = reject })
    const current = {
      schemaVersion: 1, sequence: 2, enabled: true, defaultEnabled: false,
      channel: 'prod', source: 'user', available: true, sessionAvailable: true,
    }
    let onPreference
    window.mygo = {
      call: vi.fn(() => initial),
      on: vi.fn((_event, listener) => { onPreference = listener; return vi.fn() }),
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ config: {} }) })))
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Diagnostics' }))
    onPreference(current)
    rejectInitial(new Error('late read rejected'))

    expect(await screen.findByText(/Operational logging is always enabled/)).toBeTruthy()
    expect(screen.getByText('The initial read failed. The latest desktop preference event remains displayed.'))
      .toBeTruthy()
  })

  it('persists to server config only on Save, never to browser-local runtime flags', async () => {
    const user = userEvent.setup()
    const config = { featureFlags: { usePaseoApp: true, browserSessionHandoff: false } }
    const fetchMock = vi.fn(async (_url, options) => ({
      ok: true,
      json: async () => ({ config: options?.method === 'PUT' ? JSON.parse(options.body).updates.featureFlags : config }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SettingsDialog open onOpenChange={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Feature Flags' }))
    expect(screen.getByText('lifecycle-debug-panel')).toBeTruthy()
    const debugPanelFlag = within(screen.getByText('lifecycle-debug-panel').closest('label')).getByRole('switch')
    expect(debugPanelFlag.getAttribute('aria-checked')).toBe('true')
    await user.click(debugPanelFlag)
    expect(flags.setFlag).toHaveBeenCalledWith('lifecycle-debug-panel', false)
    flags.setFlag.mockClear()
    const toggle = within(screen.getByText('usePaseoApp').closest('label')).getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(/restart Hypercanvas to apply/)).toBeTruthy()
    await user.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(flags.setFlag).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      updates: { featureFlags: { usePaseoApp: false, browserSessionHandoff: false } },
    })
  })

  it('defaults true with partial config and discards an unsaved selection on Cancel', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ config: {} }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SettingsDialog open onOpenChange={onOpenChange} />)
    await user.click(await screen.findByRole('button', { name: 'Feature Flags' }))
    const toggle = within(screen.getByText('usePaseoApp').closest('label')).getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(flags.setFlag).not.toHaveBeenCalled()
  })
})
