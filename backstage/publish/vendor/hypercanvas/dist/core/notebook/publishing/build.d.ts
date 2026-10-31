/**
 * Local portable-project builds.
 *
 * Publishing builds `dist/` locally as a validation step before pushing the
 * publication source; GitHub Actions installs and builds the publication
 * itself before deploying (see DOCS/publishing.md). The build installs the
 * project's exact dependencies from its embedded lockfile (`npm ci`), so the
 * same commands verify portability. This work is asynchronous so the server
 * can continue to stream operation progress and status while npm runs.
 */
type CommandResult = {
    stdout?: string;
    stderr?: string;
};
type CommandRunner = (args: string[], cwd: string, options?: {
    env?: NodeJS.ProcessEnv;
}) => Promise<CommandResult>;
declare function resolveNpm(): Promise<{
    command: string;
    prefix: string[];
} | null>;
declare function runNpm(args: string[], cwd: string, { env }?: {
    env?: NodeJS.ProcessEnv;
}): Promise<CommandResult>;
/**
 * Install the project's exact dependencies and build its `dist/`.
 * `vite build` empties only `dist/` — `.git`, the workflow, and unrelated
 * files are untouched.
 */
export declare function buildProject({ projectDir, basePath, commandRunner }: {
    projectDir: string;
    basePath?: string;
    commandRunner?: CommandRunner;
}): Promise<{
    projectDir: string;
    dist: string;
}>;
export declare const __test: {
    runNpm: typeof runNpm;
    resolveNpm: typeof resolveNpm;
};
export {};
