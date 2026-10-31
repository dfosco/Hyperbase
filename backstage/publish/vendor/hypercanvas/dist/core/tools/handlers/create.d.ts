export declare const id = "create";
interface CreateContext {
    config?: {
        actions?: unknown;
    };
}
interface SetupResult {
    features: Array<{
        name: string;
        label: string | undefined;
        overlayId: string;
        overlay: unknown;
    }>;
}
export declare function setup(ctx?: CreateContext): Promise<SetupResult>;
export declare function guard(ctx?: CreateContext): Promise<boolean>;
export declare function component(): Promise<unknown>;
export {};
