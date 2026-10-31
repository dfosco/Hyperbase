import { SiteRuntime } from './runtime.js';
import { createFilesystemGrants } from '../system/filesystem-grants.js';
import { createSitePreviewMiddleware } from './proxy.js';
import type { IncomingMessage } from 'node:http';
type SiteRuntimeOptions = NonNullable<ConstructorParameters<typeof SiteRuntime>[1]>;
interface SiteRouteBody extends Record<string, unknown> {
    id?: string;
    siteId?: string;
    title?: string;
    root?: string;
    previousBaseUrl?: string | null;
    description?: string;
    productionBaseUrl?: string | null;
    deployUrl?: string | null;
    developmentBaseUrl?: string | null;
    localUrl?: string | null;
    startCommand?: string | null;
    route?: string;
    width?: number;
    height?: number;
    theme?: string;
    force?: boolean;
    notebookPath?: string;
    sectionId?: string | null;
    insertAfterPageId?: string | null;
    parentPath?: string;
    workspaceId?: string | null;
    confirmed?: unknown;
    timeoutMs?: unknown;
    binding?: Record<string, unknown> | null;
}
interface SiteRouteContext {
    method?: string;
    subpath?: string;
    path?: string;
    body?: SiteRouteBody | null;
}
interface SitePreviewMiddlewareOptions {
    base?: string;
    authorizeRequest?: (request: IncomingMessage) => boolean;
}
interface CreateSiteRoutesOptions {
    root: string;
    sendJson: (response: unknown, status: number, body: unknown) => unknown;
    ptyRuntime?: SiteRuntimeOptions['ptyRuntime'];
    workspaceScripts?: SiteRuntimeOptions['workspaceScripts'];
    serviceResolver?: SiteRuntimeOptions['serviceResolver'];
    resolveNotebookWorkspaceId?: (() => Promise<string | null>) | null;
    filesystemGrants?: ReturnType<typeof createFilesystemGrants>;
    eventSender?: ((event: unknown) => void) | null;
}
interface SiteRouteHandler {
    (request: IncomingMessage, response: unknown, context: SiteRouteContext): Promise<unknown>;
    close: () => Promise<unknown>;
    previewMiddleware: (options?: SitePreviewMiddlewareOptions) => ReturnType<typeof createSitePreviewMiddleware>;
    deleteSite: (id: string, options?: {
        confirmed?: unknown;
    }) => Promise<unknown>;
    diagnostics: () => unknown[];
}
export declare function createSiteRoutes({ root, sendJson, ptyRuntime, workspaceScripts, serviceResolver, resolveNotebookWorkspaceId, filesystemGrants, eventSender }: CreateSiteRoutesOptions): SiteRouteHandler;
export {};
