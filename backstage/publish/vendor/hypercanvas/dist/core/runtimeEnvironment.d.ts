type PaseoConnection = {
    url?: string | null;
    password?: string | null;
    authHeader?: string | null;
};
type PaseoOwnership = {
    owned?: boolean;
    usePaseoApp?: boolean;
    reuseProbeFailure?: string | null;
};
/** Copy an environment for a non-Core child process without runtime secrets. */
export declare function withoutRuntimeCredentials(environment?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
/** Resolve daemon auth into the server-side Core process without mutating its parent. */
export declare function createPaseoServerEnvironment(environment?: NodeJS.ProcessEnv, connection?: PaseoConnection, ownership?: PaseoOwnership): NodeJS.ProcessEnv;
export {};
