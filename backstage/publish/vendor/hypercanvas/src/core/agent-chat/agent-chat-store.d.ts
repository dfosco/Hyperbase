/**
 * Agent Chat Store — framework-agnostic conversation state for Paseo agents.
 *
 * Implements the reconciliation rules distilled from getpaseo/paseo's own chat
 * (see .agents/plans/paseo-agent-chat-ui-exploration.md):
 *
 * - Per-agent cursor `{ epoch, startSeq, endSeq }` as the spine. Stream events
 *   are gated: stale → drop, contiguous → apply + advance, gap → drop + refetch
 *   after the cursor, epoch change → tail refetch (seq 1 of a new epoch resets).
 * - Head/tail model: assistant text streams in `head`; completed items flush to
 *   `items` (tail). Terminal turn events flush the head.
 * - Per-type row identity: tool_call by callId (status precedence), user by
 *   clientMessageId || messageId, assistant extends by messageId.
 * - Optimistic sends with a clientMessageId submission ledger; the optimistic
 *   row is only removed while still unreconciled.
 * - Queued stream events are drained before a fetched page is applied, so a
 *   canonical page can't clobber just-received live chunks.
 *
 * Zero npm dependencies. Transport is injectable for tests.
 */
import type { AgentChatTransport } from './agent-chat-client.js';
export type AgentChatCursor = {
    epoch: string;
    startSeq: number;
    endSeq: number;
};
export type AgentChatEventCursor = Readonly<{
    epoch: string;
    seq: number;
}>;
export type AgentChatItem = {
    type: string;
    text?: string;
    messageId?: string;
    clientMessageId?: string;
    cursor?: AgentChatEventCursor;
    status?: string;
    callId?: string;
    requestId?: string;
    detail?: unknown;
    error?: unknown;
    [key: string]: unknown;
};
export type AgentChatPermission = {
    id: string;
    [key: string]: unknown;
};
export type AgentChatSubmission = {
    clientMessageId: string;
    messageId?: string;
};
export type AgentChatState = {
    agentId: string;
    initialized: boolean;
    cursor: AgentChatCursor | null;
    hasOlder: boolean;
    olderAvailable: boolean;
    items: AgentChatItem[];
    head: AgentChatItem[];
    permissions: AgentChatPermission[];
    submissions: AgentChatSubmission[];
    turnActive: boolean;
    cancelling: boolean;
    attention: unknown;
    needCatchUp: boolean;
    error: unknown;
    sendError: string | null;
};
export type AgentChatStreamEvent = {
    type: 'timeline';
    item?: AgentChatItem;
    seq?: number | null;
    epoch?: string | null;
} | {
    type: 'turn_started';
} | {
    type: 'turn_completed';
} | {
    type: 'turn_failed';
    error?: unknown;
} | {
    type: 'turn_canceled';
} | {
    type: 'permission_requested';
    request?: unknown;
} | {
    type: 'permission_resolved';
    requestId?: string;
} | {
    type: 'attention_required';
    reason?: unknown;
};
type TimelinePage = {
    reset?: boolean;
    epoch?: string;
    startCursor?: {
        epoch?: string | null;
        seq?: number | null;
    };
    endCursor?: {
        epoch?: string | null;
        seq?: number | null;
    };
    window?: {
        minSeq?: number | null;
        maxSeq?: number | null;
    };
    hasOlder?: boolean;
    entries: Array<AgentChatItem | {
        item: AgentChatItem;
    }>;
    agent?: {
        activeTurn?: unknown;
    };
};
export declare function generateMessageId(): string;
export declare function itemIdentity(item: AgentChatItem | null | undefined): string | null;
export declare function classifyStreamSeq(cursor: AgentChatCursor | null, epoch: string, seq: number): 'no_cursor' | 'drop_epoch' | 'drop_stale' | 'accept' | 'gap';
export declare function createEmptyState(agentId?: string): AgentChatState;
export declare function applyStreamEvent(state: AgentChatState, untrustedEvent: unknown): AgentChatState;
/**
 * Drain queued stream events into state (used before fetched pages land).
 */
export declare function applyStreamEvents(state: AgentChatState, events: readonly unknown[]): AgentChatState;
/**
 * Apply a fetched timeline page. Directions:
 * - reset (page.reset or first load) → replace
 * - 'tail'/'after' → resume-tail policy (epoch → replace; adds nothing → discard;
 *   server rewound → replace; gap → replace with continuity; else append)
 * - 'before' → prepend merge, update hasOlder only when coverage expanded
 */
export declare function applyTimelinePage(state: AgentChatState, page: TimelinePage, { direction }?: {
    direction?: 'tail' | 'after' | 'before';
}): AgentChatState;
/**
 * Canonical rows can acknowledge optimistic submissions (dual-path ack:
 * RPC settle + canonical observation).
 */
export declare function submitAcknowledged(state: Pick<AgentChatState, 'submissions'>, fetchedCanonical: readonly AgentChatItem[]): AgentChatSubmission[];
export declare function beginSubmission(state: AgentChatState, clientMessageId: string, text: string): AgentChatState;
export declare function rejectSubmission(state: AgentChatState, clientMessageId: string): AgentChatState;
export declare function settleSubmission(state: AgentChatState, clientMessageId: string): AgentChatState;
export declare class AgentChatStore {
    #private;
    state: AgentChatState;
    constructor({ transport, agentId }: {
        transport: AgentChatTransport;
        agentId?: string;
    });
    get agentId(): string;
    setAgentId(agentId: string): void;
    subscribe(listener: () => void): () => void;
    getSnapshot(): AgentChatState;
    enqueueStreamEvent(event: unknown): boolean;
    initialize({ agentId }?: {
        agentId?: string;
    }): Promise<AgentChatState | boolean | undefined>;
    catchUpIfNeeded(): Promise<AgentChatState | boolean | undefined>;
    loadOlder(): Promise<boolean>;
    send(text: string): Promise<boolean>;
    cancel(): Promise<boolean>;
    respondToPermission(requestId: string, behavior: 'allow' | 'deny'): Promise<boolean>;
}
export {};
