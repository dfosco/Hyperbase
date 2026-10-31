/** Pre-warmed Hypercanvas PTY sessions for terminals, prompts, and agents. */
type WarmSession = {
    id: string;
    poolId: string;
    runtimeSessionId: string;
    createdAt: number;
    state: 'warming' | 'ready' | 'acquired' | 'consumed' | 'dead';
};
type PoolConfig = {
    pool_size?: number;
    max_pool_size?: number;
    load_balancer_cooldown_mins?: number;
    enabled?: boolean;
    verbose?: boolean;
    load_balancer?: boolean;
};
type HotPoolSettings = PoolConfig & {
    default_pool_size?: number;
    default_max_pool_size?: number;
    pools?: Record<string, PoolConfig>;
};
type AgentPoolConfig = {
    default?: boolean;
    startupCommand?: string;
};
type HotPoolManagerOptions = HotPoolOptions & {
    config?: HotPoolSettings;
    agentsConfig?: Record<string, AgentPoolConfig>;
    promptAgentId?: string | null;
};
type HotPoolOptions = {
    root: string;
    poolId?: string;
    config?: PoolConfig;
    agentId?: string | null;
    wsSend?: ((event: unknown) => unknown) | null;
    workspaceIdResolver?: ((root: string) => Promise<string | null> | string | null) | null;
};
export declare class HotPool {
    #private;
    constructor({ root, poolId, config, agentId, wsSend, workspaceIdResolver }: HotPoolOptions);
    get poolId(): string;
    get isAgentPool(): boolean;
    start(): Promise<void>;
    stop(): void;
    peek(): {
        ready: boolean;
    };
    acquire(): WarmSession | null;
    getCapturedSessionId(sessionId: string | null | undefined): string | null;
    clearCapturedSessionId(sessionId: string | null | undefined): void;
    consume(sessionId: string): void;
    release(sessionId: string): void;
    status(): {
        poolId: string;
        enabled: boolean;
        prereqsAvailable: boolean | null;
        isAgentPool: boolean;
        pressured: boolean;
        config: {
            pool_size: number;
            max_pool_size: number;
            load_balancer: boolean;
            load_balancer_cooldown_mins: number;
            verbose: boolean;
        };
        queue: Array<{
            id: string;
            state: WarmSession['state'];
            age: number;
        }>;
        acquired: number;
        ready: number;
        fillTarget: number;
    };
    reconfigure(config: PoolConfig): Promise<void>;
}
export declare class HotPoolManager {
    #private;
    constructor({ root, config, agentsConfig, promptAgentId, wsSend, workspaceIdResolver }: HotPoolManagerOptions);
    start(): Promise<void>;
    stop(): void;
    acquire(poolId: string): WarmSession | null;
    peek(poolId: string): {
        ready: boolean;
    };
    consume(poolId: string, sessionId: string): void;
    release(poolId: string, sessionId: string): void;
    getCapturedSessionId(poolId: string, sessionId: string): string | null;
    clearCapturedSessionId(poolId: string, sessionId: string): void;
    has(poolId: string): boolean;
    get poolIds(): string[];
    status(): {
        enabled: boolean;
        pools: {
            [k: string]: {
                poolId: string;
                enabled: boolean;
                prereqsAvailable: boolean | null;
                isAgentPool: boolean;
                pressured: boolean;
                config: {
                    pool_size: number;
                    max_pool_size: number;
                    load_balancer: boolean;
                    load_balancer_cooldown_mins: number;
                    verbose: boolean;
                };
                queue: Array<{
                    id: string;
                    state: WarmSession["state"];
                    age: number;
                }>;
                acquired: number;
                ready: number;
                fillTarget: number;
            };
        };
    };
    reconfigure(config: HotPoolSettings): Promise<void>;
}
export {};
