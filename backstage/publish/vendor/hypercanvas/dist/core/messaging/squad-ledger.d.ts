/** Minimal, writer-numbered JSONL ledger for a Squad room. */
export type SquadMessageKind = 'information' | 'instruction';
export type SquadResponse = 'ack' | 'status' | 'result' | 'blocked';
export interface SquadMessage {
    kind: SquadMessageKind;
    description: string;
    to?: string[];
    inject?: boolean;
    attachments?: Array<string | Record<string, unknown>>;
    files?: string[];
    replyTo?: number;
    response?: SquadResponse;
}
export interface SquadLedgerEntry extends Record<string, unknown> {
    number: number;
    timestamp: string;
    author: string;
    kind: string;
    description: string;
    to?: string[];
    inject?: boolean;
    attachments?: Array<string | Record<string, unknown>>;
    files?: string[];
    replyTo?: number;
    response?: string;
    data?: Record<string, unknown>;
}
export interface SquadLedgerReadOptions {
    after?: number;
    limit?: number;
}
interface ValidationResult {
    valid: boolean;
    errors: string[];
}
/** Validate caller-authored message fields, excluding writer-owned metadata. */
export declare function validateSquadMessage(message: unknown): ValidationResult;
/**
 * Owns serialized append ordering for each room. Calls within one Core process
 * share a per-room promise queue; JSONL remains the source of truth on restart.
 */
export declare class SquadLedger {
    readonly baseDir: string;
    private readonly now;
    constructor({ root, directory, now }: {
        root: string;
        directory?: string;
        now?: () => Date;
    });
    _filePath(squadId: string): string;
    append(squadId: string, verifiedAuthor: string, message: unknown): Promise<SquadLedgerEntry>;
    appendSystem(squadId: string, kind: string, description: string, data?: unknown): Promise<SquadLedgerEntry>;
    _append(squadId: string, createEntry: (number: number, timestamp: string) => SquadLedgerEntry): Promise<SquadLedgerEntry>;
    read(squadId: string, { after, limit }?: SquadLedgerReadOptions): Promise<SquadLedgerEntry[]>;
    get(squadId: string, number: number): Promise<SquadLedgerEntry | null>;
}
export {};
