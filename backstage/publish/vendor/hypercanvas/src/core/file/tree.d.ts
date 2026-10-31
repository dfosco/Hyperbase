/**
 * tree.js — repo file-tree walker for the File Widget server API.
 *
 * Pure module: no HTTP, no side effects, no global state.
 * Exports:
 *   GLOBAL_IGNORE_DIRS  — Set of directory/path segments always excluded
 *   buildFileTree(root, options)  — walk and return nested tree
 *   isPathAllowed(root, absPath, config)  — path validation + allowedRoots check
 */
export interface FileWidgetConfig {
    allowedRoots?: string[];
    defaultUploadDir?: string;
}
export interface FileTreeConfig {
    fileWidget?: FileWidgetConfig;
}
export interface FileTreeFile {
    name: string;
    path: string;
    kind: 'file';
}
export interface FileTreeDirectory {
    name: string;
    path: string;
    kind: 'dir';
    children: FileTreeNode[];
}
export type FileTreeNode = FileTreeFile | FileTreeDirectory;
export interface BuildFileTreeOptions {
    startDir?: string;
    config?: FileTreeConfig;
}
/**
 * Directories (by name) that are always excluded from the file tree,
 * regardless of allowedRoots config. This is the single source of truth
 * used by both tree.js and server.js.
 */
export declare const GLOBAL_IGNORE_DIRS: Set<string>;
/**
 * Determine whether absPath is allowed given:
 *  - global ignore list (always wins)
 *  - fileWidget.allowedRoots from storyboard.config.json (if set)
 *
 * @param {string} root  — absolute repo root
 * @param {string} absPath  — absolute path to check
 * @param {object} [config]  — parsed storyboard.config.json (optional)
 * @returns {boolean}
 */
export declare function isPathAllowed(root: string, absPath: string, config?: FileTreeConfig): boolean;
/**
 * Walk the repo from `startDir` (defaults to root) and build a nested tree.
 * Only text files (as determined by detectFlavor) are included.
 *
 * @param {string} root  — absolute repo root
 * @param {object} [options]
 * @param {string} [options.startDir]  — repo-relative dir to start from (default: root)
 * @param {object} [options.config]  — parsed storyboard.config.json
 * @returns {{ name: string, path: string, kind: 'dir'|'file', children?: Array }[]}
 */
export declare function buildFileTree(root: string, options?: BuildFileTreeOptions): FileTreeNode[];
