/** Explicit glob entries keep tool UI lazy while making every module part of the build graph. */
type CoreToolUiComponent = 'ActionMenuButton' | 'AgentsReadyTrigger' | 'AutosyncMenuButton' | 'CanvasAgentsMenu' | 'CanvasCreateMenu' | 'CanvasSnap' | 'CanvasUndoRedo' | 'CanvasZoomControl' | 'CanvasZoomToFit' | 'CommandPaletteTrigger' | 'CommentsMenuButton' | 'CreateMenuButton' | 'HideChromeTrigger' | 'PublishControl' | 'ThemeMenuButton';
export declare function loadUiComponent(specifier: CoreToolUiComponent): Promise<{
    default: unknown;
}>;
export {};
