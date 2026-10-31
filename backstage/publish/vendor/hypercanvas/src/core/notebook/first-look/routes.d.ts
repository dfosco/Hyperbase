/**
 * Browser-safe canonical route helpers for first-look artifacts.
 *
 * Canonical public routes are `/<id>` for prototypes, `/canvas/<id>`,
 * `/docs/<id>`, and `/sites/<id>`. Every helper honors a deployment base such
 * as `/preview/branch/`. Ported from the pinned upstream
 * `src/core/runtime/notebook-routes.js`.
 */
import { type FirstLookDiagnostic, type FirstLookKind, type FirstLookView } from './contract.js';
export type RouteArtifact = {
    id: string | null;
    kind: FirstLookKind | string;
    views?: Array<FirstLookView | null | undefined>;
    [key: string]: unknown;
};
export type RouteLocation = string | URL | {
    pathname?: string;
    search?: string;
    hash?: string;
};
export type RouteParseResult = {
    status: 'matched' | 'not-found' | 'invalid' | 'ambiguous';
    artifact?: RouteArtifact | undefined;
    view?: FirstLookView | null | undefined;
    canonicalPath?: string | undefined;
    legacy?: boolean | undefined;
    diagnostics: FirstLookDiagnostic[];
};
export declare function normalizeRouteBase(base?: unknown): string;
/**
 * Split an authored prototype view path into encoded path segments and its
 * preserved query and fragment suffix. Traversal and separators are rejected.
 */
export declare function prototypeRouteParts(view: {
    path?: unknown;
} | null | undefined): {
    segments: string[];
    suffix: string;
};
/** Build the canonical public path for an artifact and optional authored view. */
export declare function buildArtifactPath(artifact: RouteArtifact, { base, viewId }?: {
    base?: string;
    viewId?: string;
}): string;
/** Diagnose route IDs, authored view routes, reserved roots, and collisions. */
export declare function diagnoseArtifactRoutes(artifacts: unknown, { base }?: {
    base?: string;
}): FirstLookDiagnostic[];
/** Parse a public artifact route, including read-only legacy `?artifact=` links. */
export declare function parseArtifactPath(location: RouteLocation, { artifacts, base }?: {
    artifacts?: unknown;
    base?: string;
}): RouteParseResult;
