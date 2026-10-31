import { type AgentDefinition } from './catalog.js';
import { type HostEnvironment, type HostToolsEnvironment } from './environment.js';
import { type HostToolsPreflightResult } from './preflight.js';
export declare const HOST_RUNTIME_ERROR_CODES: Readonly<{
    AGENT_REQUIRED: "HOST_RUNTIME_AGENT_REQUIRED";
    AGENT_UNKNOWN: "HOST_RUNTIME_AGENT_UNKNOWN";
    AGENT_UNAVAILABLE: "HOST_RUNTIME_AGENT_UNAVAILABLE";
    HOST_CHECK_FAILED: "HOST_RUNTIME_HOST_CHECK_FAILED";
    COMMAND_INVALID: "HOST_RUNTIME_COMMAND_INVALID";
    ROOT_INVALID: "HOST_RUNTIME_ROOT_INVALID";
    UNSUPPORTED: "HOST_RUNTIME_UNSUPPORTED";
}>;
export type HostRuntimeErrorCode = typeof HOST_RUNTIME_ERROR_CODES[keyof typeof HOST_RUNTIME_ERROR_CODES];
export type CoreCliRuntime = Readonly<{
    executable: string;
    environment: HostToolsEnvironment;
}>;
export type TerminalHostRuntime = Readonly<{
    cwd: string;
    hostPath: string;
    path: string;
    wrapperDirectory: string;
    shell: string;
    environment: HostEnvironment;
}>;
export type AgentHostRuntime = TerminalHostRuntime & Readonly<{
    agentId: string;
    definition: AgentDefinition;
    executablePath: string;
}>;
export declare class HostRuntimeError extends Error {
    code: HostRuntimeErrorCode;
    details: Readonly<Record<string, unknown>>;
    constructor(code: HostRuntimeErrorCode, message: string, details?: Record<string, unknown>);
}
export declare function quoteShellWord(value: unknown): string;
/** Use the host Node process that launched Core for Core-owned CLI helpers. */
export declare function resolveCoreCliRuntime({ execPath, }?: {
    execPath?: string;
}): CoreCliRuntime;
export declare function formatCoreCliExecutable(runtime: CoreCliRuntime | null | undefined): string;
export declare function resolveTerminalHostRuntime(root: string): TerminalHostRuntime;
export declare function buildHostWorkloadEnv(runtime: Pick<TerminalHostRuntime, 'hostPath' | 'path' | 'shell'>, session?: Record<string, unknown>): HostToolsEnvironment;
export declare function rewriteAgentCommand(runtime: Pick<AgentHostRuntime, 'agentId' | 'definition' | 'executablePath'>, command: unknown): string;
export declare function rewriteAgentConfig(runtime: Pick<AgentHostRuntime, 'agentId' | 'definition' | 'executablePath'>, config: unknown): Record<string, unknown>;
export declare function reassertHostPath(runtime: Pick<TerminalHostRuntime, 'hostPath' | 'path'>, command: string): string;
export declare function resolveAgentHostRuntime(root: string, agentId: string, { preflight }?: {
    preflight?: () => Promise<HostToolsPreflightResult>;
}): Promise<AgentHostRuntime>;
