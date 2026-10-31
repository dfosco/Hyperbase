/** Runtime boundary for persisted canvas JSONL records. */
import { z } from 'zod';
/** Default version used by legacy writers. New layout semantics require v2. */
export const CANVAS_FORMAT_VERSION = 1;
export const CANVAS_FORMAT_VERSION_WITH_LAYOUT = 2;
export const SUPPORTED_CANVAS_FORMAT_VERSIONS = [CANVAS_FORMAT_VERSION, CANVAS_FORMAT_VERSION_WITH_LAYOUT];
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const knownEvents = new Set([
    'canvas_created', 'widget_added', 'widget_updated', 'widget_moved', 'widget_removed',
    'settings_updated', 'source_updated', 'widgets_replaced', 'connector_added',
    'connector_removed', 'connectors_replaced', 'connector_waypoints_set',
    'connector_waypoints_cleared', 'connector_updated',
    'canvas_layout_updated', 'canvas_layout_restored',
]);
const fieldsSchema = z.record(z.string(), z.unknown());
const widgetSchema = z.object({ id: z.string().min(1) }).passthrough();
const connectorSchema = z.object({
    id: z.string().min(1),
    start: z.object({ widgetId: z.string().min(1) }).passthrough(),
    end: z.object({ widgetId: z.string().min(1) }).passthrough(),
}).passthrough();
const finite = z.number().finite();
const legacyGeometry = z.object({
    key: z.string().min(1).optional(), id: z.string().min(1).optional(), export: z.string().min(1).optional(),
    position: z.object({ x: finite, y: finite }).nullable().optional(),
    width: finite.nonnegative().nullable().optional(), height: finite.nonnegative().nullable().optional(),
    bounds: z.record(z.string(), finite).nullable().optional(),
}).passthrough();
const legacyWidget = legacyGeometry.refine(item => Boolean(item.key || item.id), 'Legacy widget requires a key or id');
const legacySource = legacyGeometry.refine(item => Boolean(item.key || item.export), 'Legacy source requires a key or export');
const legacyLayout = z.object({
    widgets: z.array(legacyWidget), sources: z.array(legacySource),
    scroll: z.object({ axis: z.enum(['both', 'vertical', 'horizontal', 'none']) }).optional(),
}).passthrough().superRefine((layout, ctx) => {
    for (const [kind, keys] of [['widgets', layout.widgets.map(item => item.key || item.id)], ['sources', layout.sources.map(item => item.key || item.export)]]) {
        if (new Set(keys).size !== keys.length)
            ctx.addIssue({ code: 'custom', message: `Duplicate ${kind} key in legacy canvas layout` });
    }
});
/** Nested transactions and flat v2 geometry must never share a decoder path. */
export function isLegacyCanvasLayoutEvent(value) {
    return value.event === 'canvas_layout_updated' && Object.hasOwn(value, 'layout')
        && !['scroll', 'widgets', 'sources'].some(key => Object.hasOwn(value, key));
}
const layoutGeometrySchema = z.object({
    id: z.string().min(1),
    position: z.object({ x: finite, y: finite }).passthrough(),
    width: finite.positive(),
    height: finite.positive(),
}).passthrough();
const sourceGeometrySchema = z.object({
    export: z.string().min(1),
    position: z.object({ x: finite, y: finite }).passthrough(),
    width: finite.positive(),
    height: finite.positive(),
}).passthrough();
const layoutFieldSnapshotSchema = z.union([
    z.object({ present: z.literal(false) }).strict(),
    z.object({ present: z.literal(true), value: z.unknown() }).strict()
        .refine((snapshot) => Object.prototype.hasOwnProperty.call(snapshot, 'value') && snapshot.value !== undefined, 'A present field snapshot must include a JSON value'),
]);
const layoutSourceSnapshotSchema = z.union([
    z.object({ present: z.literal(false) }).strict(),
    z.object({
        present: z.literal(true),
        position: layoutFieldSnapshotSchema,
        width: layoutFieldSnapshotSchema,
        height: layoutFieldSnapshotSchema,
    }).strict(),
    z.object({ present: z.literal(true), index: z.number().int().nonnegative(), record: z.record(z.string(), z.unknown()) }).strict(),
]);
// Every known event schema passes through additional fields. Event metadata and
// widget/connector extensions are persisted alongside the structured fields.
const eventSchemas = {
    canvas_created: z.object({ event: z.literal('canvas_created') }).passthrough(),
    widget_added: z.object({ event: z.literal('widget_added'), widget: widgetSchema }).passthrough(),
    widget_updated: z.object({ event: z.literal('widget_updated'), widgetId: z.string().min(1), props: fieldsSchema }).passthrough(),
    widget_moved: z.object({ event: z.literal('widget_moved'), widgetId: z.string().min(1), position: fieldsSchema }).passthrough(),
    widget_removed: z.union([
        z.object({ event: z.literal('widget_removed'), widgetId: z.string().min(1) }).passthrough(),
        z.object({ event: z.literal('widget_removed'), widget: widgetSchema }).passthrough(),
    ]),
    settings_updated: z.object({ event: z.literal('settings_updated'), settings: fieldsSchema }).passthrough(),
    source_updated: z.object({ event: z.literal('source_updated'), sources: z.array(z.unknown()) }).passthrough(),
    widgets_replaced: z.object({ event: z.literal('widgets_replaced'), widgets: z.array(widgetSchema) }).passthrough(),
    connector_added: z.object({ event: z.literal('connector_added'), connector: connectorSchema }).passthrough(),
    connector_removed: z.union([
        z.object({ event: z.literal('connector_removed'), connectorId: z.string().min(1) }).passthrough(),
        z.object({ event: z.literal('connector_removed'), connector: z.object({ id: z.string().min(1) }).passthrough() }).passthrough(),
    ]),
    connectors_replaced: z.object({ event: z.literal('connectors_replaced'), connectors: z.array(connectorSchema).nullable().optional() }).passthrough(),
    connector_waypoints_set: z.object({ event: z.literal('connector_waypoints_set'), connectorId: z.string().min(1), waypoints: z.unknown().optional() }).passthrough(),
    connector_waypoints_cleared: z.object({ event: z.literal('connector_waypoints_cleared'), connectorId: z.string().min(1) }).passthrough(),
    connector_updated: z.object({ event: z.literal('connector_updated'), connectorId: z.string().min(1), updates: fieldsSchema.nullable().optional() }).passthrough(),
    canvas_layout_updated: z.object({
        event: z.literal('canvas_layout_updated'),
        scroll: z.object({ axis: z.enum(['both', 'vertical', 'horizontal', 'none']) }).passthrough(),
        widgets: z.array(layoutGeometrySchema),
        sources: z.array(sourceGeometrySchema),
    }).passthrough(),
    canvas_layout_restored: z.object({
        event: z.literal('canvas_layout_restored'),
        required: z.literal(true),
        action: z.enum(['undo', 'redo']),
        snapshot: z.object({
            axis: z.object({ expected: z.enum(['both', 'vertical', 'horizontal', 'none']), restore: z.enum(['both', 'vertical', 'horizontal', 'none']) }).strict(),
            widgets: z.array(z.object({
                id: z.string().min(1),
                expected: z.object({ position: layoutFieldSnapshotSchema, width: layoutFieldSnapshotSchema, height: layoutFieldSnapshotSchema, propsContainer: z.enum(['absent', 'null', 'object']) }).strict(),
                restore: z.object({ position: layoutFieldSnapshotSchema, width: layoutFieldSnapshotSchema, height: layoutFieldSnapshotSchema, propsContainer: z.enum(['absent', 'null', 'object']) }).strict(),
            }).strict()),
            sources: z.array(z.object({ export: z.string().min(1), expected: layoutSourceSnapshotSchema, restore: layoutSourceSnapshotSchema }).strict()),
            sourcesContainer: z.object({ expected: z.enum(['absent', 'null', 'array']), restore: z.enum(['absent', 'null', 'array']) }).strict(),
        }).strict(),
    }).passthrough(),
};
export function isKnownCanvasEventName(eventName) {
    return knownEvents.has(eventName);
}
/** @param {unknown} event @returns {event is Record<string, unknown>} */
function isEventRecord(event) {
    return isRecord(event) && typeof event.event === 'string';
}
/**
 * Validate a parsed JSON value as a canvas event. This intentionally validates
 * only fields required by the reducer; widget props, connector metadata, and
 * event metadata remain extensible.
 *
 * @param {unknown} value
 * @returns {DecodedCanvasEvent | null}
 */
