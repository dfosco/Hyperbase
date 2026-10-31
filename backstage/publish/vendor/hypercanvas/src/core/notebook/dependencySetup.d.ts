type InstallResult = {
    exitCode: number | null;
    output?: string;
};
type Attempt = {
    status: 'installing' | 'ready' | 'failed';
    promise: Promise<{
        status: 'ready';
    }>;
    error?: Error;
};
type InstallerOptions = {
    launch: (root: string, sessionId: string) => Promise<InstallResult>;
    onFailure?: (details: {
        root: string;
        error: Error;
        output: string;
    }) => void;
};
export declare function notebookDependencySessionId(root: string): string;
/** Start at most one first-open install for a canonical Notebook root. */
export declare function createNotebookDependencySetup({ launch, onFailure }: InstallerOptions): {
    ensure: (root: string) => Promise<{
        status: "ready" | "skipped";
    }>;
    wait: (root: string) => Promise<{
        status: "ready" | "skipped";
    }>;
    status: (root: string) => {
        status: "not-started" | Attempt["status"];
        error?: string;
    };
};
/** Run the install in a background shell owned by the Notebook's Paseo workspace. */
export declare function runNotebookInstallInPaseo(pty: {
    create(input: {
        sessionId: string;
        cwd: string;
        cols: number;
        rows: number;
    }): Promise<unknown>;
    subscribe(sessionId: string, options: Record<string, (event: unknown) => void>): Promise<{
        close: () => void;
    }>;
    writeBytes(sessionId: string, bytes: Uint8Array): Promise<unknown>;
    terminate(sessionId: string): Promise<unknown>;
}, root: string, sessionId: string): Promise<InstallResult>;
export {};
