/** Browser presentation only. These flags do not restrict navigation or access. */
import { EMBED_MANAGED_PARAMS } from '../embedNavigation.js';
export const NOTEBOOK_VIEW_PARAMS = ['hideUI', 'removeUI', 'showTools'];
export const DEFAULT_NOTEBOOK_BROWSER_LINK = Object.freeze({
    mode: 'hidden', showTools: false,
});
/** Link-authoring defaults never change the meaning of an incoming plain URL. */
export function normalizeNotebookBrowserLinkOptions(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value)
        ? value : {};
    return {
        mode: input.mode === 'visible' || input.mode === 'hidden' || input.mode === 'removed'
            ? input.mode : DEFAULT_NOTEBOOK_BROWSER_LINK.mode,
        showTools: typeof input.showTools === 'boolean' ? input.showTools : DEFAULT_NOTEBOOK_BROWSER_LINK.showTools,
    };
}
/** Presence flags; strict embed wins, then removeUI, then hideUI. */
export function resolveNotebookView(search = '') {
    const params = new URLSearchParams(search);
    const embed = params.has('_sb_embed');
    const mode = params.has('removeUI') ? 'removed' : params.has('hideUI') ? 'hidden' : 'visible';
    const showTools = params.has('showTools');
    return {
        mode, embed, showTools,
        notebookVisible: !embed && mode === 'visible',
        commandToolbarVisible: !embed && (mode === 'visible' || showTools),
        toolPanelsAvailable: !embed && (mode !== 'removed' || showTools),
        paletteAvailable: !embed && mode !== 'removed',
        recoveryAvailable: !embed && mode !== 'removed',
        canvasControlsVisible: !embed,
    };
}
export function stripNotebookViewParams(params) {
    for (const name of NOTEBOOK_VIEW_PARAMS)
        params.delete(name);
}
/** Full public URL, retaining its branch base, authored query and exact hash. */
export function buildNotebookBrowserUrl(currentUrl, options = DEFAULT_NOTEBOOK_BROWSER_LINK) {
    const url = new URL(currentUrl);
    for (const name of EMBED_MANAGED_PARAMS)
        url.searchParams.delete(name);
    stripNotebookViewParams(url.searchParams);
    // Discard obsolete conflicting links; showUI has no viewing semantics.
    url.searchParams.delete('showUI');
    const selected = normalizeNotebookBrowserLinkOptions(options);
    if (selected.mode === 'hidden')
        url.searchParams.set('hideUI', '');
    if (selected.mode === 'removed')
        url.searchParams.set('removeUI', '');
    if (selected.showTools)
        url.searchParams.set('showTools', '');
    return url.href;
}
/** Host flags are authoritative; never accept presentation flags from a child. */
export function preserveNotebookView(target, hostSearch) {
    const url = new URL(target, 'https://hypercanvas.invalid');
    stripNotebookViewParams(url.searchParams);
    const host = new URLSearchParams(hostSearch);
    const mode = host.has('removeUI') ? 'removeUI' : host.has('hideUI') ? 'hideUI' : null;
    if (mode)
        url.searchParams.set(mode, host.get(mode) || '');
    if (host.has('showTools'))
        url.searchParams.set('showTools', host.get('showTools') || '');
    return `${url.pathname}${url.search}${url.hash}`;
}
/** Carry link modes through ordinary host navigation inside the same prototype. */
export function inheritNotebookViewNavigation(target, currentUrl, base = '/') {
    const current = new URL(currentUrl);
    const next = new URL(target, current);
    const prefix = base.replace(/\/$/, '');
    const scope = (url) => {
        if (prefix && !url.pathname.startsWith(`${prefix}/`))
            return '';
        return url.pathname.slice(prefix.length).split('/').filter(Boolean)[0] || '';
    };
    const currentScope = scope(current);
    if (next.origin !== current.origin || !currentScope || scope(next) !== currentScope ||
        /^(canvas|sites|notebook|workspace|viewfinder|create|home|docs|components|__notebook)$/.test(currentScope))
        return next.href;
    // An explicit view transition (including revealing a hidden URL) must work.
    const authoredRoute = (url) => {
        const params = new URLSearchParams(url.search);
        stripNotebookViewParams(params);
        return `${url.pathname}?${params}${url.hash}`;
    };
    if (authoredRoute(current) === authoredRoute(next) || NOTEBOOK_VIEW_PARAMS.some(name => next.searchParams.has(name)))
        return next.href;
    return new URL(preserveNotebookView(`${next.pathname}${next.search}${next.hash}`, current.search), current).href;
}
