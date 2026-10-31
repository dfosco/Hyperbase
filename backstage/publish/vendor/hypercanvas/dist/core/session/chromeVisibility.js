import { resolveNotebookView } from './notebookView.js';
/** Apply link-only presentation before first paint and after host navigation. */
export function applyHideUIFromUrl() {
    const view = resolveNotebookView(window.location.search);
    const root = document.documentElement;
    const customerHidden = root.classList.contains('storyboard-customer-hide-chrome');
    root.classList.toggle('storyboard-chrome-hidden', !view.notebookVisible || customerHidden);
    root.classList.toggle('storyboard-chrome-completely-hidden', view.mode === 'removed' || view.embed || customerHidden);
    root.dataset.notebookView = view.embed ? 'embed' : view.mode;
    root.dataset.notebookTools = String(view.commandToolbarVisible && !customerHidden);
}
/** Recovery changes the URL, never a global preference. Removed views cannot recover. */
export function setNotebookViewMode(mode) {
    const view = resolveNotebookView(window.location.search);
    if (!view.recoveryAvailable || document.documentElement.classList.contains('storyboard-customer-hide-chrome'))
        return false;
    const url = new URL(window.location.href);
    url.searchParams.delete('hideUI');
    url.searchParams.delete('removeUI');
    if (mode === 'hidden')
        url.searchParams.set('hideUI', '');
    if (mode === 'removed')
        url.searchParams.set('removeUI', '');
    window.history.replaceState(window.history.state, '', url);
    applyHideUIFromUrl();
    // Keep browser routers in sync with this same-document presentation replace.
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    return true;
}
export function toggleNotebookChrome() {
    return setNotebookViewMode(resolveNotebookView(window.location.search).mode === 'visible' ? 'hidden' : 'visible');
}
export function clearHideUIFromUrl() {
    setNotebookViewMode('visible');
}
export function isPaletteAvailable() {
    const classes = document.documentElement.classList;
    return resolveNotebookView(window.location.search).paletteAvailable &&
        !classes.contains('storyboard-customer-hide-command-palette') && !classes.contains('storyboard-customer-hide-chrome');
}
export function getNotebookViewSearch() {
    return window.location.search;
}
export function isCanvasImmersive() {
    return document.documentElement.classList.contains('storyboard-canvas-immersive');
}
export function isChromeHidden() {
    return !resolveNotebookView(window.location.search).notebookVisible || document.documentElement.classList.contains('storyboard-chrome-hidden');
}
export function subscribeToChromeVisibility(callback) {
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-notebook-view', 'data-notebook-tools'] });
    const onPopState = () => { applyHideUIFromUrl(); callback(); };
    window.addEventListener('popstate', onPopState);
    return () => { observer.disconnect(); window.removeEventListener('popstate', onPopState); };
}
