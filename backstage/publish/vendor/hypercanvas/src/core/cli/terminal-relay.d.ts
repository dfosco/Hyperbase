/** Attach the local TTY to an existing Storyboard terminal WebSocket. */
interface RelaySession {
    widgetId: string;
    canvasId?: string;
    name?: string;
}
export declare function openTerminalRelay({ serverUrl, session }: {
    serverUrl: string;
    session: RelaySession;
}): Promise<void>;
export {};
