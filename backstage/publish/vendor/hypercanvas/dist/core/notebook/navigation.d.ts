export declare const NOTEBOOK_PAGE_TYPES: readonly ["prototype", "canvas", "component", "site", "doc"];
type LegacyNotebookPageType = 'prototype' | 'canvas' | 'component' | 'site';
export declare const NOTEBOOK_NAVIGATION_MODES: readonly ["type", "files"];
export type NotebookPageType = typeof NOTEBOOK_PAGE_TYPES[number];
export type NotebookNavigationMode = typeof NOTEBOOK_NAVIGATION_MODES[number];
export type NotebookNavigationPage = {
    id: string;
    type: string;
};
export type NotebookNavigationSection = {
    id: string;
    title: string;
    pageIds: string[];
};
export type NotebookNavigationEntry = {
    type: 'page';
    pageId: string;
} | {
    type: 'section';
    sectionId: string;
};
export type NotebookNavigation = {
    mode: NotebookNavigationMode;
    sectionsEnabled: boolean;
    type: {
        groups: NotebookPageType[];
        order: Record<LegacyNotebookPageType, string[]> & {
            doc?: string[];
        };
    };
    files: {
        flatOrder: string[];
        entries: NotebookNavigationEntry[];
        sections: NotebookNavigationSection[];
    };
};
export type LegacyNavigationGroup = {
    id?: unknown;
    title?: unknown;
    pageIds?: unknown;
};
export type NavigationDiagnostic = {
    code: 'INVALID_NAVIGATION';
    message: string;
    path: 'navigation';
};
export type NormalizedNavigation = {
    navigation: NotebookNavigation;
    valid: boolean;
    diagnostic: NavigationDiagnostic | null;
};
export type NavigationOperation = {
    type: 'setMode';
    mode: NotebookNavigationMode;
} | {
    type: 'setSectionsEnabled';
    enabled: boolean;
} | {
    type: 'reorderTypeGroups';
    groups: NotebookPageType[];
} | {
    type: 'movePage';
    layout: 'type';
    pageId: unknown;
    targetType?: string;
    index?: unknown;
} | {
    type: 'movePage';
    layout: 'filesFlat';
    pageId: unknown;
    index?: unknown;
} | {
    type: 'movePage';
    layout: 'filesSections';
    pageId: unknown;
    sectionId?: unknown;
    index?: unknown;
} | {
    type: 'createSection';
    sectionId?: unknown;
    title: unknown;
    index?: unknown;
} | {
    type: 'renameSection';
    sectionId: unknown;
    title: unknown;
} | {
    type: 'moveSection';
    sectionId: unknown;
    index?: unknown;
} | {
    type: 'removeSection';
    sectionId: unknown;
};
/**
 * Build all three independent page arrangements. `legacyGroups` is an
 * ordered array of { id, title, pageIds } groups imported once from legacy
 * filesystem organization; subsequent normalization never rediscovers it.
 */
export declare function createDefaultNavigation(pages: NotebookNavigationPage[], { legacyGroups }?: {
    legacyGroups?: LegacyNavigationGroup[];
}): NotebookNavigation;
/** Validate saved arrangements without ever returning a partial inventory. */
export declare function normalizeNavigation(value: unknown, pages: NotebookNavigationPage[]): NormalizedNavigation;
/** Apply a single explicit structural change and return a new valid layout. */
export declare function applyNavigationOperation(value: unknown, pages: NotebookNavigationPage[], operation: NavigationOperation): NotebookNavigation;
export {};
