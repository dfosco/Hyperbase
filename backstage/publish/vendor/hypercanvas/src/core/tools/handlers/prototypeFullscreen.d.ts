/**
 * Prototype Fullscreen tool — keyboard-only handler that toggles immersive
 * fullscreen mode for the selected prototype widget on the canvas.
 *
 * No UI component — triggered exclusively via Cmd+Opt+Ctrl+F.
 * Dispatches a custom event that CanvasPage listens for.
 */
export declare const id = "prototype-fullscreen";
export declare function handler(): Promise<{
    toggle(): void;
}>;
