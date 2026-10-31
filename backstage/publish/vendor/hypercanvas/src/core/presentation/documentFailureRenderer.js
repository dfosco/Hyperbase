import { redactDiagnosticText, sanitizeDiagnosticIncident, validateDiagnosticIncident, } from '../server/diagnostics/contract.js';
const supportedPhases = new Set(['recovering', 'recovered', 'exhausted', 'manual']);
const supportedActions = new Set([
    'retry-core',
    'reload-page',
    'restart-app',
    'open-diagnostics',
]);
const executableActions = new Set(['retry-core', 'reload-page']);
const sensitiveDetailKey = /(?:token|secret|password|credential|authorization|auth(?:entication|_?header)?|api[_-]?key)/i;
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
function isSupportedSnapshot(value) {
    if (!isRecord(value)
        || value.schemaVersion !== 1
        || !Number.isSafeInteger(value.sequence)
        || value.sequence < 1
        || typeof value.phase !== 'string'
        || !supportedPhases.has(value.phase)
        || !Array.isArray(value.actions)
        || value.actions.some((action) => typeof action !== 'string' || !supportedActions.has(action))) {
        return false;
    }
    const incident = validateDiagnosticIncident(value.incident);
    if (!incident.ok)
        return false;
    const recoveryState = incident.incident.recovery?.state;
    if (value.phase === 'recovering' && recoveryState !== 'recovering')
        return false;
    if (value.phase === 'recovered' && recoveryState !== 'recovered')
        return false;
    if (value.phase === 'exhausted' && recoveryState !== 'exhausted')
        return false;
    if (value.phase === 'manual' && recoveryState !== 'manual')
        return false;
    return true;
}
function recoveryStatus(snapshot) {
    const recovery = snapshot.incident?.recovery;
    switch (snapshot.phase) {
        case 'recovering':
            return recovery
                ? `Recovery is in progress (attempt ${recovery.attempt} of ${recovery.limit}).`
                : 'Recovery is in progress.';
        case 'recovered':
            return 'Core reports that it recovered. This document is still showing the earlier failure.';
        case 'exhausted':
            return 'Automatic recovery attempts have ended.';
        case 'manual':
            return 'Manual review is needed before continuing.';
        default:
            return 'The app runtime status is unavailable.';
    }
}
function renderDetails(details) {
    if (!details)
        return '';
    const entries = Object.entries(details)
        .filter(([key]) => !sensitiveDetailKey.test(key))
        .slice(0, 8)
        .map(([key, value]) => {
        const safeValue = redactDiagnosticText(value === null ? 'null' : String(value));
        return `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(safeValue)}</dd>`;
    });
    if (!entries.length)
        return '';
    return `<details class="details"><summary>Diagnostic details</summary><dl>${entries.join('')}</dl></details>`;
}
function renderActions(actions) {
    const buttons = actions
        .filter((action) => executableActions.has(action))
        .map((action) => {
        const label = action === 'retry-core' ? 'Retry Core' : 'Reload this page';
        return `<button type="button" data-hc-recovery-action="${action}" disabled>${label}</button>`;
    });
    if (!buttons.length)
        return '';
    return `<nav class="actions" data-hc-recovery-controls hidden aria-label="Available recovery actions">${buttons.join('')}</nav>`;
}
/** Render an offline-capable document for a validated desktop runtime incident. */
export function renderDocumentFailure(_request, state) {
    if (!isRecord(_request) || typeof _request.method !== 'string' || !isSupportedSnapshot(state))
        return null;
    const incidentResult = validateDiagnosticIncident(state.incident);
    if (!incidentResult.ok)
        return null;
    const incident = sanitizeDiagnosticIncident(incidentResult.incident);
    const instruction = incident.instruction
        ? `<p class="instruction">${escapeHtml(incident.instruction)}</p>`
        : '';
    const details = renderDetails(incident.details);
    const actions = renderActions(state.actions);
    const guidance = [
        state.actions.includes('restart-app')
            ? '<p>Restart Hypercanvas manually from the app menu if the problem continues.</p>'
            : '',
        state.actions.includes('open-diagnostics')
            ? '<p>Review the diagnostic information before trying another recovery step.</p>'
            : '',
    ].filter(Boolean).join('');
    const html = `<!doctype html>
<html lang="en" data-hc-app-appearance="system">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(incident.title)} · Hypercanvas</title>
  <style>
    :root {
      color-scheme: light dark;
      --hc-color-background: light-dark(#ffffff, #0d1117);
      --hc-color-background-muted: light-dark(#f6f8fa, #151b23);
      --hc-color-foreground: light-dark(#1f2328, #f0f6fc);
      --hc-color-foreground-muted: light-dark(#59636e, #9198a1);
      --hc-color-foreground-accent: light-dark(#0969da, #4493f8);
      --hc-color-border: light-dark(#d1d9e0, #3d444d);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--hc-color-foreground);
      background: var(--hc-color-background);
    }
    :root[data-hc-app-appearance="light"] { color-scheme: light; }
    :root[data-hc-app-appearance="dark"] { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; padding: 48px 24px; background: var(--hc-color-background); color: var(--hc-color-foreground); }
    main { width: min(100%, 640px); margin: 0 auto; }
    header { display: grid; gap: 12px; margin-bottom: 24px; }
    .eyebrow { color: var(--hc-color-foreground-muted); font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(22px, 4vw, 28px); line-height: 1.25; }
    p { margin: 0 0 12px; line-height: 1.55; }
    .status { color: var(--hc-color-foreground-muted); }
    .code { display: inline-block; width: fit-content; border: 1px solid var(--hc-color-border); border-radius: 999px; background: var(--hc-color-background-muted); padding: 4px 9px; color: var(--hc-color-foreground-muted); font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .instruction { border-left: 2px solid var(--hc-color-border); padding-left: 12px; }
    .details { margin: 20px 0; border: 1px solid var(--hc-color-border); border-radius: 8px; background: var(--hc-color-background-muted); padding: 12px 14px; }
    .details summary { cursor: pointer; font-weight: 600; }
    dl { display: grid; grid-template-columns: minmax(100px, 160px) minmax(0, 1fr); gap: 8px 12px; margin: 14px 0 0; font-size: 13px; }
    dt { color: var(--hc-color-foreground-muted); overflow-wrap: anywhere; }
    dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 24px 0; }
    [hidden] { display: none !important; }
    button { border: 1px solid var(--hc-color-border); border-radius: 8px; background: var(--hc-color-background); color: var(--hc-color-foreground); cursor: pointer; font: inherit; padding: 9px 14px; }
    button:first-child { background: var(--hc-color-foreground-accent); border-color: transparent; color: #fff; }
    button:disabled { cursor: default; opacity: .65; }
    button:focus-visible, summary:focus-visible { outline: 2px solid var(--hc-color-foreground-accent); outline-offset: 2px; }
    footer { border-top: 1px solid var(--hc-color-border); margin-top: 28px; padding-top: 16px; color: var(--hc-color-foreground-muted); font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <header>
      <span class="eyebrow">Hypercanvas · Local service</span>
      <h1>${escapeHtml(incident.title)}</h1>
      <code class="code">${escapeHtml(incident.code)}</code>
    </header>
    <p role="alert">${escapeHtml(incident.description)}</p>
    <p class="status" data-hc-recovery-status role="status" aria-live="polite">${escapeHtml(recoveryStatus(state))}</p>
    ${instruction}
    ${actions}
    <p class="guidance" data-hc-recovery-guidance>Automated controls are unavailable until this page confirms the current app state and this document's recovery policy. Follow the app's normal recovery guidance.</p>
    ${details}
    ${guidance}
    <footer>This error page is self-contained. Diagnostic details stay on this device.</footer>
  </main>
</body>
</html>`;
    return { html };
}
