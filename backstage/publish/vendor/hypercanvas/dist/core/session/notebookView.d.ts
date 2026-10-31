export type NotebookViewMode = 'visible' | 'hidden' | 'removed';
export interface NotebookBrowserLinkOptions {
    mode: NotebookViewMode;
    showTools: boolean;
}
export declare const NOTEBOOK_VIEW_PARAMS: readonly ["hideUI", "removeUI", "showTools"];
export declare const DEFAULT_NOTEBOOK_BROWSER_LINK: Readonly<NotebookBrowserLinkOptions>;
/** Link-authoring defaults never change the meaning of an incoming plain URL. */
export declare function normalizeNotebookBrowserLinkOptions(value: unknown): NotebookBrowserLinkOptions;
/** Presence flags; strict embed wins, then removeUI, then hideUI. */
export declare function resolveNotebookView(search?: string): {
    mode: NotebookViewMode;
    embed: boolean;
    showTools: boolean;
    notebookVisible: boolean;
    commandToolbarVisible: boolean;
    toolPanelsAvailable: boolean;
    paletteAvailable: boolean;
    recoveryAvailable: boolean;
    canvasControlsVisible: boolean;
};
export declare function stripNotebookViewParams(params: URLSearchParams): void;
/** Full public URL, retaining its branch base, authored query and exact hash. */
export declare function buildNotebookBrowserUrl(currentUrl: string | URL, options?: NotebookBrowserLinkOptions): string;
/** Host flags are authoritative; never accept presentation flags from a child. */
export declare function preserveNotebookView(target: string, hostSearch: string): string;
/** Carry link modes through ordinary host navigation inside the same prototype. */
export declare function inheritNotebookViewNavigation(target: string | URL, currentUrl: string, base?: string): string;
