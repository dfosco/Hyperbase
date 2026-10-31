/** Compatibility handler for the former workspace/home action. */
export declare const id = "workspace";
interface WorkspaceContext {
    config?: {
        focusType?: string | null;
    };
}
export declare function handler({ config }?: WorkspaceContext): Promise<{
    execute(): void;
}>;
export {};
