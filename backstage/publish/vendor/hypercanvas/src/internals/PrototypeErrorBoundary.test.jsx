import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import PrototypeErrorBoundary, { AppErrorBoundary, ImportErrorFallback } from './PrototypeErrorBoundary.jsx'

const mocks = vi.hoisted(() => ({
  routeError: vi.fn(),
  recoverInitialModuleFailure: vi.fn(),
}))
vi.mock('react-router-dom', () => ({ useRouteError: mocks.routeError }))
vi.mock('./documentReloadPolicy.js', () => ({ recoverInitialModuleFailure: mocks.recoverInitialModuleFailure }))

beforeEach(() => {
  document.documentElement.removeAttribute('data-hc-desktop-shell')
  document.documentElement.removeAttribute('data-mygo-titlebar')
  mocks.recoverInitialModuleFailure.mockReset().mockResolvedValue({ decision: 'non-import-error' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('app-level error composition', () => {
  it('places a text warning, exact heading and compact recovery panel in the startup order', () => {
    mocks.routeError.mockReturnValue(new Error('Importing a module script failed.'))
    render(<AppErrorBoundary />)

    const main = screen.getByRole('main', { name: 'An error has occurred' })
    expect(main).toHaveAttribute('data-hc-full-error')
    const heading = within(main).getByRole('heading', { level: 1, name: 'An error has occurred' })
    const warning = heading.previousElementSibling
    expect(warning.textContent).toBe('\u26a0\ufe0e')
    expect(warning).toHaveAttribute('aria-hidden', 'true')
    expect(main.querySelector('img')).toBeNull()
    const recovery = within(main).getByRole('region', { name: 'Error details and recovery' })
    expect(heading.nextElementSibling).toBe(recovery)
    expect(within(recovery).getByRole('alert')).toHaveTextContent('Importing a module script failed.')
    expect(within(recovery).getByRole('button', { name: 'Reload page' })).toHaveAttribute('type', 'button')
    expect(within(recovery).queryByRole('button', { name: /notebook sidebar/i })).toBeNull()
    expect(screen.queryByText('Something went wrong')).toBeNull()
  })

  it.each([
    ['retrying', 'Retrying the page…', 'Reload page'],
    ['budget-exhausted', 'Automatic retry did not resolve the error. You can reload the page.', 'Reload page'],
    ['telemetry-unavailable', 'Try reloading the page.', 'Reload page'],
    ['user-interacted', 'Try reloading the page.', 'Reload page'],
  ])('shows policy decision %s without replacing the error or reload action', async (decision, hint, label) => {
    const error = new Error('Importing a module script failed.')
    mocks.routeError.mockReturnValue(error)
    mocks.recoverInitialModuleFailure.mockResolvedValue({ decision })
    render(<AppErrorBoundary />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(hint))
    expect(mocks.recoverInitialModuleFailure).toHaveBeenCalledWith(error, { signal: expect.any(AbortSignal) })
    expect(screen.getByRole('alert')).toHaveTextContent(error.message)
    expect(screen.getByRole('button', { name: label })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /notebook sidebar/i })).toBeNull()
  })

  it.each([
    ['data-hc-desktop-shell', 'Reload app'],
    ['data-mygo-titlebar', 'Reload app'],
  ])('uses stable desktop marker %s for reload wording', async (marker, label) => {
    document.documentElement.setAttribute(marker, '')
    mocks.recoverInitialModuleFailure.mockResolvedValue({ decision: 'budget-exhausted' })
    mocks.routeError.mockReturnValue(new Error('Render failed'))
    render(<AppErrorBoundary />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(
      'Automatic retry did not resolve the error. You can reload the app.',
    ))
    expect(screen.getByRole('button', { name: label })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /notebook sidebar/i })).toBeNull()
  })

  it('aborts stale error recovery and ignores its late result', async () => {
    const firstError = new Error('Importing a module script failed.')
    mocks.routeError.mockReturnValue(firstError)
    let finishFirst
    mocks.recoverInitialModuleFailure.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
    const { rerender, unmount } = render(<AppErrorBoundary />)
    const firstSignal = mocks.recoverInitialModuleFailure.mock.calls[0][1].signal
    const nextError = new Error('A render error')
    mocks.routeError.mockReturnValue(nextError)
    rerender(<AppErrorBoundary />)
    expect(firstSignal.aborted).toBe(true)
    await act(async () => { finishFirst({ decision: 'retrying' }) })
    expect(screen.getByRole('status')).toHaveTextContent('Try reloading the page.')
    expect(screen.getByRole('alert')).toHaveTextContent(nextError.message)
    const lastSignal = mocks.recoverInitialModuleFailure.mock.calls.at(-1)[1].signal
    unmount()
    expect(lastSignal.aborted).toBe(true)
  })

  it('uses centered startup geometry and neutral theme colors with wrapping actions', () => {
    const style = document.createElement('style')
    style.textContent = readFileSync(resolve(process.cwd(), 'packages/storyboard/src/internals/PrototypeErrorBoundary.module.css'), 'utf8')
    document.head.append(style)
    try {
      const rules = [...style.sheet.cssRules]
      const rule = selector => rules.find(item => item.selectorText === selector).style
      expect(rule('.appError').getPropertyValue('align-content')).toBe('center')
      expect(rule('.appError').getPropertyValue('justify-items')).toBe('center')
      expect(rule('.appError').getPropertyValue('min-height')).toContain('--sb-window-content-height')
      expect(rule('.appWarning').width).toBe('40px')
      expect(rule('.appWarning').color).toContain('--hc-color-foreground-muted')
      expect(rule('.appHeading').getPropertyValue('font-size')).toBe('16px')
      expect(rule('.appRecovery').getPropertyValue('font-size')).toBe('13px')
      expect(rule('.appRecovery').border).toContain('--hc-color-border,')
      expect(rule('.appRecovery').background).toContain('--hc-color-background-muted,')
      expect(rule('.appRecovery').getPropertyValue('overflow-wrap')).toBe('anywhere')
      expect(rule('.appActions').getPropertyValue('flex-wrap')).toBe('wrap')
      expect(rule('.appAction').color).toBe('inherit')
    } finally {
      style.remove()
    }
  })

  it('marks full error fallbacks so floating tools are hidden while the reload action remains', () => {
    mocks.routeError.mockReturnValue(new Error('Import failed'))
    render(<AppErrorBoundary />)
    const source = readFileSync(resolve(process.cwd(), 'packages/storyboard/src/core/ui/CoreUIBar.css'), 'utf8')
    expect(source).toContain('html:has([data-hc-full-error])')
    expect(source).toContain('#sb-core-ui')
    expect(source).toContain('#storyboard-controls')
    expect(source).toContain('[aria-label="Canvas toolbar"]')
    expect(source).toContain('[aria-label="Canvas controls"]')
    expect(source).toContain('[data-collab-bar]')
    expect(source).toContain('[data-sb-skip-link]')
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
  })

  it('keeps route and lazy-import failures in their existing local boundary', () => {
    mocks.routeError.mockReturnValue(new Error('Route render failed'))
    const { rerender } = render(<PrototypeErrorBoundary />)
    expect(screen.getByText('Prototype error')).toBeTruthy()
    expect(screen.getByRole('main')).toHaveAttribute('data-hc-full-error')
    expect(screen.getByText('Route render failed')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /notebook sidebar/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'An error has occurred' })).toBeNull()
    rerender(<ImportErrorFallback error={new Error('Missing import')} route="/example" />)
    expect(screen.getByText('Failed to load module: /example')).toBeTruthy()
    expect(screen.getByText('Missing import')).toBeTruthy()
  })
})
