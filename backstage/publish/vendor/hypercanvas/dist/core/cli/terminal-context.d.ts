interface TerminalContextRequest {
    widgetId?: string;
    action?: string;
    revision?: string;
    launchId?: string;
    interactive?: boolean;
}
interface TerminalContextResponse extends Record<string, unknown> {
    success?: boolean;
    error?: string;
}
export declare function requestTerminalContext(request: TerminalContextRequest): Promise<TerminalContextResponse>;
export declare function handleTerminalContext(): Promise<void>;
export {};
