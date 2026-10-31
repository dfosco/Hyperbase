/**
 * PrototypeErrorBoundary — catches render-time errors in prototype routes.
 *
 * Injected automatically by routes.jsx on every lazy-loaded route so a single
 * broken prototype never takes down the workspace, other prototypes, or canvases.
 *
 * Also exports ImportErrorFallback for use when the lazy import itself fails
 * (syntax error, missing dependency, etc.).
 */
import { Component, useEffect, useState } from 'react'
import { useRouteError } from 'react-router-dom'
import css from './PrototypeErrorBoundary.module.css'
import { recoverInitialModuleFailure } from './documentReloadPolicy.js'

function reloadLabel() {
  const root = document.documentElement
  return root.hasAttribute('data-hc-desktop-shell') || root.hasAttribute('data-mygo-titlebar')
    ? 'Reload app'
    : 'Reload page'
}

/**
 * React Router errorElement component — used as the route-level ErrorBoundary.
 * React Router v6.4+ calls this as a regular component (not a class boundary);
 * the error is accessed via useRouteError().
 */
export default function PrototypeErrorBoundary() {
  const error = useRouteError()
  return <ErrorDisplay error={error} />
}

/**
 * Fallback rendered directly as the route Component when lazy import() fails.
 * Receives the caught import error via props (no useRouteError needed).
 */
export function ImportErrorFallback({ error, route }) {
  return (
    <ErrorDisplay
      error={error}
      hint={route ? `Failed to load module: ${route}` : undefined}
    />
  )
}

/**
 * App-level last-resort error boundary.
 * Exported from _app.jsx as `Catch` — generouted wires it via _app?.Catch.
 * Catches errors that escape route-level boundaries (e.g. StoryboardProvider crash).
 */
export function AppErrorBoundary() {
  const error = useRouteError()
  const [recovery, setRecovery] = useState(null)
  const recoveryDecision = recovery?.error === error ? recovery.decision : null
  const reloadTarget = reloadLabel()
  useEffect(() => {
    const controller = new AbortController()
    recoverInitialModuleFailure(error, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setRecovery({ error, decision: result.decision })
    }).catch(() => {
      // Preserve the manual recovery choices if an unexpected policy failure occurs.
      if (!controller.signal.aborted) setRecovery(null)
    })
    return () => controller.abort()
  }, [error])
  const recoveryHint = recoveryDecision === 'retrying'
    ? `Retrying the ${reloadTarget === 'Reload app' ? 'app' : 'page'}…`
    : recoveryDecision === 'budget-exhausted'
      ? `Automatic retry did not resolve the error. You can reload the ${reloadTarget === 'Reload app' ? 'app' : 'page'}.`
      : `Try reloading the ${reloadTarget === 'Reload app' ? 'app' : 'page'}.`
  return (
    <main className={css.appError} data-hc-full-error aria-labelledby="app-error-heading">
      <span className={css.appWarning} aria-hidden="true">{'\u26a0\ufe0e'}</span>
      <h1 id="app-error-heading" className={css.appHeading}>An error has occurred</h1>
      <section className={css.appRecovery} aria-label="Error details and recovery">
        <p className={css.appMessage} role="alert">{error?.message || String(error || 'Unknown error')}</p>
        <p className={css.appHint} role="status">{recoveryHint}</p>
        <div className={css.appActions}>
          <button className={css.appAction} type="button" onClick={() => window.location.reload()}>
            {reloadTarget}
          </button>
        </div>
      </section>
    </main>
  )
}

/**
 * Shared error display used by both route-level and import-level fallbacks.
 */
function ErrorDisplay({ error, hint }) {
  const message = error?.message || String(error || 'Unknown error')
  const stack = error?.stack || null

  return (
    <main className={css.container} data-hc-full-error>
      <div className={css.banner}>
        <strong>Prototype error</strong>
        {hint && <span className={css.hint}>{hint}</span>}
        <span>{message}</span>
      </div>
      {stack && <StackTrace stack={stack} />}
      <div className={css.actions}>
        <button className={css.homeLink} type="button" onClick={() => window.location.reload()}>{reloadLabel()}</button>
      </div>
    </main>
  )
}

/**
 * Collapsible stack trace — hidden by default, toggle to show.
 */
class StackTrace extends Component {
  constructor(props) {
    super(props)
    this.state = { open: false }
  }

  render() {
    return (
      <details className={css.stackDetails}>
        <summary className={css.stackSummary}>Stack trace</summary>
        <pre className={css.stackPre}>{this.props.stack}</pre>
      </details>
    )
  }
}
