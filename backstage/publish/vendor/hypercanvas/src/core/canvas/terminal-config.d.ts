/**
 * Terminal Config — per-terminal context files for agent awareness.
 *
 * Each terminal widget gets a config at `.hypercanvas/terminals/{hash}.json`
 * (legacy Notebooks stay under `.storyboard/terminals/`).
 * that agents read on startup to understand their canvas context.
 *
 * Files are keyed by a stable widget identity hash so renames do not break them.
 * The canvasId/widgetId are stored inside the JSON payload.
 *
 * Connected widget props are refreshed from materialized canvas state on edits.
 * Versioned snapshots make startup and live delivery inspectable.
 */
interface WidgetProps extends Record<string, unknown> {
    alias?: string | null;
    prettyName?: string | null;
    agentId?: string | null;
}
export interface TerminalConnectedWidget extends Record<string, unknown> {
    id: string;
    type: string;
    props?: Record<string, unknown> | null;
}
interface TerminalAgentStatus {
    status?: string;
    message?: string | null;
    updatedAt?: string | null;
    [key: string]: unknown;
}
interface TerminalViewport {
    centerX: number;
    centerY: number;
    zoom: number;
    topLeftX: number;
    topLeftY: number;
    width: number;
    height: number;
}
export interface TerminalConfig extends Record<string, unknown> {
    widgetId?: string;
    canvasId?: string;
    branch?: string;
    worktree?: string | null;
    displayName?: string | null;
    canvasFile?: string | null;
    serverUrl?: string | null;
    workspaceId?: string | null;
    sessionId?: string | null;
    widgetProps?: WidgetProps | null;
    connectedWidgets?: TerminalConnectedWidget[];
    agentStatus?: TerminalAgentStatus | null;
    viewport?: TerminalViewport | null;
    reserved?: boolean;
    deleted?: boolean;
    codingTarget?: unknown;
    contextState?: Record<string, unknown> | null;
    lastAgentSessionId?: string;
    lastAgentSessionAt?: string;
    lastAgentId?: string;
}
interface TerminalIdentity {
    branch: string;
    canvasId: string;
    widgetId: string;
}
/** Initialize with the project root directory */
export declare function initTerminalConfig(root: string): void;
/** Public accessor for the per-widget key (used by agent-session capture). */
export declare function getConfigKey(branch: string, canvasId: string, widgetId: string): string;
/**
 * Pre-reserve terminal identity at widget creation time.
 * Called from POST /widget when a terminal/agent widget is added to the canvas,
 * BEFORE the widget renders or the WebSocket connects.
 *
 * Writes a minimal config file at `.hypercanvas/terminals/{widgetId}.json` so
 * agents (especially hot-pool sessions) can find their identity immediately.
 * The `reserved` flag marks this as a pre-reserve — writeTerminalConfig() will
 * later overwrite it with the full config.
 */
export declare function preReserveTerminalIdentity({ widgetId, preDisplayName, canvasId, branch, serverUrl, workspaceId, widgetProps }: {
    widgetId: string;
    preDisplayName: string | null;
    canvasId: string;
    branch: string;
    serverUrl?: string | null;
    workspaceId?: string | null;
    widgetProps?: WidgetProps | null;
}): void;
/**
 * Write or update a terminal config file.
 * Called when a terminal widget is created or reconnected.
 */
export declare function writeTerminalConfig({ branch, canvasId, widgetId, canvasFile, serverUrl, workspaceId, sessionId, widgetProps, displayName }: {
    branch: string;
    canvasId: string;
    widgetId: string;
    canvasFile?: string | null;
    serverUrl?: string | null;
    workspaceId?: string | null;
    sessionId?: string | null;
    widgetProps?: WidgetProps | null;
    displayName?: string | null;
}): TerminalConfig;
/**
 * Update connected widgets for a terminal.
 * Called when connectors are added/removed.
 * Stores full widget objects (id, type, props, position) so agents
 * can read context directly without additional API calls.
 */
