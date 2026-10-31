/**
 * Messaging Bus Schema
 *
 * ULID generation, envelope validation, and status constants.
 * Zero npm dependencies — ULID is inlined (~30 lines).
 */
/**
 * Generate a monotonic ULID.
 * Same-millisecond calls increment the random component to guarantee sort order.
 * @returns {string} 26-character ULID
 */
export declare function generateId(): string;
export declare const STATUS: Readonly<{
    readonly PENDING: "pending";
    readonly ACKNOWLEDGED: "acknowledged";
    readonly RESOLVED: "resolved";
    readonly DISMISSED: "dismissed";
    readonly FAILED: "failed";
    readonly TIMED_OUT: "timed_out";
    readonly CANCELLED: "cancelled";
}>;
/**
 * Validate a message envelope. Returns { valid, errors }.
 * Domain extension fields (not in CORE_FIELDS) are passed through without validation.
 *
 * @param {object} event
 * @returns {{ valid: boolean, errors: string[] }}
 */
export interface EnvelopeValidation {
    valid: boolean;
    errors: string[];
}
export type EnvelopeFields = Record<string, unknown> & {
    id?: unknown;
    timestamp?: unknown;
    channel: unknown;
    type: unknown;
    senderId: unknown;
    senderName?: unknown;
    body?: unknown;
    payload?: unknown;
    correlationId?: unknown;
    status?: unknown;
    inReplyTo?: unknown;
};
export declare function validateEnvelope(event: unknown): EnvelopeValidation;
/**
 * Create a message envelope with defaults filled in.
 * Caller provides at minimum: channel, type, senderId.
 * Domain-specific fields are spread through as-is.
 *
 * @param {object} fields
 * @returns {object} Complete envelope
 */
export declare function createEnvelope(fields: EnvelopeFields): Record<string, unknown>;
