type ScaffoldProfile = 'development' | 'production';
export declare function runStartupScaffolds({ profile, home, source }?: {
    profile?: ScaffoldProfile;
    home?: string;
    source?: string;
}): Record<string, string>;
export declare function defaultDemoNotebookPath(profile?: ScaffoldProfile, home?: string): string;
/** Prefer an explicitly configured Notebook, then the last available selection. */
export declare function resolveStartupNotebook({ profile, home, activeNotebook, stateDirectory, fallback, }?: {
    profile?: ScaffoldProfile;
    home?: string;
    activeNotebook?: string;
    stateDirectory?: string;
    fallback?: string;
}): string;
/**
 * Provision startup scaffolds and choose the Notebook Core opens. A failed
 * scaffold or a missing Notebook folder must never stop Core: the Notebook
 * root is cleared and a notice is returned so the in-app selection screen takes
 * over. Returns null when a Notebook is ready.
 */
export declare function prepareStartupNotebook({ profile, env, scaffold, }?: {
    profile?: ScaffoldProfile;
    env?: NodeJS.ProcessEnv;
    scaffold?: typeof runStartupScaffolds;
}): string | null;
export {};
