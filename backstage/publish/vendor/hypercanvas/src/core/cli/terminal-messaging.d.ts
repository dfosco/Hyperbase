/**
 * Terminal Messaging CLI — send messages between terminals and save output.
 *
 * Commands:
 *   storyboard terminal output --summary "..." --content "..."  Save latest output
 *   storyboard terminal status <widgetId>               Check terminal status
 *   storyboard terminal read <widgetId>                 Read terminal buffer
 *   storyboard terminal input --widget <id> (--text "..." | --key <key>...) [--enter]
 *                                                     Submit text to a terminal PTY
 */
interface TerminalInputRequest {
    widgetId?: string;
    sessionId?: string | null;
    text?: string;
    keys?: Array<string | true>;
    submit: boolean;
    paste?: true;
    canvasId?: string;
    branch?: string;
}
interface TerminalInputResult extends Record<string, unknown> {
    success?: boolean;
    error?: string;
    code?: string;
    written?: number;
    submitted?: boolean;
}
export declare function requestTerminalInput(request: TerminalInputRequest): Promise<TerminalInputResult>;
export declare function handleInput(): Promise<void>;
export declare function requestAgentActivation(agentId?: string | null): Promise<Record<string, unknown>>;
export declare function handleActivateAgent(): Promise<void>;
export declare function handleOutput(): Promise<void>;
export declare function handleStatus(): Promise<void>;
export declare function handleRead(): Promise<void>;
export declare function handleKill(): Promise<void>;
export {};
