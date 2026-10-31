import type { DesktopRuntimeSnapshot } from '../notebook/browserBridge.js';
export type DesktopRuntimeProjection = Readonly<{
    schemaVersion: 1;
    publisherId: string;
    ownerPid: number;
    publishedAt: string;
    snapshot: DesktopRuntimeSnapshot;
}>;
export type DesktopAppearanceMode = 'system' | 'light' | 'dark';
export interface DesktopRuntimeProjectionReadOptions {
    env?: NodeJS.ProcessEnv;
    isProcessAlive?: (pid: number) => boolean;
    now?: Date;
}
/** Read only the Go-owned last-complete snapshot for this exact child session. */
export declare function readDesktopRuntimeProjection({ env, isProcessAlive, now, }?: DesktopRuntimeProjectionReadOptions): DesktopRuntimeProjection | null;
/** Read the Go-owned explicit global app appearance; invalid/missing means system. */
export declare function readDesktopAppearanceMode(stateDirectory: string): DesktopAppearanceMode;
