import { repairNestedNotebookArtifact } from './artifact-repair.js';
type NotebookRuntime = {
    status?: () => unknown;
    refreshNotebook?: () => unknown;
};
type SendJson = (response: unknown, status: number, body: unknown) => unknown;
type NavigationEvent = Record<string, unknown>;
type RouteInput = {
    body?: unknown;
    path?: string;
    method: string;
};
declare function manifestRevision(file: string): string;
declare function withNotebookLock<T>(key: string, callback: () => T | Promise<T>): Promise<T>;
declare function atomicWriteManifest(root: string, manifest: Record<string, unknown>): void;
/** Notebook-scoped page catalog and revision-guarded layout routes. */
export declare function createNotebookNavigationRoutes({ runtime, sendJson, eventSender, repairArtifact }: {
    runtime: NotebookRuntime | null;
    sendJson: SendJson;
    eventSender?: (event: NavigationEvent) => void;
    repairArtifact?: typeof repairNestedNotebookArtifact;
}): (_req: unknown, res: unknown, request: RouteInput) => Promise<unknown>;
export declare const __test: {
    atomicWriteManifest: typeof atomicWriteManifest;
    manifestRevision: typeof manifestRevision;
    withNotebookLock: typeof withNotebookLock;
};
export {};
