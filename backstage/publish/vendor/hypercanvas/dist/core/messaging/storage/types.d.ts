/**
 * Message Storage Adapter Interface
 *
 * Defines the contract for message persistence backends.
 * v1 ships with JSONL only; the interface exists for future extensibility.
 */
export interface ReadOptions {
    /** Return events after this ID (exclusive). ULID-based comparison. */
    since?: string;
    /** Maximum number of events to return. */
    limit?: number;
    /** Filter by event type prefix (for example, `message:`). */
    type?: string;
}
export interface MessageStorageAdapter {
    /** Persist a validated event to the given channel. */
    append(channel: string, event: object): Promise<void>;
    /** Read events in append order (oldest first). */
    read(channel: string, opts?: ReadOptions): Promise<object[]>;
    /** Optional initialization called once at startup. */
    init?(): Promise<void>;
    /** Optional cleanup called on server shutdown. */
    close?(): Promise<void>;
}
export default undefined;
