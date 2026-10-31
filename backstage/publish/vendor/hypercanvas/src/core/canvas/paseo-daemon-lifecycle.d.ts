import { type ChildProcess, type SpawnOptions } from 'node:child_process';
export declare const BUNDLED_PASEO_VERSION = "0.8.0-beta.1";
type ProbeOptions = {
    timeoutMs?: number;
};
type Connect = (url: string, password?: string, authHeader?: string, options?: ProbeOptions) => Promise<string>;
type Launch = (command: string, args: string[], options: SpawnOptions) => ChildProcess;
type PaseoEnvironment = NodeJS.ProcessEnv & {
    [key: string]: string | undefined;
};
type PaseoHandle = {
    owned: boolean;
    usePaseoApp: boolean;
    url: string;
    serverId: string;
    reuseProbeFailure?: string | null;
    connectionOptions: {
        url: string;
        password?: string;
        authHeader?: string;
    };
    child: ChildProcess | null;
    stop: () => Promise<void>;
};
type StartDesktopPaseoOptions = {
    stateDir?: string;
    env?: PaseoEnvironment;
    usePaseoApp?: boolean;
    connect?: Connect;
    launch?: Launch;
    defaultUrl?: string;
    selectPort?: (host: string) => Promise<number>;
    resolveSupervisorEntry?: () => string;
    timeoutMs?: number;
};
/** Select once per Core launch. Never migrate to a different daemon mid-run. */
export declare function startDesktopPaseo({ stateDir, env, usePaseoApp, connect, launch, defaultUrl, selectPort, resolveSupervisorEntry, timeoutMs, }?: StartDesktopPaseoOptions): Promise<PaseoHandle>;
export {};
