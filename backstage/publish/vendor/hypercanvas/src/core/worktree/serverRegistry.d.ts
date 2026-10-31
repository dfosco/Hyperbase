import { z } from 'zod';
declare const ServerEntrySchema: z.ZodObject<{
    id: z.ZodString;
    worktree: z.ZodString;
    pid: z.ZodNumber;
    port: z.ZodNumber;
    background: z.ZodOptional<z.ZodBoolean>;
    startedAt: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodString;
    worktree: z.ZodString;
    pid: z.ZodNumber;
    port: z.ZodNumber;
    background: z.ZodOptional<z.ZodBoolean>;
    startedAt: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodString;
    worktree: z.ZodString;
    pid: z.ZodNumber;
    port: z.ZodNumber;
    background: z.ZodOptional<z.ZodBoolean>;
    startedAt: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export type ServerEntry = z.infer<typeof ServerEntrySchema>;
type ServerMap = Record<string, ServerEntry>;
/**
 * Absolute path to the runtime servers.json (hypercanvas, legacy storyboard dir).
 */
export declare function registryPath(cwd: string): string;
/**
 * Generate a short unique hex ID (6 chars).
 */
export declare function generateId(): string;
/**
 * Remove entries whose PIDs are dead.
 * @returns {object} pruned servers map
 */
export declare function prune(cwd: string): ServerMap;
/**
 * Register a new server entry.
 */
export declare function register({ id, worktree, pid, port, background }: {
    id: string;
    worktree: string;
    pid: number;
    port: number;
    background?: boolean;
}, cwd: string): ServerEntry;
/**
 * Unregister a server by ID.
 */
export declare function unregister(id: string, cwd: string): void;
/**
 * List all live servers (prunes dead ones first).
 */
export declare function list(cwd: string): ServerEntry[];
/**
 * Find servers running for a given worktree name.
 */
export declare function findByWorktree(name: string, cwd: string): ServerEntry[];
/**
 * Find a server by its unique ID.
 */
export declare function findById(id: string, cwd: string): ServerEntry | null;
export {};
