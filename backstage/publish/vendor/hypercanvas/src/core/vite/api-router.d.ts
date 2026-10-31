import type { IncomingMessage, ServerResponse } from 'node:http';
interface RequestDiagnosticMetadata {
    requestId: number;
    method: string;
    pathname: string;
    startedAtNs: bigint;
    boundary?: 'vite' | 'embedded';
}
/** Restore an ID passed only across the opt-in local embedded-service proxy. */
export declare function attachEmbeddedApiRequestDiagnostics(request: IncomingMessage, response: ServerResponse): void;
export type ApiRequest = IncomingMessage & {
    originalLegacyUrl?: boolean;
    __hypercanvasE2ERequestDiagnostic?: RequestDiagnosticMetadata;
};
export type ApiResponse = ServerResponse & {
    __sbLogCtx?: {
        method?: string;
        url?: string;
        route?: string;
        subRoute?: string;
    };
};
export interface ApiRouteContext {
    body: Record<string, unknown>;
    path: string;
    method: string;
    __viteWs?: unknown;
}
export type ApiRouteHandler = {
    bivarianceHack(request: ApiRequest, response: ApiResponse, context: ApiRouteContext): unknown | Promise<unknown>;
}['bivarianceHack'];
export type ApiNext = (error?: Error) => void;
export type ApiMiddleware = (request: ApiRequest, response: ApiResponse, next: ApiNext) => unknown;
export type JsonSender = (response: unknown, status: number, body: unknown) => void;
export interface RouteSetupOptions {
    base?: string;
    routeHandlers?: Map<string, ApiRouteHandler>;
    sendJson?: JsonSender;
    ws?: unknown;
    maxBodyBytes?: number;
    proxyUrl?: string | (() => string);
    proxyAll?: boolean | (() => boolean);
}
export declare const API_PREFIX = "/_hypercanvas/";
/** Legacy mount point kept working across the Storyboard → Hypercanvas rename. */
export declare const LEGACY_API_PREFIX = "/_hypercanvas/";
/** Normalize a legacy `/_hypercanvas/...` URL onto the primary prefix. */
export declare function normalizeLegacyApiUrl(url: string | undefined): string | undefined;
export declare const DEFAULT_MAX_JSON_BODY_BYTES: number;
export declare function parseJsonBody(req: ApiRequest, { maxBytes }?: {
    maxBytes?: number;
}): Promise<unknown>;
/**
 * Assemble the API route surface once for either Vite or the standalone
 * Hypercanvas server. Keeping this small object as the shared boundary avoids
 * making route handlers know which HTTP server owns them.
 */
export declare function createRouteSetup(options?: RouteSetupOptions): {
    routeHandlers: Map<string, (request: ApiRequest, response: ApiResponse, context: ApiRouteContext) => unknown | Promise<unknown>>;
    middleware: ApiMiddleware;
};
export declare function createApiMiddleware({ base, routeHandlers, sendJson, ws, maxBodyBytes, proxyUrl, proxyAll, }?: RouteSetupOptions): ApiMiddleware;
/**
 * The outer gate in front of the API router. Applies the desktop origin
 * guard to every API request (primary `/_hypercanvas/` and legacy
 * `/_hypercanvas/` URLs) and delegates the notebook-runtime prefix to the
 * notebook runtime plugin's own middleware — the router's fallback proxy (a
 * standalone server that is not part of this architecture) must never
 * consume those routes.
 */
export interface ApiGateOptions {
    base?: string;
    apiMiddleware: ApiMiddleware;
    sendJson: JsonSender;
    isAllowedOrigin?: (headers: IncomingMessage['headers'], options: {
        desktop: true;
    }) => boolean;
    isAuthorized?: (request: ApiRequest) => boolean;
    desktop?: boolean;
    getNotebookRuntimeMiddleware?: () => ApiMiddleware | undefined;
}
export declare function createApiGate({ base, apiMiddleware, sendJson, isAllowedOrigin, isAuthorized, desktop, getNotebookRuntimeMiddleware }: ApiGateOptions): ApiMiddleware;
export {};
