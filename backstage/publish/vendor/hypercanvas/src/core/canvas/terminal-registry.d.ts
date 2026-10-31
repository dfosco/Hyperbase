/**
 * Storyboard terminal session metadata.
 *
 * Hypercanvas PTY owns processes and PTYs. This registry owns product metadata
 * such as branch, canvas, widget, friendly name, archive state, and reconnect
 * generation. It intentionally persists no backend-specific identifiers.
 */
import type { TerminalTerminationContext } from './terminal-runtime.js';
type SessionStatus = 'live' | 'background' | 'archived';
interface SessionEntry {
    sessionId: string;
    runtimeSessionId: string;
    name: string;
    branch: string;
    canvasId: string;
    widgetId: string;
    createdAt: string;
    lastConnectedAt: string | null;
    status: SessionStatus;
    expiresAt: number | null;
    generation: number;
}
interface SessionConflict {
    currentBranch: string;
    currentCanvas: string;
    currentWidget: string;
}
interface SessionStats {
    live: number;
    background: number;
    archived: number;
    total: number;
}
export declare function generateFriendlyName(): string;
export declare function findByName(name: string): SessionEntry | null;
export declare function generateSessionId(branch: string, canvasId: string, widgetId: string): string;
export declare function initRegistry(root: string, options?: {
    gracePeriod?: number | null;
}): void;
export declare function reconcileRegistry(): Promise<void>;
export declare function registerSession({ branch, canvasId, widgetId, prettyName, runtimeSessionId }: {
    branch: string;
    canvasId: string;
    widgetId: string;
    prettyName?: string | null;
    runtimeSessionId?: string | null;
}): {
    entry: SessionEntry;
    conflict: SessionConflict | null;
};
export declare function adoptRuntimeSession(sessionId: string, runtimeSessionId: string): SessionEntry | null;
export declare function disconnectSession(sessionId: string, generation: number): void;
export declare function orphanSession(sessionId: string, gracePeriod?: number): SessionEntry | null;
export declare function orphanSessionByWidget(branch: string, canvasId: string, widgetId: string, gracePeriod?: number): SessionEntry | null;
export declare function detachSession(sessionId: string): SessionEntry | null;
export declare function killSession(sessionId: string, context?: TerminalTerminationContext): Promise<boolean>;
export declare function bulkCleanup({ statuses }: {
    statuses: SessionStatus[];
}): Promise<{
    removed: number;
    remaining: SessionStats;
}>;
export declare function getSessionStats(): SessionStats;
export declare function getSession(sessionId: string): SessionEntry | null;
export declare function getSessionByWidget(branch: string, canvasId: string, widgetId: string): SessionEntry | null;
export declare function listSessions(filterBranch?: string | null): SessionEntry[];
export declare function findSessionIdForWidget(widgetId: string): string | null;
export declare function resetRegistryForTests(): void;
export {};
