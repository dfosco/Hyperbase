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
import type { MessageStorageAdapter, ReadOptions } from './storage/types.js';
/**
 * Augment this interface to connect a namespaced event type with its payload.
 * Unregistered event names remain supported and carry an `unknown` payload.
 */
export interface EventPayloadMap {
}
type PayloadFor<EventType extends string> = EventType extends keyof EventPayloadMap ? EventPayloadMap[EventType] : unknown;
/** A validated event envelope. Domain-specific extension fields are retained. */
export type MessageEnvelope<EventType extends string = string> = Record<string, unknown> & {
    id: string;
    timestamp: string;
    channel: string;
    type: EventType;
    senderId: string;
    senderName: unknown | null;
    body: unknown | null;
    payload: PayloadFor<EventType> | null;
    correlationId: unknown | null;
    status: string | null;
    inReplyTo: unknown | null;
};
/** Caller-supplied fields before the bus adds the channel and defaults. */
export type PublishFields<EventType extends string = string> = Record<string, unknown> & {
    type?: EventType;
    senderId?: string;
    payload?: PayloadFor<EventType> | null;
};
type ChannelSubscriber<EventType extends string = string> = (event: MessageEnvelope<EventType>) => void;
type WildcardSubscriber<EventType extends string = string> = (channel: string, event: MessageEnvelope<EventType>) => void;
/**
 * Initialize the bus with a storage adapter.
 * Must be called once before any publish/read calls.
 *
 */
export declare function initBus(storageAdapter: MessageStorageAdapter): void;
/**
 * Get the current bus adapter (for tests / introspection).
 */
export declare function getAdapter(): MessageStorageAdapter | null;
/**
 * Reset the bus state. Primarily for tests.
 */
export declare function resetBus(): void;
/**
 * Register an event namespace with its known event types.
 * Domain adapters call this at startup to declare their events.
 *
 */
export declare function registerEventNamespace(namespace: string, opts?: {
    events?: string[];
}): void;
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
export declare function publish<EventType extends string = string>(channel: string, eventFields: PublishFields<EventType>): Promise<MessageEnvelope<EventType>>;
/**
 * Subscribe to events on a specific channel.
 */
export declare function subscribe<EventType extends string = string>(channel: string, handler: ChannelSubscriber<EventType>): () => void;
/**
 * Subscribe to events on ALL channels (wildcard).
 * Handler receives (channel, event).
 */
export declare function subscribeAll<EventType extends string = string>(handler: WildcardSubscriber<EventType>): () => boolean;
/**
 * Read events from a channel.
 *
 */
export declare function read<EventType extends string = string>(channel: string, opts?: ReadOptions): Promise<MessageEnvelope<EventType>[]>;
/**
 * Read events from multiple channels in one call.
 *
 */
export declare function readMulti<EventType extends string = string>(channels: string[], opts?: ReadOptions): Promise<Record<string, MessageEnvelope<EventType>[]>>;
export {};
