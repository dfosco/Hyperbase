/**
 * Create Prototype feature — create new prototypes from the Workshop panel.
 *
 * Each workshop feature exports a standard interface:
 *   - name:          Feature identifier (matches config key in workshop.features)
 *   - label:         Display name for the menu item
 *   - icon:          Emoji or HTML for the menu icon
 *   - overlayId:     Unique ID for the overlay
 *   - overlay:       Component rendered in the overlay
 *   - serverSetup:   Called by the server plugin to register API routes
 */
import type { ComponentType } from 'react';
import type { WorkshopOverlayProps } from '../types.js';
export declare const name = "createPrototype";
export declare const label = "Create prototype";
export declare const icon = "\uD83E\uDDE9";
export declare const overlayId = "createPrototype";
export declare const overlay: ComponentType<WorkshopOverlayProps>;
