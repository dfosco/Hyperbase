/**
 * Standalone Hypercanvas HTTP server.
 *
 * Route handlers are injected so the transport can be hosted by the
 * application independently of Vite. The WebSocket channel carries the
 * existing Vite-shaped custom event payloads for client compatibility.
 */
import http from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
interface SocketClient {
    readyState: number;
    send(data: string): void;
    close(): void;
    once(event: 'close' | 'error', listener: () => void): this;
}
interface SocketServer {
    on(event: 'connection', listener: (socket: SocketClient) => void): this;
    emit(event: 'connection', socket: SocketClient, request: IncomingMessage): boolean;
    handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer, callback: (client: SocketClient) => void): void;
    close(): void;
}
type RouteHandlers = Map<string, (request: IncomingMessage, response: ServerResponse) => unknown>;
type JsonSender = (response: ServerResponse, status: number, body: unknown) => void;
declare const SOCKET_PATH = "/_hypercanvas/ws";
interface HypercanvasServerOptions {
    base?: string;
    routeHandlers?: RouteHandlers;
    sendJson?: JsonSender;
    maxBodyBytes?: number;
    server?: Server;
    webSocketServer?: SocketServer;
    eventSender?: (payload: unknown) => void;
    authorizeRequest?: (request: IncomingMessage) => boolean;
    authorizeWebSocket?: (request: IncomingMessage) => boolean;
}
export declare function createHypercanvasServer({ base, routeHandlers, sendJson: responseSender, maxBodyBytes, server: suppliedServer, webSocketServer, eventSender, authorizeRequest, authorizeWebSocket, }?: HypercanvasServerOptions): {
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    routeHandlers: RouteHandlers;
    broadcast: (payload: unknown) => void;
    wsSend: (payload: unknown) => void;
    listen: (port?: number, host?: string) => Promise<Server>;
    close: () => Promise<void>;
    socketPath: string;
};
export { SOCKET_PATH };
