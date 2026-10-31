/** Attention delivery layered over the durable, numbered Squad room. */
type DeliveryState = 'failed' | 'indeterminate' | 'submitted';
type DeliveryStatus = DeliveryState | 'already_submitted';
export interface DeliveryLedgerEntry extends Record<string, unknown> {
    number: number;
    author: string;
    description: string;
    kind: string;
    to?: string[];
    data?: Record<string, unknown>;
}
export interface DeliveryService {
    assertCanCoordinate?(squadId: string, author: string, recipients: string[]): void;
    read(squadId: string, widgetId: string): Promise<DeliveryLedgerEntry[]>;
    getAgentBinding(squadId: string, widgetId: string): Promise<{
        agentId?: string;
    } | null>;
    appendSystemEvent(squadId: string, kind: string, description: string, data?: Record<string, unknown>): Promise<unknown>;
}
interface DeliveryOptions {
    submitTerminalText?: (sessionId: string, text: string, options: {
        submit: true;
        paste: true;
        canWrite: () => boolean;
    }) => Promise<{
        accepted?: boolean;
        submitted?: boolean;
    } | unknown>;
    sessionFor?: (widgetId: string) => Promise<string | null | undefined>;
    isReady?: (widgetId: string) => boolean;
    sendAgentMessage?: (agentId: string, text: string) => Promise<unknown>;
    force?: boolean;
}
export interface DeliveryResult {
    recipient: string;
    status: DeliveryStatus;
    transport?: 'paseo-agent' | 'terminal-pty';
    error?: string;
}
export declare function formatSquadInjection(squadId: string, entry: Pick<DeliveryLedgerEntry, 'number' | 'description'>): string;
/**
 * Deliver one already-committed injectable entry. Each recipient gets one
 * transport, and retries reuse its ledger number rather than appending again.
 */
export declare function deliverSquadEntry(service: DeliveryService, squadId: string, entry: DeliveryLedgerEntry, { submitTerminalText, sessionFor, isReady, sendAgentMessage, force, }?: DeliveryOptions): Promise<DeliveryResult[]>;
export {};
