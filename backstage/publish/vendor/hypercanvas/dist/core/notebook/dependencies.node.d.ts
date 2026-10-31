import type { Alias, ViteDevServer } from 'vite';
/** Parse authored imports, never execute Notebook modules or traverse package trees. */
export declare function discoverNotebookDependencies({ notebookRoot, applicationRoot, aliases }: {
    notebookRoot?: string | null;
    applicationRoot: string;
    aliases?: Alias[];
}): Promise<{
    include: string[];
    aliases: Alias[];
    missing: string[];
}>;
/** Included imports must finish prebundling before desktop document readiness. */
export declare function prepareNotebookDependencies(server: ViteDevServer, onProgress?: (milestone: 'dependencies-scanned' | 'dependencies-ready') => void): Promise<void>;
