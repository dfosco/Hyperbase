/**
 * Storyboard Server Plugin — core dev-server infrastructure.
 *
 * Always-on Vite plugin that mounts a middleware backbone at `/_hypercanvas/`.
 * Reads `storyboard.config.json` for workshop features and plugin config.
 * Workshop API routes are wired directly; plugins register via the registry.
 *
 * Usage in vite.config.js:
 *   import storyboardServer from '@dfosco/hypercanvas/vite/server'
 *   storyboardServer()  // reads storyboard.config.json, no args needed
 */
import type { Plugin } from 'vite';
import { createNotebookRuntime } from '../notebook/runtime.js';
import type { ApiMiddleware } from './api-router.js';
import { createFilesystemGrants } from '../system/filesystem-grants.js';
type NotebookRuntime = ReturnType<typeof createNotebookRuntime>;
declare module 'vite' {
    interface ViteDevServer {
        __hypercanvasFilesystemGrants?: ReturnType<typeof createFilesystemGrants>;
        __hypercanvasNotebookRuntime?: ApiMiddleware;
        __hypercanvasNotebookSwitching?: boolean;
    }
}
/**
 * Send a JSON response.
 */
declare function sendJson(res: unknown, status: number, data: unknown): void;
/**
 * Core storyboard server Vite plugin.
 */
export declare function createServerGenerationLifecycle(httpServer: {
    once(event: 'close', callback: () => void): unknown;
} | null, processEvents?: Pick<NodeJS.Process, 'on' | 'removeListener'>): {
    onClose(callback: () => void): void;
    onProcess(event: "SIGINT" | "SIGTERM" | "exit", callback: () => void): void;
    readonly closed: boolean;
    signal: AbortSignal;
};
export declare function completeServerGenerationRegistration({ generation, registerUpstreams, proxyRequired, prepare, ready, register, registrationFailed, }: {
    generation: {
        readonly closed: boolean;
    };
    registerUpstreams: () => Promise<boolean>;
    proxyRequired: boolean;
    prepare: () => Promise<void>;
    ready: () => void;
    register: () => void;
    registrationFailed: () => void;
}): Promise<void>;
export default function storyboardServer({ notebookRuntime }?: {
    notebookRuntime?: NotebookRuntime | null;
}): Plugin;
export { sendJson };
