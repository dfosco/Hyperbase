export type AgentDefinition = Readonly<{
    kind?: 'agent' | 'tool';
    id: string;
    displayName: string;
    executable: string;
    knownPaths: readonly string[];
    versionArgs: readonly string[];
    parseVersion: (output: unknown) => string | null;
}>;
export declare function parseToolVersion(output: unknown): string | null;
export declare const AGENT_CATALOG: readonly AgentDefinition[];
export declare const AGENT_IDS: readonly string[];
export declare function getAgentDefinition(id: string): AgentDefinition | null;
