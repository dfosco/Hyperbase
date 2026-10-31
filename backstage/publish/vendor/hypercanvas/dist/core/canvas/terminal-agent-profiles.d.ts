/** Replace a shared executable without a missing or partially written window. */
export declare function writeTerminalShim(file: string, content: string): void;
/** Native tool names differ; omission gives each provider its default tools. */
export declare function renderNativeTerminalProfile(source: string, name?: string): string;
export declare function ensureTerminalAgentGuidance(root: string): string;
export declare function ensureTerminalAgentProfiles(root: string): void;
/** Keep headless agents on the same bundled CLI as visible terminal agents. */
export declare function ensureTerminalAgentCli(root: string): string;
