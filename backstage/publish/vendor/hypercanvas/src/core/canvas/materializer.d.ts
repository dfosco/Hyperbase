import type { CanvasEventFields } from './canvasEvents.js';
import type { CanvasLayoutRestorationEvent, CanvasLayoutUpdatedEvent } from './canvasEvents.js';
export type { CanvasLayoutFieldSnapshot, CanvasLayoutGeometry, CanvasLayoutRestorationEvent, CanvasLayoutUpdatedEvent, CanvasScrollAxis, CanvasSourceGeometry, CanvasLayoutSourceSnapshot, DecodedCanvasEvent } from './canvasEvents.js';
export interface CanvasWidget extends CanvasEventFields {
    id: string;
    props?: CanvasEventFields | null;
    position?: CanvasEventFields;
    connectorIds?: string[];
}
export interface CanvasConnector extends CanvasEventFields {
    id: string;
    start: CanvasEventFields & {
        widgetId: string;
    };
    end: CanvasEventFields & {
        widgetId: string;
    };
    meta?: CanvasEventFields;
    style?: CanvasEventFields;
    data?: CanvasEventFields;
    className?: string;
}
export interface CanvasState extends CanvasEventFields {
    widgets?: CanvasWidget[];
    connectors?: CanvasConnector[];
    sources?: unknown[] | null;
    scroll?: CanvasEventFields & {
        axis?: 'both' | 'vertical' | 'horizontal' | 'none';
    };
}
/**
 * Parse canvas event text into an array of event objects.
 * Blank lines and malformed JSON snippets are skipped.
 *
 * @param {string} text - Raw canvas event file contents
 * @returns {object[]} Parsed event objects
 */
export declare function parseCanvasJsonl(text: string): unknown[];
/**
 * Capture the minimal field-level inverse for a validated forward layout.
 * Existing source metadata is deliberately excluded; only layout geometry is
 * restored. A source introduced by the layout carries its exact generated
 * record so an independent edit makes the inverse conflict instead of delete.
 */
export declare function captureCanvasLayoutRestoration(state: CanvasState, layout: CanvasLayoutUpdatedEvent): CanvasLayoutRestorationEvent;
/** Create the inverse restoration record used for redo, without editor state. */
export declare function reverseCanvasLayoutRestoration(event: CanvasLayoutRestorationEvent): CanvasLayoutRestorationEvent;
/** Validate a single untrusted event before applying it to the current state. */
export declare function applyEvent(state: CanvasState, event: unknown): CanvasState;
/**
 * Materialize a canvas state from an ordered array of events.
 *
 * @param {object[]} events - Array of event objects (first should be canvas_created)
 * @returns {object} Materialized canvas state
 */
export declare function materialize(events: unknown[]): CanvasState;
/**
 * Convenience: parse JSONL text and materialize in one step.
 *
 * @param {string} text - Raw JSONL file contents
 * @returns {object} Materialized canvas state
 */
export declare function materializeFromText(text: string): CanvasState;
export interface CanvasDocumentDiagnostic {
    code: 'malformed_json' | 'missing_canvas_created' | 'invalid_event' | 'incompatible_format' | 'incompatible_required_event';
    line: number;
    event?: string;
    message: string;
}
/** Strict, line-aware authoring validation. Playback remains tolerant for legacy JSONL. */
export declare function validateCanvasJsonl(text: string): CanvasDocumentDiagnostic[];
/**
 * Serialize a single event object to a JSONL line (no trailing newline).
 *
 * @param {object} event - Event object
 * @returns {string} Single-line JSON string
 */
export declare function serializeEvent(event: unknown): string;
