/**
 * Import Core styles only if their own marker is absent. Older code checked
 * --sb--bg or an unrelated data-storyboard-ui-css DOM marker; neither proves
 * the current isolated Core CSS has loaded.
 */
export async function injectUIStyles() {
    let ready = '';
    try {
        ready = getComputedStyle(document.documentElement).getPropertyValue('--hc-core-styles-ready').trim();
    }
    catch {
        // CSSOM may be unavailable in a test host. Still request the stylesheet.
    }
    if (ready === '1')
        return;
    // Missing Core styles are a runtime error, not a silent unstyled UI.
    await import('@dfosco/hypercanvas/ui-runtime/style.css');
}
