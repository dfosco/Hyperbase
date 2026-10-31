import type { DiagnosticRecoveryAction } from '../server/diagnostics/contract.js';
interface RedirectStorage {
    getItem(key: string): string | null;
    removeItem(key: string): void;
    setItem(key: string, value: string): void;
}
interface RedirectLocation {
    href: string;
    origin: string;
    pathname: string;
    search: string;
    hash: string;
}
interface ResumeRedirectOptions {
    storage?: RedirectStorage | null;
    location?: RedirectLocation | null;
    navigate?: (url: string) => void;
    now?: number;
}
export type DesktopRuntimePhase = 'starting' | 'ready' | 'recovering' | 'recovered' | 'exhausted' | 'manual';
export type DesktopExecutableRecoveryAction = Extract<DiagnosticRecoveryAction, 'retry-core' | 'reload-page'>;
export interface DesktopRuntimeSnapshot {
    schemaVersion: 1;
    sequence: number;
    phase: DesktopRuntimePhase;
    incident: import('../server/diagnostics/contract.js').DiagnosticIncident | null;
    actions: DiagnosticRecoveryAction[];
}
export type DesktopAppearanceMode = 'system' | 'light' | 'dark';
export interface DesktopAppearanceSnapshot {
    schemaVersion: 1;
    sequence: number;
    mode: DesktopAppearanceMode;
    resolved: 'light' | 'dark';
}
export type DesktopLifecycleLoggingChannel = 'dev' | 'beta' | 'prod' | 'unknown';
export type DesktopLifecycleLoggingSource = 'default' | 'user';
export interface DesktopLifecycleLoggingPreferenceSnapshot {
    schemaVersion: 1;
    sequence: number;
    enabled: boolean;
    defaultEnabled: boolean;
    channel: DesktopLifecycleLoggingChannel;
    source: DesktopLifecycleLoggingSource;
    available: boolean;
    sessionAvailable: boolean;
    sessionError?: string;
    error?: string;
}
export interface SetDesktopLifecycleLoggingPreferenceRequest {
    enabled: boolean;
}
export interface DesktopRecoveryActionRequest {
    action: DesktopExecutableRecoveryAction;
    incidentId: string;
    expectedSequence: number;
    requestId: string;
}
export interface DesktopRecoveryActionResult {
    accepted: boolean;
    reason?: string;
    snapshot: DesktopRuntimeSnapshot;
}
export interface DesktopFrontendReadyResult {
    accepted: boolean;
    reason?: string;
    snapshot: DesktopRuntimeSnapshot;
}
/** Read the current MyGo-owned desktop lifecycle snapshot. */
export declare function getDesktopRuntimeSnapshot(): Promise<DesktopRuntimeSnapshot>;
/** Subscribe to ordered full snapshots. Dispose the listener when its document unmounts. */
export declare function subscribeDesktopRuntimeState(listener: (snapshot: DesktopRuntimeSnapshot) => void): () => void;
/** Keep whichever complete snapshot has the newest Go-owned sequence. */
export declare function reconcileDesktopRuntimeSnapshot(current: DesktopRuntimeSnapshot | null, incoming: DesktopRuntimeSnapshot): DesktopRuntimeSnapshot;
/** Ask MyGo to authorize one action against the exact snapshot rendered by the caller. */
export declare function requestDesktopRecoveryAction(request: DesktopRecoveryActionRequest): Promise<DesktopRecoveryActionResult>;
/** Acknowledge a mounted Core context against the exact snapshot it observed. */
export declare function confirmDesktopFrontendReady(request: {
    expectedSequence: number;
}): Promise<DesktopFrontendReadyResult>;
/** Observational only: this never changes runtime state or grants process actions. */
export declare function reportDesktopModuleRecovery(decision: string): Promise<{
    accepted: boolean;
    buildRevision?: string;
}>;
/** Read the Go-owned persisted global appearance preference. */
export declare function getDesktopAppearance(): Promise<DesktopAppearanceSnapshot>;
/** Persist a user-selected global appearance through the existing MyGo RPC. */
export declare function setDesktopAppearanceMode(mode: DesktopAppearanceMode): Promise<DesktopAppearanceSnapshot>;
/** Subscribe to full Go appearance snapshots and ignore malformed or stale events. */
export declare function subscribeDesktopAppearance(listener: (snapshot: DesktopAppearanceSnapshot) => void): () => void;
/** Read the Go-owned lifecycle logging preference; never infer a local default. */
export declare function getDesktopLifecycleLoggingPreference(): Promise<DesktopLifecycleLoggingPreferenceSnapshot>;
/** Persist an explicit logging preference through the existing MyGo RPC. */
export declare function setDesktopLifecycleLoggingPreference(request: SetDesktopLifecycleLoggingPreferenceRequest): Promise<DesktopLifecycleLoggingPreferenceSnapshot>;
/** Subscribe to Go-owned logging preference snapshots without a browser fallback. */
export declare function subscribeDesktopLifecycleLoggingPreference(listener: (snapshot: DesktopLifecycleLoggingPreferenceSnapshot) => void): () => void;
export declare const ISSUE_LOG_FEEDBACK_REPOSITORY = "dfosco/hypercanvas";
export declare const ISSUE_LOG_FEEDBACK_REPOSITORY_URL = "https://github.com/dfosco/hypercanvas";
export interface IssueLogFeedbackSettings {
    repository: string;
    repositoryUrl: string;
    tokenConfigured: boolean;
    enabled: boolean;
    accountLogin?: string;
    validationStatus?: 'not_configured' | 'validated' | 'unavailable' | 'invalid';
    lastUploadAt?: string;
    lastUploadStatus?: 'never' | 'sent' | 'no_new_logs' | 'failed' | 'disabled';
    lastIssueUrl?: string;
    error?: string;
}
export interface SaveIssueLogFeedbackSettingsRequest {
    token?: string;
    enabled: boolean;
    clearToken?: boolean;
}
export declare function getIssueLogFeedbackSettings(): Promise<IssueLogFeedbackSettings>;
/** Send credentials only to Go. No browser, Notebook, or config API persistence. */
export declare function saveIssueLogFeedbackSettings(request: SaveIssueLogFeedbackSettingsRequest): Promise<IssueLogFeedbackSettings>;
export declare function isBrowserCoreMode(): boolean;
export declare const PENDING_NOTEBOOK_REDIRECT_KEY = "hypercanvas.pendingNotebookRedirect";
export declare const NOTEBOOK_SWITCH_PENDING_KEY = "hypercanvas.notebookSwitchPending";
export declare const NOTEBOOK_SWITCH_EVENT = "storyboard:notebook-switch";
export declare const NOTEBOOK_SIDEBAR_EVENT = "storyboard:open-notebook-sidebar";
export declare function hasPendingNotebookSwitch(): boolean;
export declare function clearPendingNotebookSwitch(): void;
export declare function finishPendingNotebookSwitch(state: 'ready' | 'failed'): void;
/** Open and focus the shared Notebook navigation without changing the route. */
export declare function openNotebookSidebar({ focusType }?: {
    focusType?: string | null;
}): boolean;
export declare function resumePendingNotebookRedirect({ storage, location, navigate, now, }?: ResumeRedirectOptions): boolean;
export declare function coreApiPath(pathname: string): string;
export declare function browserAgentSessionUrl({ agentId, widgetId, canvasId }?: {
    agentId?: unknown;
    widgetId?: unknown;
    canvasId?: unknown;
}): string | null;
declare function requestJson(pathname: string, options?: RequestInit): Promise<unknown>;
export declare function selectNotebookDirectory({ purpose }?: {
    purpose?: string;
}): Promise<unknown>;
export declare function selectCoreFile(): Promise<string | null>;
export declare function importCoreFile(): Promise<unknown>;
export declare function openNotebookPath(root: string): Promise<unknown>;
/** Scaffold a blank Notebook in an empty folder, then switch Core to it. */
export declare function createNotebookPath(root: string, title?: string): Promise<unknown>;
export { requestJson as coreRequestJson };
