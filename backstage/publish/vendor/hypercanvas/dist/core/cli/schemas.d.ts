/**
 * Creation schemas — define flags for each `hypercanvas create` subcommand.
 *
 * Each schema is a plain object mapping flag names to definitions.
 * Schemas serve as validation, documentation, and help-text source.
 *
 */
import type { FlagSchema } from './flags.js';
export declare const prototypeSchema: FlagSchema;
export declare const canvasSchema: FlagSchema;
export declare const flowSchema: FlagSchema;
export declare const pageSchema: FlagSchema;
export declare const widgetSchema: FlagSchema;
export declare const componentSchema: FlagSchema;
