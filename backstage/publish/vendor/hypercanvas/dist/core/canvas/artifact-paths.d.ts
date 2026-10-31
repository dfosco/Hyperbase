export type NotebookCanvasArtifactPaths = {
    parentPath: string;
    parentDirectory: string;
    folderName: string;
    folderDirectory: string;
    payloadName: string;
    payloadFile: string;
};
/** Resolve a selected Notebook parent without crossing a symlink or artifact boundary. */
export declare function resolveNotebookCanvasParent(root: string, parentPath?: string): {
    path: string;
    directory: string;
};
export declare function notebookCanvasArtifactPaths(root: string, name: string, parentPath?: string, visibilityPrefix?: string): NotebookCanvasArtifactPaths;
/** Return the artifact directory only for its canonical `<name>.canvas.jsonl` payload. */
export declare function canvasArtifactDirectoryForPayload(payloadFile: string): string | null;
