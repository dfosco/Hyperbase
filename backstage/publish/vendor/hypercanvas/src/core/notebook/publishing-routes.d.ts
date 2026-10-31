interface PublishingRouteOptions {
    root: string;
    applicationRoot?: string;
    getNotebookRoot?: () => string;
    sendJson(response: unknown, status: number, body: unknown): unknown;
}
interface PublishingRequestContext {
    body?: unknown;
    path?: string;
    method?: string;
}
/** HTTP API for the UI, CLI, agents, and user scripts. */
export declare function createPublishingHandler({ root, applicationRoot, getNotebookRoot, sendJson }: PublishingRouteOptions): (_req: unknown, res: unknown, { body: untrustedBody, path, method }: PublishingRequestContext) => Promise<unknown>;
export {};
