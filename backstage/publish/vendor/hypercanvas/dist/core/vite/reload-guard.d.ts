import type { ViteDevServer } from 'vite';
export type DocumentRole = 'workspace-host' | 'canvas-host' | 'prototype-content' | 'story-content';
export interface DocumentPolicyRegistration {
    schemaVersion: 1;
    active: true;
    role: DocumentRole;
    targetId: string;
    configurationAutoReload: boolean;
}
type ReloadGuardServer = ViteDevServer;
/**
 * Own the per-client document policy for Vite's supported HMR transport.
 * Routine full reloads fail closed for every connected document. Module
 * updates continue to flow so React Fast Refresh remains available.
 */
export declare function installReloadGuard(server: ReloadGuardServer): void;
export {};
