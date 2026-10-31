type CliRequest = {
    get(path: string): Promise<unknown>;
    post(path: string, body: Record<string, unknown>): Promise<unknown>;
};
export declare function systemHelp(): string;
export declare function runSystemCommand(args: string[], request?: CliRequest): Promise<{
    help: string;
} | unknown>;
export declare function main(args?: string[]): Promise<void>;
export {};
