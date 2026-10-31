/** HTTP boundary for the durable Squad ledger and generic event bus. */
interface MessagingRequest {
    method?: string | undefined;
    url?: string | undefined;
    headers?: {
        accept?: string | undefined;
        'content-type'?: string | undefined;
        'last-event-id'?: string | undefined;
    };
}
interface MessagingResponse {
    destroyed?: boolean;
    writeHead(status: number, headers?: Record<string, string>): void;
    end(body?: string): void;
    write?(body: string): void;
    flushHeaders?(): void;
    on?(event: string, listener: () => void): void;
}
interface RequestContext {
    method: string;
    path?: string;
    body?: unknown;
}
type MessagingRouteHandler = {
    bivarianceHack(req: MessagingRequest, res: MessagingResponse, ctx: RequestContext): Promise<unknown>;
}['bivarianceHack'];
interface SquadContext {
    root: string;
    workspaceId: string;
    daemonId: string;
}
interface DeliveryOptions {
    sessionFor?: (widgetId: string) => Promise<string | null | undefined>;
    isReady?: (sessionId: string) => boolean;
    submitTerminalText?: (sessionId: string, text: string, options: {
        submit: boolean;
        paste: boolean;
    }) => Promise<unknown>;
    sendAgentMessage?: (agentId: string, text: string) => Promise<unknown>;
}
type SendJson = (res: MessagingResponse, status: number, value: unknown) => unknown;
type GetSquadContext = (() => Promise<SquadContext>) | null;
type GetSquadDeliveryOptions = ((input: {
    root: string;
    squadId: string;
    widgetId: string;
}) => Promise<DeliveryOptions | null | undefined>) | null;
export declare function createMessagingRoutes({ sendJson, getSquadContext, getSquadDeliveryOptions, }: {
    sendJson: SendJson;
    getSquadContext?: GetSquadContext;
    getSquadDeliveryOptions?: GetSquadDeliveryOptions;
}): MessagingRouteHandler;
export declare function closeAllSseConnections(): void;
export {};
