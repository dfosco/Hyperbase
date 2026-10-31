/** Select the content document before importing any workspace code or CSS. */
import { contentDocumentKind, publishedFallbackPath } from '@dfosco/hypercanvas/content-routing'

const restoredPath = publishedFallbackPath(
  window.location,
  globalThis.__HYPERCANVAS_NOTEBOOK_PUBLICATION__ === true,
)
if (restoredPath) window.history.replaceState(null, '', restoredPath)

const kind = contentDocumentKind(window.location, import.meta.env.BASE_URL)
const root = document.getElementById('root')
if (root) {
  const loading = document.createElement('span')
  loading.setAttribute('role', 'status')
  loading.setAttribute('aria-label', 'Loading')
  loading.style.cssText = 'display:block;width:24px;height:24px;box-sizing:border-box;border:2px solid rgba(128,128,128,.25);border-top-color:currentColor;border-radius:50%;animation:hc-document-spin .7s linear infinite'
  const spin = document.createElement('style')
  spin.textContent = '@keyframes hc-document-spin{to{transform:rotate(360deg)}}'
  loading.append(spin)
  // Same box as the startup loader in index.html so the spinner never jumps.
  const centered = document.createElement('div')
  centered.style.cssText = 'display:grid;place-items:center;min-height:var(--sb-window-content-height,calc(100vh - var(--sb-branch-bar-height,0px)))'
  centered.append(loading)
  root.replaceChildren(centered)
}

function showDocumentFailure(error) {
  console.error('[hypercanvas] Document entry failed', error)
  if (!root) return
  const failure = document.createElement('main')
  failure.setAttribute('role', 'alert')
  failure.textContent = 'Unable to load this document. Check Notebook diagnostics for details.'
  root.replaceChildren(failure)
}

if (kind) {
  void import('@dfosco/hypercanvas/content-entry').then(({ mountContentEntry }) => mountContentEntry(kind)).catch(showDocumentFailure)
} else {
  void import('./workspace-entry.jsx').catch(showDocumentFailure)
}
