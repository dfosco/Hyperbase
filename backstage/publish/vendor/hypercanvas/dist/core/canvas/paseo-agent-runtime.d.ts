/**
 * Paseo Agent Runtime — server-side lifecycle for Paseo-backed agent chats.
 *
 * Uses ONLY the public `@getpaseo/client` SDK (loaded dynamically so the
 * feature degrades gracefully when the package is absent). Daemon credentials
 * stay server-side; the browser talks to same-origin /_hypercanvas/paseo-agents
 * routes and receives events through Vite HMR custom events.
 *
 * Exposes agent lifecycle (create/ref/list/archive), provider discovery,
 * message sends, permission responses, timeline pagination, and turn
 * cancellation — plus event forwarding of `agent_update` and `agent_stream`
 * payloads to the browser.
 */
import type { PaseoConnectionOptions } from './paseo-runtime-client.js';
export declare const MAX_TEXT_LENGTH = 32000;
/** Env marker distinguishing Paseo agent-chat sessions from terminal PTY sessions. */
export declare const AGENT_SURFACE_CHAT = "agent-chat";
type UnknownRecord = Record<string, unknown>;
type AgentSnapshot = UnknownRecord & {
    id: string;
    workspaceId?: string | null;
    status?: string;
};
type AgentUpdate = UnknownRecord & {
    status?: string;
    agent?: AgentSnapshot;
    state?: string;
};
type AgentEvent = UnknownRecord & {
    type?: string;
    request?: unknown;
    requestId?: unknown;
};
type TimelineOptions = {
    projection?: string;
    limit?: number;
    direction?: string;
    cursor?: unknown;
};
interface AgentHandle {
    id: string;
    workspaceId?: string | null;
    current: () => AgentSnapshot | null | undefined;
    refresh: () => Promise<{
        agent?: AgentSnapshot;
    } | null | undefined>;
    subscribe: (listener: (update: AgentUpdate) => void) => () => void;
    timeline: {
        subscribe: (listener: (event: AgentEvent) => void) => () => void;
        refetch: (options: TimelineOptions) => Promise<unknown>;
    };
    send: (text: string, options: {
        messageId?: string;
    }) => Promise<unknown>;
    respondToPermission: (input: {
        requestId: string;
        response: PermissionResponse;
    }) => Promise<unknown>;
    archive: () => Promise<unknown>;
}
interface AgentClient {
    providers: {
        listAvailable: (input: Record<string, never>) => Promise<unknown>;
        listModels: (provider: string, input: Record<string, never>) => Promise<unknown>;
    };
    agents: {
        ref: (agentId: string) => AgentHandle;
        list: (options: {
            subscribe?: Record<string, never>;
        }) => Promise<AgentList>;
    };
    workspaces: {
        ref: (workspaceId: string) => {
            agents: {
                create: (input: UnknownRecord) => Promise<AgentHandle>;
            };
        };
    };
}
type AgentList = {
    entries?: unknown[];
    pageInfo?: unknown;
};
type PermissionResponse = {
    behavior: 'allow' | 'deny';
    [key: string]: unknown;
};
type AgentContext = {
    widgetId?: string;
    workspaceId?: string;
    [key: string]: unknown;
};
type CreateAgentInput = {
    config?: UnknownRecord & {
        provider?: string;
    };
    title?: string;
    context?: AgentContext;
};
type RuntimeOptions = {
    root?: string;
    wsSend?: (event: UnknownRecord) => unknown;
    client?: AgentClient;
    daemon?: AgentDaemon;
    daemonReady?: boolean;
    connectionOptions?: PaseoConnectionOptions;
    workspaceId?: string | null;
    workspaceIdResolver?: (client: AgentClient | null, root?: string) => Promise<string | null | undefined> | string | null | undefined;
    silent?: boolean;
};
type AgentDaemon = {
    connect?: () => Promise<void>;
    close?: () => Promise<void> | void;
    getConnectionState?: () => {
        status?: string;
        reason?: string;
        [key: string]: unknown;
    } | null;
    cancelAgent?: (agentId: string) => Promise<unknown>;
};
interface AgentRuntime {
    eventKind: string;
    health: () => Promise<UnknownRecord>;
    resolveWorkspaceId: () => Promise<string | null | undefined>;
    listAvailableProviders: () => Promise<unknown>;
    listModels: (provider: string) => Promise<unknown>;
    createAgent: (input?: CreateAgentInput) => Promise<unknown>;
    getAgent: (agentId: string) => Promise<unknown>;
    listAgents: (options?: {
        subscribe?: boolean;
    }) => Promise<AgentList>;
    sendMessage: (agentId: string, text: string, options?: {
        messageId?: string;
    }) => Promise<{
        ok: true;
    }>;
    cancelTurn: (agentId: string) => Promise<{
        ok: true;
    }>;
    respondToPermission: (agentId: string, input?: {
        requestId?: string;
        response?: PermissionResponse;
    }) => Promise<{
        ok: true;
    }>;
    fetchTimeline: (agentId: string, options?: {
        direction?: string;
        cursor?: unknown;
        limit?: number;
        projection?: string;
    }) => Promise<unknown>;
    archiveAgent: (agentId: string) => Promise<unknown>;
    close: () => void;
}
export declare function initPaseoAgentRuntime(options?: RuntimeOptions): Promise<AgentRuntime>;
/**
 * Get (or lazily create) the runtime. Returns null when the Paseo SDK is
 * unavailable so callers can serve diagnostics instead of crashing.
 */
export declare function getPaseoAgentRuntime(options?: RuntimeOptions): Promise<AgentRuntime | null>;
export declare function disposePaseoAgentRuntime(): void;
export declare const _resetPaseoAgentRuntime: typeof disposePaseoAgentRuntime;
export {};
