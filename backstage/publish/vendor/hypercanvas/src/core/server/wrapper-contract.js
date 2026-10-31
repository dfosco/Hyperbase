/** Lifecycle messages sent from Core to a supervising application wrapper. */
import { sanitizeDiagnosticIncident, validateDiagnosticIncident } from './diagnostics/contract.js';
export const WRAPPER_EVENT_SOURCE = 'hypercanvas-core';
export const WRAPPER_EVENT_VERSION = 1;
export function createWrapperEvent(event, details = {}) {
    if (!['starting', 'ready', 'running', 'error', 'stopped', 'diagnostic', 'operation-progress'].includes(event)) {
        throw new Error(`Unsupported wrapper lifecycle event: ${event}`);
    }
    if (event === 'diagnostic') {
        const result = validateDiagnosticIncident(details.incident);
        if (!result.ok)
            throw new TypeError(`Invalid wrapper diagnostic incident: ${result.reason}`);
        details = { incident: sanitizeDiagnosticIncident(result.incident) };
    }
    return { ...details, schemaVersion: WRAPPER_EVENT_VERSION, source: WRAPPER_EVENT_SOURCE, event };
}
export function encodeWrapperEvent(event, details = {}) {
    return JSON.stringify(createWrapperEvent(event, details));
}
export function encodeWrapperDiagnostic(incident) {
    return encodeWrapperEvent('diagnostic', { incident });
}
