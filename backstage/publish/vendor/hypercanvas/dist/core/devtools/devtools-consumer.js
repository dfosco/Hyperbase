/**
 * Consumer-safe proxy for mountDevTools.
 *
 * Delegates to the compiled UI bundle (@dfosco/storyboard/ui-runtime)
 * so consumers don't need internal dependencies. The real mountDevTools in
 * devtools.js imports internal deps and is only usable in the source repo
 * or via the compiled UI bundle.
 */
async function loadUiRuntime() {
    // Keep this lazy for consumers that don't mount the toolbar. The literal
    // lets Vite resolve its source alias or the package's ui-runtime export.
    return await import('@dfosco/hypercanvas/ui-runtime');
}
export async function mountDevTools(options = {}) {
    const ui = await loadUiRuntime();
    return ui.mountDevTools(options);
}
export async function unmountDevTools() {
    const ui = await loadUiRuntime();
    return ui.unmountDevTools();
}
/** @deprecated Use mountDevTools instead. */
export function mountFlowDebug(options = {}) {
    return mountDevTools(options);
}
/** @deprecated Use mountDevTools instead. */
export function mountSceneDebug(options = {}) {
    return mountDevTools(options);
}
