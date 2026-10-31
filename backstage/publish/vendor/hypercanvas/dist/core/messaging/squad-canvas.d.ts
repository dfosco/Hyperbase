import type { CanvasState } from '../canvas/materializer.js';
export declare function connectedAgentIds(canvas: CanvasState, widgetId: string, allowedIds?: string[]): string[];
export declare function readSquadCanvas(root: string, canvasId: string | null, widgetId?: string): {
    canvasId: string;
    filePath: string;
    canvas: CanvasState;
} | null;
export declare function wireSquadPeers(root: string, canvasId: string | null, leaderId: string, memberIds: string[], wire?: boolean): string | null;
