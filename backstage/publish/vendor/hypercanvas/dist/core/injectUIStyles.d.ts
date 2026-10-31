/**
 * Import Core styles only if their own marker is absent. Older code checked
 * --sb--bg or an unrelated data-storyboard-ui-css DOM marker; neither proves
 * the current isolated Core CSS has loaded.
 */
export declare function injectUIStyles(): Promise<void>;
