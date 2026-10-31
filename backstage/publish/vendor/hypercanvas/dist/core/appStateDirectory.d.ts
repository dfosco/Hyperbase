/** Resolve the per-user Hypercanvas state root without requiring a host wrapper. */
export interface AppStateDirectoryOptions {
    environment?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    home?: string;
}
export declare function resolveHypercanvasAppStateDirectory({ environment, platform, home, }?: AppStateDirectoryOptions): string;
