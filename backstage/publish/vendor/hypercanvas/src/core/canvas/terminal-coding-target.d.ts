export type CodingTargetFrame = Readonly<{
    widgetId: string;
    route: string;
}>;
export type CodingTargetCandidate = Readonly<{
    siteId: string;
    frames: readonly CodingTargetFrame[];
    title: string;
    root: string | null;
    error: string | null;
}>;
export type BoundCodingTarget = Readonly<{
    siteId: string;
    title: string;
    root: string;
    frames?: readonly CodingTargetFrame[];
    error?: null;
}>;
export type TerminalCodingConfig = Readonly<{
    widgetId?: string | null;
    connectedWidgets?: readonly unknown[] | null;
    widgetProps?: Record<string, unknown> | null;
}>;
type TerminalCodingSiteStore = {
    get(siteId: string): {
        title?: string | null;
    } | null;
    getBinding(siteId: string): {
        root?: string | null;
    } | null;
};
/** Read-only resolution: Site bindings, not Frame props, own filesystem roots. */
export declare function resolveTerminalCodingTargets(root: string, config: TerminalCodingConfig | null | undefined, store?: TerminalCodingSiteStore): CodingTargetCandidate[];
export declare function selectTerminalCodingTarget(candidates: readonly CodingTargetCandidate[], selection: string | null | undefined): CodingTargetCandidate | null;
/** A resume must not resolve current bindings, even if the Site moved. */
export declare function validateBoundCodingTarget(target: CodingTargetCandidate | null | undefined): BoundCodingTarget | null;
export declare function codingTargetBootstrap(root: string, config: TerminalCodingConfig & {
    widgetProps?: Record<string, unknown> | null;
}, target: BoundCodingTarget | null, { includeAssignment }?: {
    includeAssignment?: boolean;
}): string;
export declare function writeCodingTargetPrompt(root: string, config: TerminalCodingConfig, target: BoundCodingTarget | null, options?: {
    includeAssignment?: boolean;
}): string;
/** Native interactive startup prompts; never interpolate unquoted context. */
export declare function appendTerminalAgentPrompt(command: string | null | undefined, agentId: string, prompt: string | null | undefined): string | null | undefined;
/** Batch commands cannot receive later interactive PTY messages. */
export declare function isInteractiveTerminalAgent(command: string | null | undefined, agentId: string): boolean;
export {};
