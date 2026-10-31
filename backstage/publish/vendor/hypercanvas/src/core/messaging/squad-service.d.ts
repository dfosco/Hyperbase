/** Notebook/daemon-scoped Squad membership and numbered room operations. */
type JsonRecord = Record<string, unknown>;
interface MemberMetadata extends JsonRecord {
    role: 'leader' | 'member';
}
interface SquadMetadata extends JsonRecord {
    squadId: string;
    workspaceId: string;
    daemonId: string;
    name: string;
    leaderId: string;
    members: Record<string, MemberMetadata>;
    createdAt: string;
    broadcast?: {
        canvasId: string;
        enabled: boolean;
    };
}
interface AgentBinding extends JsonRecord {
    widgetId: string;
    agentId: string;
    provider: string;
    workspaceId: string;
    daemonId: string;
    updatedAt: string;
    sessionId?: string;
}
interface BindingState {
    squadId: string;
    workspaceId: string;
    daemonId: string;
    bindings: Record<string, AgentBinding>;
    history: JsonRecord[];
}
interface BindingInput {
    agentId?: unknown;
    provider?: unknown;
    sessionId?: unknown;
    transition?: unknown;
    reason?: unknown;
}
interface CreateSquadInput {
    leaderId: unknown;
    memberIds?: unknown;
    name?: unknown;
    canvasId?: unknown;
}
interface SquadMessage extends JsonRecord {
    kind: 'information' | 'instruction';
    description: string;
    to?: string[];
    inject?: boolean;
    replyTo?: number;
    response?: 'ack' | 'status' | 'result' | 'blocked';
}
interface LedgerEntry extends JsonRecord {
    number: number;
    timestamp: string;
    author: string;
    kind: string;
    description: string;
    to?: string[];
    inject?: boolean;
    replyTo?: number;
    response?: string;
    data?: JsonRecord;
}
interface LedgerReadOptions {
    after?: number;
    limit?: number;
}
interface SquadLedgerStore {
    append(squadId: string, author: string, message: SquadMessage): Promise<LedgerEntry>;
    appendSystem(squadId: string, kind: string, description: string, data?: JsonRecord | null): Promise<LedgerEntry>;
    get(squadId: string, number: number): Promise<LedgerEntry | null>;
    read(squadId: string, options?: LedgerReadOptions): Promise<LedgerEntry[]>;
}
export declare class SquadService {
    readonly root: string;
    readonly workspaceId: string;
    readonly daemonId: string;
    readonly baseDir: string;
    readonly ledger: SquadLedgerStore;
    constructor({ root, workspaceId, daemonId }: {
        root: unknown;
        workspaceId: unknown;
        daemonId: unknown;
    });
    _metadataPath(squadId: string): string;
    _readMetadata(squadId: string): SquadMetadata;
    _readBindings(squadId: string): BindingState;
    _writeBindings(squadId: string, state: BindingState): void;
    getAgentBinding(squadId: string, widgetId: string): Promise<AgentBinding | null>;
    findAgentBindings(agentId: string): Promise<Array<{
        squadId: string;
        widgetId: string;
        binding: AgentBinding;
    }>>;
    appendSystemEvent(squadId: string, kind: string, description: string, data?: JsonRecord | null): Promise<LedgerEntry>;
    authorizeDeliveryRetry(squadId: string, widgetId: string, number: number, { force }?: {
        force?: boolean;
    }): Promise<{
        entry: LedgerEntry;
        metadata: SquadMetadata;
        events: LedgerEntry[];
    }>;
    bindAgent(squadId: string, widgetId: string, { agentId, provider, sessionId, transition, reason }?: BindingInput): Promise<AgentBinding>;
    private mutateGroup;
    create(input: CreateSquadInput): Promise<SquadMetadata>;
    private createGroup;
    list(widgetId: string): Promise<Array<SquadMetadata & {
        activeMemberIds: string[];
        agentBindings: Record<string, AgentBinding>;
    }>>;
    private writeMetadata;
    private notifyChanged;
    private activeMemberIds;
    assertCanCoordinate(squadId: string, author: string, recipients: string[]): void;
    private assertNoOverlappingBroadcast;
    setBroadcast(canvasId: string, widgetId: string, enabled: boolean, squadId?: string): Promise<SquadMetadata | null>;
    private changeBroadcast;
    append(squadId: string, widgetId: string, message: unknown): Promise<LedgerEntry>;
    read(squadId: string, widgetId: string, options?: LedgerReadOptions): Promise<LedgerEntry[]>;
    get(squadId: string, widgetId: string, number: number): Promise<LedgerEntry | null>;
    reconcile(squadId: string, widgetId: string): Promise<Array<{
        number: number;
        instruction: LedgerEntry;
        recipient: string;
        state: 'awaiting_ack' | 'blocked' | 'completed' | 'awaiting_leader_ack' | 'in_progress' | 'acknowledged';
        replies: LedgerEntry[];
        latestReply: LedgerEntry | null;
        result?: LedgerEntry;
        leaderAcknowledgement?: LedgerEntry;
    }>>;
    promoteLeader(squadId: string, actorWidgetId: string, targetWidgetId: string): Promise<SquadMetadata>;
    private promoteGroupLeader;
    nudgeMember(squadId: string, actorWidgetId: string, targetWidgetId: string, description?: string): Promise<LedgerEntry>;
}
export {};