export function decodeCanvasEvent(value) {
    if (!isEventRecord(value))
        return null;
    const evt = value;
    switch (evt.event) {
        case 'canvas_created':
            if ('formatVersion' in evt && !SUPPORTED_CANVAS_FORMAT_VERSIONS.includes(evt.formatVersion)) {
                throw new Error(`Unsupported canvas formatVersion: ${String(evt.formatVersion)}`);
            }
            return eventSchemas.canvas_created.parse(evt);
        case 'widget_added': {
            const parsed = eventSchemas.widget_added.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'widget_updated': {
            const parsed = eventSchemas.widget_updated.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'widget_moved': {
            const parsed = eventSchemas.widget_moved.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'widget_removed': {
            // Retain the historical preference for widgetId when both forms exist.
            const parsed = eventSchemas.widget_removed.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'settings_updated': {
            const parsed = eventSchemas.settings_updated.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'source_updated': {
            const parsed = eventSchemas.source_updated.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'widgets_replaced': {
            const parsed = eventSchemas.widgets_replaced.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'connector_added': {
            const parsed = eventSchemas.connector_added.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'connector_removed': {
            const parsed = eventSchemas.connector_removed.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'connectors_replaced': {
            // Historical reducer behavior treats a missing or null array as empty.
            const parsed = eventSchemas.connectors_replaced.safeParse(evt);
            if (!parsed.success)
                return null;
            return { ...parsed.data, connectors: parsed.data.connectors ?? [] };
        }
        case 'connector_waypoints_set': {
            const parsed = eventSchemas.connector_waypoints_set.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'connector_waypoints_cleared': {
            const parsed = eventSchemas.connector_waypoints_cleared.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'connector_updated': {
            const parsed = eventSchemas.connector_updated.safeParse(evt);
            return parsed.success ? parsed.data : null;
        }
        case 'canvas_layout_updated': {
            if (Object.hasOwn(evt, 'layout') || Object.hasOwn(evt, 'prevLayout')) {
                if (!isLegacyCanvasLayoutEvent(evt))
                    throw new Error('Mixed legacy and v2 canvas_layout_updated event');
                const parsed = z.object({ layout: legacyLayout, prevLayout: legacyLayout.optional() }).passthrough().safeParse(evt);
                if (!parsed.success)
                    throw new Error(`Invalid legacy canvas_layout_updated event: ${parsed.error.message}`);
                return parsed.data;
            }
            const parsed = eventSchemas.canvas_layout_updated.safeParse(evt);
            if (!parsed.success)
                throw new Error('Invalid required canvas_layout_updated event');
            return parsed.data;
        }
        case 'canvas_layout_restored': {
            const parsed = eventSchemas.canvas_layout_restored.safeParse(evt);
            if (!parsed.success)
                throw new Error('Invalid required canvas_layout_restored event');
            const snapshot = parsed.data.snapshot;
            if (new Set(snapshot.widgets.map((widget) => widget.id)).size !== snapshot.widgets.length) {
                throw new Error('Duplicate widget in canvas_layout_restored snapshot');
            }
            if (new Set(snapshot.sources.map((source) => source.export)).size !== snapshot.sources.length) {
                throw new Error('Duplicate source in canvas_layout_restored snapshot');
            }
            if (snapshot.sources.some((source) => [source.expected, source.restore].some((side) => side.present && 'record' in side && side.record.export !== source.export))) {
                throw new Error('Mismatched source export in canvas_layout_restored snapshot');
            }
            return parsed.data;
        }
        default:
            // Unknown event names are deliberately omitted from the trusted stream.
            // The reducer's behavior remains a no-op for them.
            return null;
    }
}
/** @param {unknown[]} values @returns {DecodedCanvasEvent[]} */
export function decodeCanvasEvents(values) {
    return values.flatMap((value) => {
        const event = decodeCanvasEvent(value);
        return event ? [event] : [];
    });
}
/**
 * Verify format markers and required semantics. Unversioned streams retain
 * the permissive legacy decoder. Layout events require a v2 header.
 *
 * @param {unknown[]} values
 */
export function assertSupportedCanvasFormat(values) {
    let formatVersion;
    for (const value of values) {
        if (!isEventRecord(value))
            continue;
        if (value.event === 'canvas_created' && 'formatVersion' in value) {
            if (!SUPPORTED_CANVAS_FORMAT_VERSIONS.includes(value.formatVersion)) {
                throw new Error(`Unsupported canvas formatVersion: ${String(value.formatVersion)}`);
            }
            formatVersion = value.formatVersion;
        }
        if (isLegacyCanvasLayoutEvent(value)) {
            if (formatVersion === CANVAS_FORMAT_VERSION_WITH_LAYOUT)
                throw new Error('Legacy canvas_layout_updated is not valid in canvas formatVersion 2');
        }
        else if ((value.event === 'canvas_layout_updated' || value.event === 'canvas_layout_restored') && formatVersion !== CANVAS_FORMAT_VERSION_WITH_LAYOUT) {
            throw new Error(`${value.event} requires canvas formatVersion 2`);
        }
        if (!knownEvents.has(value.event) && value.required === true) {
            throw new Error(`Unsupported required canvas event: ${value.event}`);
        }
    }
}
/** Return the explicit header version, or undefined for an unversioned legacy stream. */
export function getCanvasFormatVersion(values) {
    const header = values.find((value) => isEventRecord(value) && value.event === 'canvas_created');
    if (!isEventRecord(header) || typeof header.formatVersion !== 'number')
        return undefined;
    return header.formatVersion;
}
/** @param {unknown} event */
export function assertSerializableCanvasEvent(event) {
    if (!isEventRecord(event))
        throw new Error('Cannot serialize malformed canvas event');
    const eventName = event.event;
    if (typeof eventName !== 'string')
        throw new Error('Cannot serialize malformed canvas event');
    if (!knownEvents.has(eventName)) {
        if (event.required === true)
            throw new Error(`Cannot serialize unsupported required canvas event: ${eventName}`);
        return;
    }
    if (!decodeCanvasEvent(event))
        throw new Error('Cannot serialize malformed canvas event');
}
