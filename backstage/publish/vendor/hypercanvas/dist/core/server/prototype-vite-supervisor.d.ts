import type { ChildProcess } from 'node:child_process';
interface SupervisorOptions {
    command?: string;
    args?: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    url?: string;
    probe?: (url: string | undefined) => unknown | Promise<unknown>;
    spawnProcess?: (command: string, args: string[], options: {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        stdio: 'pipe';
    }) => ChildProcess;
    timers?: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'>;
    readinessIntervalMs?: number;
    maxRestarts?: number;
    restartBackoffMs?: number[];
    onReady?: (url: string | undefined) => void;
    onRestart?: (event: {
        attempt: number;
        delay: number;
    }) => void;
    onError?: (error: unknown) => void;
}
/**
 * Owns one prototype Vite child without making the parent service depend on it.
 * The probe should return a truthy value once the child is serving its URL.
 */
export declare function createPrototypeViteSupervisor({ command, args, cwd, env, url, probe, spawnProcess, timers, readinessIntervalMs, maxRestarts, restartBackoffMs, onReady, onRestart, onError, }?: SupervisorOptions): {
    start: () => Promise</*elided*/ any>;
    close: () => Promise<void>;
    readonly child: ChildProcess | null;
    readonly ready: boolean;
    readonly restartCount: number;
    readonly closed: boolean;
};
export {};
