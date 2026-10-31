export declare const id = "canvas-toolbar";
export declare function handler(): Promise<{
    zoomIn(currentZoom: number): void;
    zoomOut(currentZoom: number): void;
    zoomReset(): void;
    zoomToFit(): void;
    undo(): void;
    redo(): void;
    toggleAutoPlace(): void;
    ZOOM_MIN: number;
    ZOOM_MAX: number;
}>;
export declare function component(renderType: string): Promise<unknown | null>;
