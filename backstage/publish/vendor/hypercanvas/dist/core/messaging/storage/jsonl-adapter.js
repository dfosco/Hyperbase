/**
 * JSONL Storage Adapter
 *
 * Persists messages as one JSON object per line in .storyboard/messages/{channel}.jsonl.
 * Channel names with '/' create subdirectories. ':' is replaced with '--' for filesystem safety.
 *
 */
import fs from 'node:fs';
import path from 'node:path';
function eventField(event, name) {
    return event[name];
}
/**
 * Sanitize a channel name for use as a filename.
 * - Replace ':' with '--'
 * - Preserve '/' for subdirectory nesting
 */
function sanitizeChannel(channel) {
    return channel.replace(/:/g, '--');
}
export class JsonlAdapter {
    baseDir;
    constructor({ root, messagesDir = '.hypercanvas/messages' }) {
        this.baseDir = path.join(root, messagesDir);
    }
    async init() {
        fs.mkdirSync(this.baseDir, { recursive: true });
    }
    /** Synchronous init — for use in non-async contexts like Vite configureServer */
    initSync() {
        fs.mkdirSync(this.baseDir, { recursive: true });
    }
    /**
     * Get the file path for a channel.
     */
    _filePath(channel) {
        return path.join(this.baseDir, `${sanitizeChannel(channel)}.jsonl`);
    }
    /**
     * Append a single event to a channel's JSONL file.
     * Creates the file and parent directories if they don't exist.
     */
    async append(channel, event) {
        const filePath = this._filePath(channel);
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf8');
    }
    /**
     * Read events from a channel's JSONL file.
     */
    async read(channel, opts = {}) {
        const filePath = this._filePath(channel);
        if (!fs.existsSync(filePath))
            return [];
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        let events = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed !== null && typeof parsed === 'object') {
                    events.push(parsed);
                }
            }
            catch {
                // Skip malformed lines
            }
        }
        // Filter by `since` — return events after the given ID (ULID string comparison)
        if (opts.since) {
            const sinceIdx = events.findIndex((event) => eventField(event, 'id') === opts.since);
            if (sinceIdx !== -1) {
                events = events.slice(sinceIdx + 1);
            }
            else {
                // If the since ID isn't found, filter by string comparison (ULIDs are lexicographically sorted)
                events = events.filter((event) => {
                    const id = eventField(event, 'id');
                    return typeof id === 'string' && id > opts.since;
                });
            }
        }
        // Filter by type prefix
        if (opts.type) {
            events = events.filter((event) => {
                const type = eventField(event, 'type');
                return typeof type === 'string' && type.startsWith(opts.type);
            });
        }
        // Apply limit
        if (opts.limit && opts.limit > 0) {
            events = events.slice(0, opts.limit);
        }
        return events;
    }
    async close() {
        // No-op for JSONL — all writes are synchronous
    }
}
