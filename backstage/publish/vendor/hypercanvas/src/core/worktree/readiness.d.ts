import { spawnSync, type ChildProcessWithoutNullStreams, type SpawnOptions } from 'node:child_process';
type DevServerChild = ChildProcessWithoutNullStreams;
type DevServerStart = (command: string, args: string[], options: SpawnOptions) => DevServerChild;
export declare function verifyProductionBuild(cwd: string, { run }?: {
    run?: typeof spawnSync;
}): void;
export declare function verifyDevServer(cwd: string, { start, timeoutMs }?: {
    start?: DevServerStart;
    timeoutMs?: number;
}): Promise<void>;
export declare function verifyWorkflowReadiness(cwd: string, { build, devServer, }?: {
    build?: (cwd: string) => void;
    devServer?: (cwd: string) => Promise<void>;
}): Promise<void>;
export {};
