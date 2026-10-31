/**
 * Create Canvas feature — create new canvases from the Workshop panel.
 *
 * Server routes are handled by the dedicated canvas handler at /_hypercanvas/canvas/.
 * This feature only provides the workshop UI overlay.
 */
import type { ComponentType } from 'react';
import type { WorkshopOverlayProps } from '../types.js';
export declare const name = "createCanvas";
export declare const label = "Create canvas";
export declare const icon = "\uD83C\uDFA8";
export declare const overlayId = "createCanvas";
export declare const overlay: ComponentType<WorkshopOverlayProps>;
