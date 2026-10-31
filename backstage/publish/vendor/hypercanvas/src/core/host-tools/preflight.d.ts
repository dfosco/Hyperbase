import { spawn as nodeSpawn } from 'node:child_process';
import { type HostToolsEnvironment, type HostToolsFileSystem, type HostEnvironment } from './environment.js';
export declare const MINIMUM_NODE_MAJOR = 22;
export declare const DEFAULT_PROBE_TIMEOUT_MS = 3000;
export declare const DEFAULT_PROBE_OUTPUT_BYTES: number;
type ProcessFailureReason = 'timeout' | 'output_limit' | 'spawn_failed' | 'nonzero_exit' | 'verification_failed';
export type ProcessRunResult = {
    ok: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut?: boolean;
    error?: unknown;
};
export type ProcessRunOptions = {
    env?: HostToolsEnvironment;
    shell?: false;
    timeoutMs?: number;
    maxOutputBytes?: number;
};
export type HostToolsProcessRunner = (file: string, args: readonly string[], options?: ProcessRunOptions) => Promise<ProcessRunResult> | ProcessRunResult;
type ProcessRunnerOptions = ProcessRunOptions & {
    spawn?: typeof nodeSpawn;
};
type ProbeStatus = 'missing' | 'unsupported' | 'valid' | 'installed' | 'outdated' | 'partial' | 'failed_verification';
export type HostToolProbe = {
    status: ProbeStatus;
    path: string | null;
    version: string | null;
    reason?: ProcessFailureReason | 'invalid_version';
    runtimeNodePath?: string | null;
};
export type HostToolsPreflightResult = Readonly<{
    status: 'supported' | 'unsupported';
    support: Readonly<{
        status: 'supported' | 'unsupported';
        platform: string;
        arch: string;
    }>;
    environment: HostEnvironment | null;
    tools: Readonly<{
        curl: HostToolProbe;
    }>;
    homebrew: HostToolProbe;
    baseline: Readonly<{
        status: 'unsupported' | 'valid' | 'missing' | 'partial' | 'outdated';
        minimumNodeMajor: number;
        node: HostToolProbe | null;
        npm: HostToolProbe | null;
    }>;
    agents: Readonly<Record<string, HostToolProbe>>;
}>;
export declare function runBoundedProcess(file: string, args: readonly string[], { env, timeoutMs, maxOutputBytes, spawn, }?: ProcessRunnerOptions): Promise<ProcessRunResult>;
export declare function preflightHostTools({ platform, arch, env, fs, runProcess, home, }?: {
    platform?: string;
    arch?: string;
    env?: HostToolsEnvironment;
    fs?: HostToolsFileSystem;
    runProcess?: HostToolsProcessRunner;
    home?: string;
}): Promise<HostToolsPreflightResult>;
export {};
