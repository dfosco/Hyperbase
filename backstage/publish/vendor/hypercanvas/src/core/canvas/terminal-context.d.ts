import type { TerminalConnectedWidget } from './terminal-config.js';
interface TerminalContextWidget extends Record<string, unknown> {
    id: string;
    type: string;
    props: Record<string, unknown>;
    imagePath?: string | null;
}
interface TerminalContextConfig {
    widgetId?: string | null;
    canvasId?: string | null;
    displayName?: string | null;
    preDisplayName?: string | null;
    branch?: string | null;
    serverUrl?: string | null;
    connectedWidgets?: TerminalConnectedWidget[] | null;
    codingTarget?: unknown;
    sessionAssignment?: unknown;
    widgetProps?: Record<string, unknown> | null;
}
interface TerminalContextData extends Record<string, unknown> {
    schemaVersion: 1;
    notebookRoot: string;
    widgetId: string;
    displayName: string;
    canvasId: string;
    branch: string | null;
    serverUrl: string | null;
    configPath: string;
    guidancePath: string;
    guidance: string | null;
    connectedWidgets: TerminalContextWidget[];
    codingTarget: unknown;
    targetState: unknown;
    assignment: unknown;
    instructions: string;
}
export interface TerminalContextSnapshot extends TerminalContextData {
    revision: string;
}
interface TerminalContextResult {
    revision: string;
    snapshotPath: string;
    snapshot: TerminalContextSnapshot;
}
/** The server materializes connected props into config before calling this. */
export declare function writeTerminalContext(root: string, config: TerminalContextConfig, { targetState }?: {
    targetState?: unknown;
}): TerminalContextResult;
export declare function terminalContextPrompt(context: Pick<TerminalContextResult, 'snapshotPath' | 'revision'>, launchId: string, { resume, initial }?: {
    resume?: boolean;
    initial?: boolean;
}): string;
export {};
