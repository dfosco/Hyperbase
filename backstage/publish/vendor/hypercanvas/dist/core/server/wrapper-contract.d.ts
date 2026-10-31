/** Lifecycle messages sent from Core to a supervising application wrapper. */
import { type DiagnosticIncident } from './diagnostics/contract.js';
export declare const WRAPPER_EVENT_SOURCE = "hypercanvas-core";
export declare const WRAPPER_EVENT_VERSION = 1;
export type WrapperEventName = 'starting' | 'ready' | 'running' | 'error' | 'stopped' | 'diagnostic' | 'operation-progress';
export type WrapperEventDetails = Record<string, unknown>;
export interface WrapperEvent extends WrapperEventDetails {
    schemaVersion: typeof WRAPPER_EVENT_VERSION;
    source: typeof WRAPPER_EVENT_SOURCE;
    event: WrapperEventName;
}
export declare function createWrapperEvent(event: WrapperEventName, details?: WrapperEventDetails): WrapperEvent;
export declare function encodeWrapperEvent(event: WrapperEventName, details?: WrapperEventDetails): string;
export declare function encodeWrapperDiagnostic(incident: DiagnosticIncident): string;
