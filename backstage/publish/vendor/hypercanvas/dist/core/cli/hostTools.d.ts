type HostToolsRequest = {
    get(path: string): Promise<Record<string, unknown>>;
};
export declare function hostToolsHelp(): string;
export declare function runHostToolsCommand(args: string[], request?: HostToolsRequest): Promise<Record<string, unknown> | {
    help: string;
}>;
export declare function main(args?: string[]): Promise<void>;
export {};
