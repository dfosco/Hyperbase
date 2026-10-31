/**
 * Primary name for the machine-local Notebook runtime directory. The legacy
 * name is accepted for reading so existing Notebooks keep working after the
 * Storyboard → Hypercanvas rename; fresh state is created under the primary
 * name only. Startup moves `.storyboard/*` into `.hypercanvas/`, so the
 * primary directory wins whenever it exists and the legacy name is only used
 * by Notebooks that carried no state at the new location yet. Never mix the
 * two inside one Notebook: the resolver returns whichever directory already
 * exists (primary first when present) so writes and embedded agent paths stay
 * consistent with what is on disk.
 */
export declare const RUNTIME_DIR_NAME = ".hypercanvas";
export declare const LEGACY_RUNTIME_DIR_NAME = ".storyboard";
/**
 * Resolve the active runtime directory for a Notebook root: the primary
 * directory when it already exists (startup migration guarantees it once a
 * Notebook has carried state under either name), otherwise the legacy name,
 * then the primary name (created on first write by callers that mkdir).
 */
export declare function resolveRuntimeDir(root: string): string;
/**
 * Same selection as resolveRuntimeDir, but for the committed public snapshot
 * directory under `assets/`. Startup migration renames the legacy directory,
 * so the primary name wins when it exists and legacy projects keep writing
 * into their existing `.storyboard-public` directory.
 */
export declare const PUBLIC_SNAPSHOT_DIR_NAME = "assets/.hypercanvas-public";
export declare const LEGACY_PUBLIC_SNAPSHOT_DIR_NAME = "assets/.storyboard-public";
export declare function resolvePublicSnapshotDir(projectRoot: string): string;
/** Both runtime dir names, newest first — for ignore sets and glob lists. */
export declare function runtimeDirNames(): string[];
