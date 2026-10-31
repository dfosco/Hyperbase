/**
 * Git helpers for hypercanvas dev CLI.
 * Extracted for testability — no side effects on import.
 */
export type MascotPaths = {
    configPath: string;
    framesDir: string;
};
/** Resolve project mascot settings without relocating its asset directory. */
export declare function resolveDevMascotPaths(targetCwd: string, packageRoot: string): MascotPaths;
/**
 * Check if the working tree has uncommitted changes (staged or unstaged).
 */
export declare function hasUncommittedChanges(cwd: string): boolean;
/**
 * Check if a local branch exists.
 */
export declare function localBranchExists(name: string, cwd: string): boolean;
/**
 * Resolve the default branch for the repo root (main, master, or origin/HEAD target).
 * Returns null if none can be determined.
 */
export declare function resolveDefaultBranch(cwd: string): string | null;
