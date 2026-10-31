/**
 * App-owned Hypercanvas service boundary.
 *
 * The service owns the Hypercanvas HTTP/WS transport and accepts route
 * handlers from the application. Vite may host a compatibility instance, but
 * the service does not depend on Vite and can be started by another app host.
 */
interface PrototypeSupervisor {
    start: () => Promise<unknown>;
    close: () => Promise<unknown>;
}
interface WorkspaceServiceRegistry {
    register: (entry: {
        workspaceId: string;
        serviceName: string;
        url: string;
    }) => unknown;
    unregister: (workspaceId: string, serviceName: string) => unknown;
}
interface HypercanvasServiceOptions extends Record<string, unknown> {
    prototypeSupervisor?: PrototypeSupervisor | null;
    workspaceServiceRegistry?: WorkspaceServiceRegistry | null;
    workspaceId?: string | null;
    serviceName?: string;
    onPrototypeError?: (error: unknown) => void;
}
export declare function createHypercanvasService(options?: HypercanvasServiceOptions): {
    server: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
    routeHandlers: Map<string, (request: import("http").IncomingMessage, response: import("http").ServerResponse) => unknown>;
    broadcast: (payload: unknown) => void;
    wsSend: (payload: unknown) => void;
    listen: (port?: number, host?: string) => Promise<import("http").Server>;
    close: () => Promise<void>;
    socketPath: string;
};
export {};
