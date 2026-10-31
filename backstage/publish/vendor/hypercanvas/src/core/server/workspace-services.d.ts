export interface WorkspaceServiceEntry {
    workspaceId: string;
    serviceName: string;
    url: string;
    metadata: Record<string, unknown>;
    updatedAt: string;
}
interface RegisterWorkspaceServiceOptions {
    workspaceId?: unknown;
    serviceName?: unknown;
    url?: unknown;
    metadata?: object | null;
}
export interface WorkspaceServiceRegistry {
    register: (options?: RegisterWorkspaceServiceOptions) => WorkspaceServiceEntry;
    resolve: (workspaceId: unknown, serviceName: unknown) => WorkspaceServiceEntry | null;
    unregister: (workspaceId: unknown, serviceName: unknown) => boolean;
    list: (workspaceId?: unknown) => WorkspaceServiceEntry[];
}
interface WorkspaceRouteContext {
    body?: RegisterWorkspaceServiceOptions;
    path?: string;
    method?: string;
}
type JsonSender = (response: unknown, status: number, body: unknown) => unknown;
export declare function createWorkspaceServiceRegistry(): WorkspaceServiceRegistry;
export declare function createWorkspaceServiceRoutes({ registry, sendJson }: {
    registry: WorkspaceServiceRegistry;
    sendJson: JsonSender;
}): (_req: unknown, res: unknown, { body, path: routePath, method }: WorkspaceRouteContext) => Promise<unknown>;
export {};
