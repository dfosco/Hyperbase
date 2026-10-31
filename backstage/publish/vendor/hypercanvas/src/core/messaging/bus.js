/**
 * Messaging Bus Core
 *
 * Transport/storage-agnostic publish/subscribe/read API.
 * Singleton within the server process — initialized once with a storage adapter.
 *
 * The bus validates event type prefixes against registered namespaces,
 * delegates persistence to the storage adapter, and notifies in-process
 * subscribers synchronously after append.
 */
import { validateEnvelope, createEnvelope } from './schema.js';
// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------
let adapter = null;
/** Channel → subscriber set. */
const subscribers = new Map();
/** Namespace → registered event names. */
const namespaces = new Map();
/** Subscribers that receive events from all channels. */
const wildcardSubscribers = new Set();
// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
/**
 * Initialize the bus with a storage adapter.
 * Must be called once before any publish/read calls.
 *
 */
export function initBus(storageAdapter) {
    adapter = storageAdapter;
}
/**
 * Get the current bus adapter (for tests / introspection).
 */
export function getAdapter() {
    return adapter;
}
/**
 * Reset the bus state. Primarily for tests.
 */
export function resetBus() {
    adapter = null;
    subscribers.clear();
    namespaces.clear();
    wildcardSubscribers.clear();
}
// ---------------------------------------------------------------------------
// Namespace registration
// ---------------------------------------------------------------------------
/**
 * Register an event namespace with its known event types.
 * Domain adapters call this at startup to declare their events.
 *
 */
export function registerEventNamespace(namespace, opts = {}) {
    namespaces.set(namespace, {
        events: opts.events || [],
    });
}
// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------
/**
 * Publish an event to a channel.
 *
 * 1. Creates a full envelope (fills in id, timestamp, defaults)
 * 2. Validates the envelope
 * 3. Warns if the event type namespace is unregistered (dev mode)
 * 4. Persists via the storage adapter
 * 5. Notifies in-process subscribers
 *
 */
export async function publish(channel, eventFields) {
    if (!adapter) {
        throw new Error('Bus not initialized. Call initBus(adapter) first.');
    }
    // The input is deliberately partial here. The schema check below is the
    // runtime boundary that makes the completed envelope safe to publish.
    const event = createEnvelope({ ...eventFields, channel });
    const { valid, errors } = validateEnvelope(event);
    const fields = event;
    if (typeof fields.id !== 'string' || typeof fields.timestamp !== 'string'
        || typeof fields.channel !== 'string' || typeof fields.type !== 'string'
        || typeof fields.senderId !== 'string') {
        errors.push('Envelope id, timestamp, channel, type, and senderId must be strings');
    }
    if (!valid || errors.length > 0) {
        throw new Error(`Invalid message envelope: ${errors.join(', ')}`);
    }
    const publishedEvent = event;
    // Warn on unregistered namespace (non-fatal in dev)
    const ns = publishedEvent.type.split(':')[0] ?? '';
    if (!namespaces.has(ns)) {
        console.warn(`[messaging-bus] Unregistered event namespace: "${ns}" (type: ${publishedEvent.type})`);
    }
    // Persist
    await adapter.append(channel, publishedEvent);
    // Notify channel subscribers
    const channelSubs = subscribers.get(channel);
    if (channelSubs) {
        for (const handler of channelSubs) {
            try {
                handler(publishedEvent);
            }
            catch (err) {
                console.error(`[messaging-bus] Subscriber error on ${channel}:`, err);
            }
        }
    }
    // Notify wildcard subscribers
    for (const handler of wildcardSubscribers) {
        try {
            handler(channel, publishedEvent);
        }
        catch (err) {
            console.error('[messaging-bus] Wildcard subscriber error:', err);
        }
    }
    return publishedEvent;
}
// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------
/**
 * Subscribe to events on a specific channel.
 */
export function subscribe(channel, handler) {
    if (!subscribers.has(channel)) {
        subscribers.set(channel, new Set());
    }
    const channelSubscribers = subscribers.get(channel);
    if (channelSubscribers) {
        channelSubscribers.add(handler);
    }
    return () => {
        const subs = subscribers.get(channel);
        if (subs) {
            subs.delete(handler);
            if (subs.size === 0)
                subscribers.delete(channel);
        }
    };
}
/**
 * Subscribe to events on ALL channels (wildcard).
 * Handler receives (channel, event).
 */
export function subscribeAll(handler) {
    wildcardSubscribers.add(handler);
    return () => wildcardSubscribers.delete(handler);
}
// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------
/**
 * Read events from a channel.
 *
 */
export async function read(channel, opts = {}) {
    if (!adapter) {
        throw new Error('Bus not initialized. Call initBus(adapter) first.');
    }
    return await adapter.read(channel, opts);
}
/**
 * Read events from multiple channels in one call.
 *
 */
export async function readMulti(channels, opts = {}) {
    if (!adapter) {
        throw new Error('Bus not initialized. Call initBus(adapter) first.');
    }
    const storage = adapter;
    const result = {};
    await Promise.all(channels.map(async (ch) => {
        result[ch] = await storage.read(ch, opts);
    }));
    return result;
}
