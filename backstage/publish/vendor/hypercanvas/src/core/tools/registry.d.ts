/**
 * Tool module registry — maps tool IDs to lazy-loaded handler modules.
 *
 * Each handler module exports: { id, component?, handler?, setup?, guard? }
 * All imports are dynamic to enable code splitting.
 */
export declare const coreHandlers: {
    create: () => Promise<typeof import("./handlers/create.js")>;
    workspace: () => Promise<typeof import("./handlers/workspace.js")>;
    theme: () => Promise<typeof import("./handlers/theme.js")>;
    'palette-theme': () => Promise<typeof import("./handlers/paletteTheme.js")>;
    comments: () => Promise<typeof import("./handlers/comments.js")>;
    flows: () => Promise<typeof import("./handlers/flows.js")>;
    knobs: () => Promise<typeof import("./handlers/knobs.js")>;
    inspector: () => Promise<typeof import("./handlers/inspector.js")>;
    devtools: () => Promise<typeof import("./handlers/devtools.js")>;
    'feature-flags': () => Promise<typeof import("./handlers/featureFlags.js")>;
    autosync: () => Promise<typeof import("./handlers/autosync.js")>;
    'canvas-add-widget': () => Promise<typeof import("./handlers/canvasAddWidget.js")>;
    'canvas-agents': () => Promise<typeof import("./handlers/canvasAgents.js")>;
    'canvas-toolbar': () => Promise<typeof import("./handlers/canvasToolbar.js")>;
    'agents-ready': () => Promise<typeof import("./handlers/agentsReady.js")>;
    'hide-toolbars': () => Promise<typeof import("./handlers/hideToolbars.js")>;
    'command-palette': () => Promise<typeof import("./handlers/commandPalette.js")>;
    publish: () => Promise<typeof import("./handlers/publish.js")>;
    'hide-chrome': () => Promise<typeof import("./handlers/hideChrome.js")>;
};
export declare const toolModules: {
    create: () => Promise<typeof import("./handlers/create.js")>;
    workspace: () => Promise<typeof import("./handlers/workspace.js")>;
    theme: () => Promise<typeof import("./handlers/theme.js")>;
    'palette-theme': () => Promise<typeof import("./handlers/paletteTheme.js")>;
    comments: () => Promise<typeof import("./handlers/comments.js")>;
    flows: () => Promise<typeof import("./handlers/flows.js")>;
    knobs: () => Promise<typeof import("./handlers/knobs.js")>;
    inspector: () => Promise<typeof import("./handlers/inspector.js")>;
    devtools: () => Promise<typeof import("./handlers/devtools.js")>;
    'feature-flags': () => Promise<typeof import("./handlers/featureFlags.js")>;
    autosync: () => Promise<typeof import("./handlers/autosync.js")>;
    'canvas-add-widget': () => Promise<typeof import("./handlers/canvasAddWidget.js")>;
    'canvas-agents': () => Promise<typeof import("./handlers/canvasAgents.js")>;
    'canvas-toolbar': () => Promise<typeof import("./handlers/canvasToolbar.js")>;
    'agents-ready': () => Promise<typeof import("./handlers/agentsReady.js")>;
    'hide-toolbars': () => Promise<typeof import("./handlers/hideToolbars.js")>;
    'command-palette': () => Promise<typeof import("./handlers/commandPalette.js")>;
    publish: () => Promise<typeof import("./handlers/publish.js")>;
    'hide-chrome': () => Promise<typeof import("./handlers/hideChrome.js")>;
};
