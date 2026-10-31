import type { PartialConfig, PartialEntry } from './partialRender.js';
export declare function buildTemplateRecipeIndex(root: string, configPartials?: PartialConfig[]): PartialEntry[];
export declare function resolveTemplateRecipeEntry(entries: PartialEntry[], templateValue: unknown, { prototype, folder }?: {
    prototype?: string;
    folder?: string;
}): PartialEntry | null;
