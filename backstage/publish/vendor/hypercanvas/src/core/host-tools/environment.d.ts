export declare const KNOWN_MACOS_HOST_DIRECTORIES: readonly string[];
export type HostToolsEnvironment = Record<string, string | undefined>;
export type HostPathRejectionReason = 'not_absolute' | 'bundle' | 'node_modules_bin' | 'not_directory' | 'unresolvable';
export type HostPathRejection = Readonly<{
    path: string;
    reason: HostPathRejectionReason;
}>;
export type HostEnvironment = Readonly<{
    source: 'PATH' | 'HYPERCANVAS_HOST_PATH';
    path: string;
    entries: readonly string[];
    bundleRoots: readonly string[];
    rejected: readonly HostPathRejection[];
}>;
export interface HostToolsFileSystem {
    realpathSync(path: string): string;
    statSync(path: string): {
        isDirectory(): boolean;
        isFile(): boolean;
    };
    accessSync(path: string, mode: number): void;
}
export declare function discoverHostEnvironment({ env, fs, home, }?: {
    env?: HostToolsEnvironment;
    fs?: HostToolsFileSystem;
    home?: string;
}): HostEnvironment;
export declare function resolveHostExecutable(name: string, { environment, knownPaths, fs, home, }?: {
    environment?: HostEnvironment | null;
    knownPaths?: readonly string[];
    fs?: HostToolsFileSystem;
    home?: string;
}): string | null;
export declare function executableDirectory(path: string): string;
