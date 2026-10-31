/**
 * Worktree Port Registry
 *
 * Manages a JSON registry (worktrees/ports.json) that maps worktree names
 * to unique dev-server ports. Main always gets 1234; worktrees get 1235+.
 *
 * This module is published as part of @dfosco/hypercanvas so client
 * repos can use port detection without duplicating the logic.
 *
 * Programmatic API:
 *   import { getPort, detectWorktreeName, resolvePort } from '@dfosco/hypercanvas/worktree/port'
 */
/**
 * Resolve the path to worktrees/ports.json.
 *
 * Derives the repo root from directory structure so it works whether
 * running from the repo root or from inside worktrees/<name>/ or
 * .worktrees/<name>/ (legacy convention) — even when ports.json
 * does not exist yet.
 *
 * @param {string} [cwd] — override working directory
 * @returns {string} absolute path to ports.json
 */
export declare function portsFilePath(cwd?: string): string;
/**
 * Detect the worktree name from the current git context.
 *
 * Returns:
 *   - The worktree name when cwd is inside `worktrees/<name>/` or
 *     `.worktrees/<name>/`.
 *   - The current branch name when on a non-main/master branch.
 *   - `'main'` otherwise.
 */
export declare function detectWorktreeName(): string;
/**
 * Get or assign a port for the given worktree name.
 *
 * DEPRECATED for new assignments under the single-instance model (ADR-007):
 * one global instance owns the selected proxy port, so per-worktree dev servers
 * no longer start. Main keeps its 1234 assignment as a legacy read; other
 * worktrees reuse an existing assignment when present and otherwise fall
 * back to the base port (Vite rolls forward automatically when occupied).
 * The file backend is retained because client repos import this module.
 *
 * @param {string} worktreeName
 * @returns {number}
 */
export declare function getPort(worktreeName: string): number;
/**
 * Release a port assignment for a worktree.
 *
 * Removes the entry from ports.json so the port can be reused.
 * Never removes 'main'.
 *
 * @param {string} worktreeName
 */
export declare function releasePort(worktreeName: string): void;
/**
 * Resolve the port for a running dev server.
 *
 * Checks the server registry (servers.json) first for a live process,
 * then falls back to ports.json assignment. Use this when connecting
 * to an already-running server — it returns the real bound port even
 * when Vite rebinds to a different port than originally assigned.
 *
 * @param {string} worktreeName
 * @returns {number}
 */
export declare function resolveRunningPort(worktreeName: string): number;
/**
 * Resolve the port for a worktree from worktrees/ports.json
 * without assigning a new one if missing.
 *
 * @param {string} worktreeName
 * @returns {number}
 */
export declare function resolvePort(worktreeName: string): number;
/**
 * Slugify a branch name for filesystem and subdomain safety.
 *
 * - lowercase
 * - dots, spaces, underscores, non-alphanumeric (except - and /) → hyphens
 * - collapse consecutive hyphens
 * - trim leading/trailing hyphens per segment
 */
export declare function slugify(name: string): string;
/**
 * Resolve the repo root — the directory that contains `worktrees/`.
 *
 * Works whether cwd is the repo root itself or inside `worktrees/<name>/`
 * or `.worktrees/<name>/` (legacy convention).
 *
 * @param {string} [cwd]
 * @returns {string} absolute path to repo root
 */
export declare function repoRoot(cwd?: string): string;
/**
 * Resolve the full path to a worktree directory.
 *
 * Returns repo root for 'main'. For branches, checks both `worktrees/<name>`
 * and `.worktrees/<name>` (legacy), preferring whichever exists on disk.
 * Falls back to `worktrees/<name>` (current convention) if neither exists.
 *
 * @param {string} name — worktree name
 * @param {string} [cwd]
 * @returns {string} absolute path
 */
export declare function worktreeDir(name: string, cwd?: string): string;
/**
 * List existing worktree directory names from `worktrees/` and `.worktrees/`.
 *
 * Only returns directories that look like real worktrees (contain a `.git` file).
 * Does not include 'main'. Deduplicates names found in both locations.
 *
 * @param {string} [cwd]
 * @returns {string[]}
 */
export declare function listWorktrees(cwd?: string): string[];
