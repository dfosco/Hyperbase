/**
 * Return the authored logical name for a suffix-artifact directory basename.
 * Leading underscores on the folder are visibility markers and are removed
 * only from this identity value. The physical directory name is unchanged.
 */
export declare function artifactFolderLogicalName(folderName: string): string | null;
/** Return the exact leading-underscore visibility prefix on an artifact folder. */
export declare function artifactFolderVisibilityPrefix(folderName: string): string;
