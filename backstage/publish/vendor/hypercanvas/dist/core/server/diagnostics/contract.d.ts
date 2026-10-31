export declare const DIAGNOSTIC_SCHEMA_VERSION: 1;
export declare const MAX_DIAGNOSTIC_TEXT_LENGTH = 2000;
export type DiagnosticRuntime = 'mygo' | 'core';
export type DiagnosticRecoveryAction = 'retry-core' | 'reload-page' | 'restart-app' | 'open-diagnostics';
export type DiagnosticRecoveryState = 'recovering' | 'recovered' | 'exhausted' | 'manual';
export interface DiagnosticCatalogEntry {
    code: string;
    title: string;
    description: string;
    runtime: DiagnosticRuntime;
    component: string;
}
export interface DiagnosticRecovery {
    state: DiagnosticRecoveryState;
    attempt: number;
    limit: number;
    action?: DiagnosticRecoveryAction;
}
export interface DiagnosticLocation {
    file: string;
    line?: number;
}
export type DiagnosticDetail = string | number | boolean | null;
export interface DiagnosticIncident {
    schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION;
    incidentId: string;
    correlationId: string;
    occurredAt: string;
    code: string;
    title: string;
    description: string;
    runtime: DiagnosticRuntime;
    component: string;
    instruction?: string;
    details?: Record<string, DiagnosticDetail>;
    location?: DiagnosticLocation;
    recovery?: DiagnosticRecovery;
}
export interface DiagnosticSnapshot {
    schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION;
    incidents: DiagnosticIncident[];
}
export declare const MAX_DIAGNOSTIC_HISTORY: number;
export declare const MAX_DIAGNOSTIC_SNAPSHOT_BYTES: number;
export declare const DIAGNOSTIC_CATALOG: readonly DiagnosticCatalogEntry[];
export declare function getDiagnosticCatalogEntry(code: string): DiagnosticCatalogEntry | undefined;
export declare function createDiagnosticIncident(code: string, options?: {
    correlationId?: string;
    runtime?: DiagnosticRuntime;
    component?: string;
    occurredAt?: Date;
    instruction?: string;
    details?: Record<string, DiagnosticDetail>;
    location?: DiagnosticLocation;
    recovery?: DiagnosticRecovery;
}): DiagnosticIncident;
/** Convert an untrusted failure report into a safe incident without dropping its original message. */
export declare function createUnknownDiagnosticIncident(original: unknown, options?: {
    correlationId?: string;
    runtime?: DiagnosticRuntime;
    component?: string;
    occurredAt?: Date;
}): DiagnosticIncident;
export declare function validateDiagnosticIncident(value: unknown): {
    ok: true;
    incident: DiagnosticIncident;
} | {
    ok: false;
    reason: string;
};
export declare function sanitizeDiagnosticIncident(incident: DiagnosticIncident): DiagnosticIncident;
export declare function redactDiagnosticText(value: unknown): string;
export declare function readDiagnosticSnapshot(value: unknown): DiagnosticSnapshot;
