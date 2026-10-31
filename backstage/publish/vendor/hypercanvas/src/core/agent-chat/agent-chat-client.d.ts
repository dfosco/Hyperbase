/**
 * Agent Chat Transport — same-origin fetch wrapper for /_hypercanvas/paseo-agents.
 *
 * All daemon credentials stay server-side. This module only talks to
 * same-origin Storyboard routes. Injectable for tests.
 */
export declare const AGENT_RUNTIME_STATE_CHANGED_EVENT = "storyboard:agent-runtime-state-changed";
export type AgentChatPermissionResponse = Readonly<{
    behavior: 'allow' | 'deny';
}>;
export type TimelineRequestOptions = Readonly<{
    direction?: 'tail' | 'before' | 'after';
    cursor?: Readonly<{
        epoch: string;
        seq: number;
    }>;
    limit?: number;
    projection?: 'projected' | 'canonical';
}>;
export type AgentChatTransport = Readonly<{
    health(): Promise<unknown>;
    listAvailableProviders(): Promise<unknown>;
    listModels(provider: string): Promise<unknown>;
    createAgent(config: unknown, title?: string, context?: unknown): Promise<unknown>;
    getAgent(agentId: string): Promise<unknown>;
    listAgents(): Promise<unknown>;
    sendMessage(agentId: string, text: string, clientMessageId?: string): Promise<unknown>;
    cancelTurn(agentId: string): Promise<unknown>;
    respondToPermission(agentId: string, requestId: string, response: AgentChatPermissionResponse): Promise<unknown>;
    fetchTimeline(agentId: string, options?: TimelineRequestOptions): Promise<unknown>;
    archiveAgent(agentId: string): Promise<unknown>;
}>;
/** Notify mounted Agent surfaces after the host/provider runtime was rechecked. */
export declare function notifyAgentRuntimeStateChanged(detail?: unknown): void;
export declare const agentChatTransport: AgentChatTransport;
