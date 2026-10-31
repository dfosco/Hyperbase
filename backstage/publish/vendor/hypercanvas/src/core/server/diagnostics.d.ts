import { type DiagnosticIncident } from './diagnostics/contract.js';
export declare const MAX_DIAGNOSTIC_LOG_ENTRIES = 20;
export declare function redactDiagnosticText(value: unknown): string;
export declare function sanitizeDiagnostics(value: unknown, key?: string, depth?: number): unknown;
export interface DiagnosticLogOptions {
    limit?: number;
    now?: Date;
}
export declare function readRecentDiagnosticLogs(logsDirectory: unknown, { limit, now }?: DiagnosticLogOptions): unknown[];
/** Read the Go-owned desktop incident snapshot. Core never appends to this file. */
export declare function readDesktopDiagnosticIncidents(stateDirectory: unknown): DiagnosticIncident[];
interface DiagnosticContext {
    method?: string;
}
type SendJson = (response: object, status: number, body: unknown) => void;
interface DiagnosticsHandlerOptions {
    getSnapshot?: () => unknown | Promise<unknown>;
    sendJson?: SendJson;
}
export declare function createDiagnosticsHandler({ getSnapshot, sendJson }?: DiagnosticsHandlerOptions): (request: unknown, response: object, context?: DiagnosticContext) => Promise<void>;
export {};
