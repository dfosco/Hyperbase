/**
 * Mount a flow debug panel into the DOM.
 *
 * @param {HTMLElement} [container=document.body] - Where to mount
 * @param {string} [flowName] - Flow name override (defaults to ?flow= param or "default")
 * @returns {HTMLElement} The created debug element
 */
export declare function mountFlowDebug(container?: HTMLElement | null, flowName?: string): HTMLDivElement;
/** @deprecated Use mountFlowDebug() */
export declare const mountSceneDebug: typeof mountFlowDebug;
