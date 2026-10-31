/// <reference types="vite/client" />
const uiComponentLoaders = import.meta.glob([
    '../ui/ActionMenuButton.jsx',
    '../ui/AgentsReadyTrigger.jsx',
    '../ui/AutosyncMenuButton.jsx',
    '../ui/CanvasAgentsMenu.jsx',
    '../ui/CanvasCreateMenu.jsx',
    '../ui/CanvasSnap.jsx',
    '../ui/CanvasUndoRedo.jsx',
    '../ui/CanvasZoomControl.jsx',
    '../ui/CanvasZoomToFit.jsx',
    '../ui/CommandPaletteTrigger.jsx',
    '../ui/CommentsMenuButton.jsx',
    '../ui/CreateMenuButton.jsx',
    '../ui/HideChromeTrigger.jsx',
    '../ui/PublishControl.jsx',
    '../ui/ThemeMenuButton.jsx',
]);
export async function loadUiComponent(specifier) {
    const load = uiComponentLoaders[`../ui/${specifier}.jsx`];
    if (!load)
        throw new Error(`Unknown Core tool UI component: ${specifier}`);
    return load();
}
