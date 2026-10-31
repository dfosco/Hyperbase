/**
 * Plain-language copy for desktop runtime incidents. Diagnostic codes and
 * technical titles stay in the lifecycle details dialog; the sidebar toast
 * shows these instead. Unknown codes fall back to a generic message.
 */
/** Reload shortcut for the current platform (⌘R on macOS, Ctrl+R elsewhere). */
export function reloadShortcutLabel() {
  const platform = typeof navigator === 'undefined' ? '' : `${navigator.userAgentData?.platform || navigator.platform || ''}`
  return /mac|iphone|ipad/i.test(platform) ? '⌘R' : 'Ctrl+R'
}

const COPY = {
  CORE_UPSTREAM_UNAVAILABLE: {
    title: 'Lost connection to Hypercanvas',
    recovering: () => `This page stopped responding. Hypercanvas is reconnecting — reload the page (${reloadShortcutLabel()}) if it doesn’t recover.`,
    failed: () => `This page can’t reach Hypercanvas. Reload the page (${reloadShortcutLabel()}), or restart the app if that doesn’t help.`,
  },
  CORE_PROCESS_EXITED: {
    title: 'Hypercanvas stopped unexpectedly',
    recovering: 'Hypercanvas is starting again. Your work is saved.',
    failed: 'Hypercanvas stopped and couldn’t restart itself. Please restart the app.',
  },
  CORE_START_FAILED: {
    title: 'Hypercanvas couldn’t start',
    recovering: 'Hypercanvas is trying to start again.',
    failed: 'Hypercanvas couldn’t start. Please restart the app.',
  },
  CORE_READY_TIMEOUT: {
    title: 'Hypercanvas is taking longer than usual to start',
    recovering: 'Hypercanvas is still starting up. Hang tight.',
    failed: 'Hypercanvas didn’t finish starting. Please restart the app.',
  },
  CORE_REQUEST_FAILED: {
    title: 'A request didn’t go through',
    recovering: 'Something went wrong while loading this page. Try again in a moment.',
    failed: 'Something went wrong while loading this page. Reload the page and try again.',
  },
}

export function describeRuntimeIncident(incident, phase) {
  const recovering = phase === 'recovering'
  const known = COPY[incident?.code]
  const fallbackTitle = 'Hypercanvas ran into a problem'
  return {
    title: known?.title ?? fallbackTitle,
    body: known
      ? (() => { const value = recovering ? known.recovering : known.failed; return typeof value === 'function' ? value() : value })()
      : (recovering ? 'Hypercanvas is trying to recover on its own.' : 'Hypercanvas couldn’t recover on its own. Please restart the app.'),
  }
}
