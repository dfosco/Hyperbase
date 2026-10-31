type Placement = {
    sectionId?: string | null;
    sectionTitle?: string | null;
    insertAfterPageId?: string | null;
};
export declare function canvasPayloadRevision(file: string): string;
/** Synchronous payload + registry commit: watcher callbacks cannot discover partial creations. */
export declare function writeCanvasPage(root: string, file: string, content: string, { title, companion, placement, }: {
    title: string;
    companion?: {
        file: string;
        content: string;
    };
    placement?: Placement;
}): string | null;
/** Remove the payload before unregistering so discovery cannot add it back. Roll back on registry failure. */
export declare function deleteCanvasPage(root: string, file: string, expectedPayloadRevision?: string): string[];
/** Stage and remove one complete suffix-folder canvas without touching its parent or siblings. */
export declare function deleteCanvasArtifact(root: string, file: string, expectedPayloadRevision?: string): string[];
export {};
