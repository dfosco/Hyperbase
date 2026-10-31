type ContextNotifier = (widgetId: string, state: unknown) => unknown;
type LiveCodingOptions = {
    notify?: ContextNotifier;
    /** Compatibility flag for explicit context refresh; it no longer triggers PTY input. */
    retry?: boolean;
};
/** True only after this Core has verified interactive-agent startup context. */
export declare function isManagedTerminalReady(root: string, widgetId: string): boolean;
export declare function startTerminalContext(root: string, widgetId: string, { launchId, revision, interactive }: {
    launchId: string;
    revision: string;
    interactive?: boolean;
}, { notify }?: Pick<LiveCodingOptions, 'notify'>): unknown;
export declare function stopTerminalContext(root: string, widgetId: string, launchId: string | null | undefined, { notify }?: Pick<LiveCodingOptions, 'notify'>): unknown;
/**
 * Explicit graph changes can retarget the coding target. Always materialize
 * the latest context on disk, but never inject an unsolicited PTY message:
 * a foreground agent TUI's draft input cannot be observed reliably.
 */
export declare function refreshLiveCodingTarget(root: string, widgetId: string, { notify }?: LiveCodingOptions): Promise<unknown>;
export declare function acknowledgeTerminalContext(root: string, widgetId: string, { launchId, revision }: {
    launchId: string;
    revision: string;
}, options?: LiveCodingOptions): Promise<unknown>;
export {};
