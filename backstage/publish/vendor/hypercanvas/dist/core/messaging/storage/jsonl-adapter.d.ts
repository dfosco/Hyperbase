/**
 * JSONL Storage Adapter
 *
 * Persists messages as one JSON object per line in .storyboard/messages/{channel}.jsonl.
 * Channel names with '/' create subdirectories. ':' is replaced with '--' for filesystem safety.
 *
 */
import type { MessageStorageAdapter, ReadOptions } from './types.js';
export declare class JsonlAdapter implements MessageStorageAdapter {
    readonly baseDir: string;
    constructor({ root, messagesDir }: {
        root: string;
        messagesDir?: string;
    });
    init(): Promise<void>;
    /** Synchronous init — for use in non-async contexts like Vite configureServer */
    initSync(): void;
    /**
     * Get the file path for a channel.
     */
    _filePath(channel: string): string;
    /**
     * Append a single event to a channel's JSONL file.
     * Creates the file and parent directories if they don't exist.
     */
    append(channel: string, event: object): Promise<void>;
    /**
     * Read events from a channel's JSONL file.
     */
    read(channel: string, opts?: ReadOptions): Promise<object[]>;
    close(): Promise<void>;
}
