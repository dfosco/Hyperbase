/**
 * Detect the current prototype name + route from the URL pathname.
 *
 * Extracted so both `KnobsPanel.jsx` and `installKnobsHighlight` agree
 * on the lookup key for the active prototype's knobs.
 *
 * The pathname shape is `{basePath}/{?branch--<x>}/{prototypeName}/{...route}`.
 * Branch deploys prefix the path with `branch--<branch-name>/`, which we
 * skip before reading the prototype segment.
 */
export declare function detectCurrentPrototypeRoute(basePath?: string, pathname?: string): {
    prototypeName: string | null;
    route: string | undefined;
    path: string;
};
