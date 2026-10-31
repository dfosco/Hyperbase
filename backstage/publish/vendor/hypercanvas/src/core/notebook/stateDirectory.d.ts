/** Resolve durable Notebook-selection state without changing Core app state. */
export type NotebookStateDirectoryOptions = {
    profile?: string;
    home?: string;
    stateDirectory?: string;
};
export declare function resolveNotebookStateDirectory({ profile, home, stateDirectory }?: NotebookStateDirectoryOptions): string;
