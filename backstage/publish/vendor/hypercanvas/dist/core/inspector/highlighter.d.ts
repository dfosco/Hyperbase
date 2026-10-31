/**
 * Lightweight highlight.js highlighter for the inspector panel.
 *
 * Uses highlight.js/core with only the languages the inspector needs
 * (javascript, typescript, xml for JSX), producing small bundles with
 * no WASM dependencies.
 *
 * Theme is resolved at render time via toolbar.config.json's
 * `highlighting` key and the theme sync settings. Colors are applied
 * as inline styles — no global CSS injection, no theme conflicts.
 */
type ColorPalette = Record<string, string>;
type HighlightDecoration = {
    start: {
        line: number;
    };
    end?: {
        line: number;
    };
    properties?: {
        class?: string;
    };
};
type HighlightOptions = {
    lang?: string;
    theme?: string;
    lineNumbers?: boolean;
    decorations?: HighlightDecoration[];
};
type InspectorHighlighter = {
    codeToHtml: (code: string, options?: HighlightOptions) => string;
};
/**
 * Get the color palette for the current theme.
 * Falls back to github-dark-dimmed for unknown theme names.
 * Exported so InspectorPanel can use it for header/container colors.
 */
export declare function getColors(): ColorPalette;
/**
 * Create the inspector highlighter.
 * Returns an object with codeToHtml() matching the Shiki-compatible API.
 */
export declare function createInspectorHighlighter(): Promise<InspectorHighlighter>;
export {};
