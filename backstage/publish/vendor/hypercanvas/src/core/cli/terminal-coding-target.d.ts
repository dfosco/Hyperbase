import type { CodingTargetCandidate } from '../canvas/terminal-coding-target.js';
type TerminalWidgetConfig = {
    canvasId?: string;
    widgetId?: string;
};
export declare function saveCodingTargetPreference(config: TerminalWidgetConfig, selection: string | null): Promise<void>;
/** Runs in the Notebook PTY before the native agent starts. */
/** @param {string} root @param {string} widgetId @param {{ resume?: boolean, assignment?: string, choose?: (candidates: unknown[]) => Promise<string | undefined>, savePreference?: (config: unknown, selection: unknown) => Promise<void> }} [options] */
export declare function prepareTerminalCodingLaunch(root: string, widgetId: string, { resume, assignment, choose, savePreference }?: {
    resume?: boolean;
    assignment?: string;
    choose?: (candidates: CodingTargetCandidate[]) => Promise<string | undefined>;
    savePreference?: typeof saveCodingTargetPreference;
}): Promise<{
    launchId: `${string}-${string}-${string}-${string}-${string}`;
    binDirectory: string;
    prompt: string;
    revision: string;
    snapshotPath: string;
    snapshot: import("../canvas/terminal-context.js").TerminalContextSnapshot;
    target: Readonly<{
        siteId: string;
        title: string;
        root: string;
        frames?: readonly import("../canvas/terminal-coding-target.js").CodingTargetFrame[];
        error?: null;
    }> | null;
    promptFile: string;
}>;
/** Local CLI uses the same canonical widget PATCH as canvas update. */
export declare function handleCodingTarget(): Promise<void>;
export {};
