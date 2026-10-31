/**
 * Palette Providers — adapters that produce searchable items for the command palette.
 *
 * Each provider returns an array of palette items:
 *   { id, label, category, icon?, action: () => void }
 *
 * Providers cache their datasets on palette open. Only fuzzy scoring runs per keystroke.
 */
export interface PaletteItem {
    id: string;
    label: string;
    category: string;
    icon?: string;
    localOnly?: boolean;
    hint?: string;
    action: () => void;
}
export interface PaletteDataset {
    commands: PaletteItem[];
    prototypes: PaletteItem[];
    canvases: PaletteItem[];
    stories: PaletteItem[];
    recent: PaletteItem[];
}
export interface PaletteGroup {
    category: string;
    items: PaletteItem[];
}
/**
 * Build command items from the resolved action registry.
 * Flattens submenus so their children appear as individual items.
 *
 * @param {string} mode — current mode name
 * @param {string} basePath
 * @returns {PaletteItem[]}
 */
export declare function buildCommandItems(mode: string, basePath: string): PaletteItem[];
/**
 * Build prototype items from the viewfinder index.
 *
 * @param {string} basePath
 * @returns {PaletteItem[]}
 */
export declare function buildPrototypeItems(basePath: string): PaletteItem[];
/**
 * Build canvas items from the viewfinder index.
 *
 * @param {string} basePath
 * @returns {PaletteItem[]}
 */
export declare function buildCanvasItems(basePath: string): PaletteItem[];
/**
 * Build story items from the data index.
 *
 * @param {string} basePath
 * @returns {PaletteItem[]}
 */
export declare function buildStoryItems(basePath: string): PaletteItem[];
/**
 * Build recent items from localStorage.
 * Derives routes at read time for correctness across branches.
 *
 * @param {string} basePath
 * @returns {PaletteItem[]}
 */
export declare function buildRecentItems(basePath: string): PaletteItem[];
/**
 * Build all provider datasets. Call once per palette open, cache the result.
 *
 * @param {string} mode
 * @param {string} basePath
 * @returns {PaletteDataset}
 */
export declare function buildAllItems(mode: string, basePath: string): PaletteDataset;
/**
 * Search across all cached datasets.
 *
 * @param {PaletteDataset} dataset — cached from buildAllItems
 * @param {string} query
 * @returns {{ category: string, items: PaletteItem[] }[]}
 */
export declare function searchPalette(dataset: PaletteDataset, query: string): PaletteGroup[];
