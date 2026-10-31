/**
 * Check for ?hide or ?show in the current URL and act on them.
 * Safe to call multiple times (idempotent — only acts if the param exists).
 */
export declare function interceptHideParams(): void;
/**
 * Install a popstate listener so ?hide/?show are detected on
 * browser back/forward navigation too.
 */
export declare function installHideParamListener(): void;
