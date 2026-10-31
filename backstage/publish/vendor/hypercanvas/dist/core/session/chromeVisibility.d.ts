import { type NotebookViewMode } from './notebookView.js';
/** Apply link-only presentation before first paint and after host navigation. */
export declare function applyHideUIFromUrl(): void;
/** Recovery changes the URL, never a global preference. Removed views cannot recover. */
export declare function setNotebookViewMode(mode: NotebookViewMode): boolean;
export declare function toggleNotebookChrome(): boolean;
export declare function clearHideUIFromUrl(): void;
export declare function isPaletteAvailable(): boolean;
export declare function getNotebookViewSearch(): string;
export declare function isCanvasImmersive(): boolean;
export declare function isChromeHidden(): boolean;
export declare function subscribeToChromeVisibility(callback: () => void): () => void;
