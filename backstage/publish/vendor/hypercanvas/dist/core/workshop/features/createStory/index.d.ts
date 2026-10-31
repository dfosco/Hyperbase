/**
 * Create Story feature — workshop form for creating .story.jsx/.tsx files.
 *
 * Server routes are handled by the canvas handler at /_hypercanvas/canvas/create-story.
 * This feature provides the workshop UI overlay.
 */
import type { ComponentType } from 'react';
import type { WorkshopOverlayProps } from '../types.js';
export declare const name = "createStory";
export declare const label = "Create story";
export declare const icon = "\u26A1";
export declare const overlayId = "createStory";
export declare const overlay: ComponentType<WorkshopOverlayProps>;
