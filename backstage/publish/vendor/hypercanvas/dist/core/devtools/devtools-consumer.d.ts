/**
 * Consumer-safe proxy for mountDevTools.
 *
 * Delegates to the compiled UI bundle (@dfosco/storyboard/ui-runtime)
 * so consumers don't need internal dependencies. The real mountDevTools in
 * devtools.js imports internal deps and is only usable in the source repo
 * or via the compiled UI bundle.
 */
export interface DevToolsMountOptions {
    container?: HTMLElement;
    basePath?: string;
    toolbarConfig?: unknown;
    customHandlers?: Record<string, (...args: unknown[]) => Promise<unknown>>;
}
export declare function mountDevTools(options?: DevToolsMountOptions): Promise<unknown>;
export declare function unmountDevTools(): Promise<unknown>;
/** @deprecated Use mountDevTools instead. */
export declare function mountFlowDebug(options?: DevToolsMountOptions): Promise<unknown>;
/** @deprecated Use mountDevTools instead. */
export declare function mountSceneDebug(options?: DevToolsMountOptions): Promise<unknown>;
