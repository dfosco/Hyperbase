export type NotebookArtifactMigrationAliases = {
    legacyRoutes?: Array<{
        from: string;
        targetPath: string;
    }>;
    legacyCanvasIds?: string[];
    legacyScopes?: {
        prototype: string;
        folder?: string;
    };
};
export type NotebookArtifactRouteAlias = {
    artifactId: string;
    from: string;
    targetPath: string;
    route: string;
};
export declare function normalizeNotebookArtifactMigrationAliases(value: unknown): NotebookArtifactMigrationAliases | null;
export declare function isNotebookPathname(value: string): boolean;
export declare function isRelativeTargetPath(value: string): boolean;
export declare function notebookRouteCollisionKey(value: string): string;
export declare function canonicalNotebookRoutePath(value: string): string | null;
/** Convert a canonical encoded artifact href into a literal static Router path. */
export declare function notebookArtifactCanonicalRoutePattern(route: string): string | null;
/** React Router path for a legacy root and all of its old descendants. */
export declare function notebookArtifactAliasRoutePath(alias: Pick<NotebookArtifactRouteAlias, 'from'>): string | null;
export declare function resolveNotebookArtifactRouteAlias(pathname: string, alias: Pick<NotebookArtifactRouteAlias, 'from' | 'targetPath' | 'route'>, basePath?: string): string | null;
export declare function legacyNotebookCanvasIds(aliases: NotebookArtifactMigrationAliases | null | undefined): string[];