export declare function updateTerminalConnections({ branch, canvasId, widgetId, connectedWidgets, widgetProps, }: {
    branch: string;
    canvasId: string;
    widgetId: string;
    connectedWidgets: TerminalConnectedWidget[];
    widgetProps?: WidgetProps | null;
}): TerminalConfig;
/**
 * Mark a terminal config as deleted (tombstone).
 * Called when a terminal widget is deleted.
 */
export declare function markTerminalDeleted({ branch, canvasId, widgetId }: TerminalIdentity): void;
/**
 * Unmark a terminal config as deleted (undo).
 * Called when a deleted terminal widget is restored.
 */
export declare function unmarkTerminalDeleted({ branch, canvasId, widgetId }: TerminalIdentity): void;
/**
 * Record the Paseo agent id backing an agent-chat widget so server-side
 * lookups (canvas agent lists, agent status) can resolve widget → agent.
 * Called when the browser creates or resumes an agent for the widget.
 */
export declare function recordWidgetAgentBinding({ widgetId, agentId }: {
    widgetId: string;
    agentId: string;
}): TerminalConfig | null;
/**
 * Build the Squad bootstrap prompt for a widget joining the numbered room protocol.
 * Shared by terminal PTY sessions (prepareTerminalFiles) and Paseo agent
 * chats (initial prompt injection at create time).
 */
export declare function buildSquadBootstrapPrompt(widgetId: string, agentProfile?: string): string;
/**
 * Read a terminal config. Connected widgets are already inline —
 * no additional resolution needed.
 */
export declare function readTerminalConfig({ branch, canvasId, widgetId }: TerminalIdentity): TerminalConfig | null;
/**
 * Update agent status in the terminal config.
 * Called by the signal endpoint.
 */
export declare function updateAgentStatus({ branch, canvasId, widgetId, status, message, data }: TerminalIdentity & {
    status: string;
    message?: string | null;
    data?: unknown;
}): TerminalConfig;
/**
 * Read a terminal config by widget ID (searches by symlink).
 * @param {string} widgetId
 * @returns {Object|null}
 */
export declare function readTerminalConfigById(widgetId: string): TerminalConfig | null;
/**
 * List storyboard-spawned agent sessions on a canvas.
 *
 * Scans the runtime terminals directory for widget configs whose id starts with
 * `agent-` and matches the requested canvasId/branch. External agents
 * (running in a user's CLI / VS Code on the same repo) never write
 * to this directory, so they're excluded by construction.
 *
 * @param {{ branch?: string|null, canvasId: string }} args
 * @returns {Array<object>}
 */
export declare function listAgentsForCanvas({ branch, canvasId }: {
    branch?: string | null;
    canvasId: string;
}): Array<Record<string, unknown>>;
/**
 * Save the latest output from an agent for peers to read.
 * @param {string} widgetId
 * @param {{ content: string, summary: string, updatedAt: string }} output
 */
export declare function updateLatestOutput(widgetId: string, output: {
    content: string;
    summary: string;
    updatedAt: string;
}): void;
/**
 * Persist the captured agent CLI session id for a widget so the next
 * cold start can resume it instead of launching fresh.
 *
 * Called by the agent-session watcher after the SessionStart hook fires.
 */
export declare function recordAgentSession({ branch, canvasId, widgetId, agentId, sessionId }: TerminalIdentity & {
    agentId?: string | null;
    sessionId: string;
}): TerminalConfig | null;
/** Bind a target for a native launch without changing the terminal's cwd. */
export declare function bindTerminalCodingTarget(widgetId: string, target: unknown): TerminalConfig;
/** Update runtime context without replacing concurrent live widget fields. */
export declare function updateTerminalCodingContext(widgetId: string, update: (config: TerminalConfig) => Partial<TerminalConfig>): TerminalConfig | null;
/**
 * Read the previously-captured agent session id for a widget, if any.
 * @returns {{ sessionId: string, agentId: string|null, capturedAt: string|null } | null}
 */
export declare function getLastAgentSession({ branch, canvasId, widgetId }: TerminalIdentity): {
    sessionId: string;
    agentId: string | null;
    capturedAt: string | null;
} | null;
export {};
