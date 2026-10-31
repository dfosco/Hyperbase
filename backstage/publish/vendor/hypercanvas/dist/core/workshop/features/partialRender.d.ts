export interface PartialConfig {
    directory: string;
    name: string;
    globals?: string[];
}
export interface PartialEntry {
    id: string;
    name: string;
    directory: string;
    kind: 'template' | 'recipe';
    scope: 'global' | 'prototype';
    baseDir: string;
    globals?: string[];
    prototype?: string;
    folder?: string;
}
/** Find the main component file (*.jsx|*.tsx) in a partial directory. */
export declare function findComponentFile(dir: string): string | null;
/** Generate index.jsx that imports a template or recipe component. */
export declare function renderPartialIndexJsx({ partialEntry, componentFile, componentName, title }: {
    partialEntry: PartialEntry;
    componentFile: string;
    componentName: string;
    title: string;
}): string;
/** Read the workshop.partials config from storyboard.config.json. */
export declare function readWorkshopPartials(root: string): PartialConfig[];
