import { assertSerializableCanvasEvent, assertSupportedCanvasFormat, decodeCanvasEvent, decodeCanvasEvents, isKnownCanvasEventName } from './canvasEvents.js';
/**
 * Canvas JSONL Materializer
 *
 * Pure, framework-agnostic module that replays a stream of canvas events
 * into a materialized canvas state object. Zero dependencies.
 *
 * Event types:
 *   canvas_created   — full initial state (first line)
 *   widget_added     — append a widget
 *   widget_updated   — patch widget props (may carry `prevProps` for undo)
 *   widget_moved     — update widget position (may carry `prevPosition` for undo)
 *   widget_removed   — remove a widget by id (carries `widget` for undo;
 *                      legacy events only had `widgetId`)
 *   settings_updated — patch canvas-level settings (may carry `prevSettings` for undo)
 *   source_updated   — replace the sources array (may carry `prevSources` for undo)
 *   widgets_replaced — replace the entire widgets array (compaction only, not undoable)
 *   connector_added  — append a connector between two widgets
 *   connector_removed — remove a connector by id (carries `connector` for undo;
 *                       legacy events only had `connectorId`)
 *   connectors_replaced — replace the entire connectors array (compaction only, not undoable)
 *   connector_waypoints_set     — set/replace manual routing waypoints (may carry `prevWaypoints`)
 *   connector_waypoints_cleared — drop manual routing (may carry `prevWaypoints`)
 *   connector_updated — patch connector anchors/meta (may carry `prevUpdates` for undo)
 *   canvas_layout_updated — atomically set scroll.axis and complete geometry snapshots
 *                          for JSONL widgets and JSX source exports (format v2)
 *
 * Event metadata (all events):
 *   id        — short random id stamped by the server, used by undo/redo
 *               to target a specific event. Legacy events without an id are
 *               non-undoable but materialize normally.
 *   meta.kind — present on undo/redo emissions ('undo' | 'redo'). The
 *               materializer ignores meta; it's informational for tools
 *               and a future timeline UI.
 *   meta.of   — the id of the event this undo/redo targets.
 *
 * Undo model: the materializer never "skips" events. Undo is a normal
 * forward event (a real `widget_added`/`widget_removed`/`widget_updated`)
 * that happens to carry meta.kind === 'undo'. Folding is one pass, no
 * special cases. Inverse payloads (`prevProps`, `prevPosition`, full
 * `widget`/`connector` on removes, etc.) are read only by the server's
 * POST /undo and POST /redo endpoints when computing the inverse event.
 */
/**
 * Split a text blob into top-level JSON object snippets.
 * Supports strict JSONL and accidentally concatenated objects.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitJsonObjects(text) {
    const chunks = [];
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            }
            else if (ch === '\\') {
                escaped = true;
            }
            else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{') {
            if (depth === 0)
                start = i;
            depth++;
            continue;
        }
        if (ch === '}') {
            if (depth > 0)
                depth--;
            if (depth === 0 && start >= 0) {
                chunks.push(text.slice(start, i + 1));
                start = -1;
            }
        }
    }
    return chunks;
}
/**
 * Parse canvas event text into an array of event objects.
 * Blank lines and malformed JSON snippets are skipped.
 *
 * @param {string} text - Raw canvas event file contents
 * @returns {object[]} Parsed event objects
 */
export function parseCanvasJsonl(text) {
    const events = [];
    for (const snippet of splitJsonObjects(text || '')) {
        try {
            const parsed = JSON.parse(snippet);
            if (isRecord(parsed))
                events.push(parsed);
        }
        catch {
            // Skip malformed snippets
        }
    }
    return events;
}
/**
 * Apply a single event to a state object and return the next state.
 *
 * Pure helper — exported so the client can apply server-acknowledged
 * undo/redo events optimistically without waiting for an HMR push (which
 * would otherwise be ignored by the dirty-guard on CanvasPage).
 *
 * Returns the same `state` reference if the event was unknown or had no
 * effect, so callers can cheaply detect no-ops.
 *
 * @param {object} state - Current canvas state (widgets, connectors, sources, settings)
 * @param {object} evt - Canvas event object
 * @returns {object} Next state
 */
function applyDecodedEvent(state, evt) {
    switch (evt.event) {
        case 'canvas_created': {
            const initial = { ...evt };
            delete initial.event;
            delete initial.timestamp;
            delete initial.formatVersion;
            if (!initial.connectors)
                initial.connectors = [];
            return initial;
        }
        case 'widget_added': {
            const widgets = state.widgets || [];
            return { ...state, widgets: [...widgets, evt.widget] };
        }
        case 'widget_updated': {
            return {
                ...state,
                widgets: (state.widgets || []).map((w) => w.id === evt.widgetId
                    ? { ...w, props: { ...(w.props || {}), ...(evt.props || {}) } }
                    : w),
            };
        }
        case 'widget_moved': {
            return {
                ...state,
                widgets: (state.widgets || []).map((w) => w.id === evt.widgetId ? { ...w, position: evt.position || {} } : w),
            };
        }
        case 'widget_removed': {
            const removedId = evt.widget?.id ?? evt.widgetId;
            const next = {
                ...state,
                widgets: (state.widgets || []).filter((w) => w.id !== removedId),
            };
            if (state.connectors?.length) {
                next.connectors = state.connectors.filter((c) => c.start.widgetId !== removedId && c.end.widgetId !== removedId);
            }
            return next;
        }
        case 'settings_updated': {
            if (!evt.settings)
                return state;
            return { ...state, ...(evt.settings || {}) };
        }
        case 'source_updated': {
            return { ...state, sources: evt.sources };
        }
        case 'widgets_replaced': {
            const next = { ...state, widgets: evt.widgets || [] };
            if (state.connectors?.length) {
                const widgetIds = new Set((evt.widgets || []).map((w) => w.id));
                next.connectors = state.connectors.filter((c) => widgetIds.has(c.start.widgetId) && widgetIds.has(c.end.widgetId));
            }
            return next;
        }
        case 'connector_added': {
            const connectors = state.connectors || [];
            return { ...state, connectors: [...connectors, evt.connector] };
        }
        case 'connector_removed': {
            const removedId = evt.connector?.id ?? evt.connectorId;
            return {
                ...state,
                connectors: (state.connectors || []).filter((c) => c.id !== removedId),
            };
        }
        case 'connectors_replaced': {
            return { ...state, connectors: evt.connectors || [] };
        }
        case 'connector_waypoints_set': {
            return {
                ...state,
                connectors: (state.connectors || []).map((c) => {
                    if (c.id !== evt.connectorId)
                        return c;
                    const waypoints = Array.isArray(evt.waypoints) ? evt.waypoints : [];
                    return { ...c, waypoints };
                }),
            };
        }
        case 'connector_waypoints_cleared': {
            return {
                ...state,
                connectors: (state.connectors || []).map((c) => {
                    if (c.id !== evt.connectorId)
                        return c;
                    const { waypoints: _waypoints, ...rest } = c;
                    return rest;
                }),
            };
        }
        case 'connector_updated': {
            return {
                ...state,
                connectors: (state.connectors || []).map((c) => {
                    if (c.id !== evt.connectorId)
                        return c;
                    const { startAnchor, endAnchor, meta, style, data, className, ...rest } = evt.updates || {};
                    const mergedMeta = { ...(c.meta || {}), ...(isRecord(meta) ? meta : {}) };
                    const start = startAnchor
                        ? { ...c.start, anchor: startAnchor }
                        : c.start;
                    const end = endAnchor
                        ? { ...c.end, anchor: endAnchor }
                        : c.end;
                    const next = { ...c, ...rest, meta: mergedMeta, id: c.id, start, end };
                    if (style === null)
                        delete next.style;
                    else if (isRecord(style))
                        next.style = { ...(c.style || {}), ...style };
                    if (data === null)
                        delete next.data;
                    else if (isRecord(data))
                        next.data = { ...(c.data || {}), ...data };
                    if (className === null)
                        delete next.className;
                    else if (typeof className === 'string')
                        next.className = className;
                    return next;
                }),
            };
        }
        case 'canvas_layout_updated': {
            if ('layout' in evt)
                return applyLegacyLayout(state, evt);
            const layout = evt;
            const currentWidgets = state.widgets || [];
            const widgetGeometry = new Map();
            for (const geometry of layout.widgets) {
                if (widgetGeometry.has(geometry.id))
                    throw new Error(`Duplicate widget in canvas layout: ${geometry.id}`);
                widgetGeometry.set(geometry.id, geometry);
            }
            if (widgetGeometry.size !== currentWidgets.length || currentWidgets.some((widget) => !widgetGeometry.has(widget.id))) {
                throw new Error('canvas_layout_updated must include every current widget exactly once');
            }
            const currentSources = state.sources || [];
            const sourceGeometry = new Map();
            for (const geometry of layout.sources) {
                if (sourceGeometry.has(geometry.export))
                    throw new Error(`Duplicate source in canvas layout: ${geometry.export}`);
                sourceGeometry.set(geometry.export, geometry);
            }
            const persistedExports = currentSources
                .filter((source) => isRecord(source) && typeof source.export === 'string')
                .map((source) => source.export);
            if (new Set(persistedExports).size !== persistedExports.length) {
                throw new Error('Canvas contains duplicate persisted JSX source exports');
            }
            if (persistedExports.some((name) => !sourceGeometry.has(name))) {
                throw new Error('canvas_layout_updated must include every persisted JSX source');
            }
            const widgets = currentWidgets.map((widget) => {
                const geometry = widgetGeometry.get(widget.id);
                return {
                    ...widget,
                    position: geometry.position,
                    props: { ...(widget.props || {}), width: geometry.width, height: geometry.height },
                };
            });
            const sourceByExport = new Map(currentSources
                .filter((source) => isRecord(source) && typeof source.export === 'string')
                .map((source) => [source.export, source]));
            const sources = [...currentSources];
            for (const geometry of layout.sources) {
                const current = sourceByExport.get(geometry.export);
                const next = {
                    ...(current || {}),
                    export: geometry.export,
                    position: geometry.position,
                    width: geometry.width,
                    height: geometry.height,
                };
                if (current)
                    sources[sources.indexOf(current)] = next;
                else
                    sources.push(next);
            }
            return {
                ...state,
                scroll: { ...(state.scroll || {}), axis: layout.scroll.axis },
                widgets,
                sources,
            };
        }
        case 'canvas_layout_restored':
            return applyCanvasLayoutRestoration(state, evt);
        default:
            // Optional unknown events are ignored for forward-compatible playback.
            return state;
    }
}
/** Legacy transactions patch only their geometry, never replace full widgets. */
function applyLegacyLayout(state, event) {
    if (state.formatVersion === 2)
        throw new Error('Legacy canvas_layout_updated is not valid in canvas formatVersion 2');
    const patchFields = (record, patch, fields) => {
        const next = { ...record };
        for (const field of fields) {
            if (!Object.hasOwn(patch, field))
                continue;
            if (patch[field] === null)
                delete next[field];
            else
                next[field] = patch[field];
        }
        return next;
    };
    const widgetPatches = new Map(event.layout.widgets.map(item => [item.key || item.id, item]));
    const widgets = (state.widgets || []).map(widget => {
        const patch = widgetPatches.get(String(widget.key || widget.id)) || widgetPatches.get(widget.id);
        if (!patch)
            return widget;
        const next = patchFields(widget, patch, ['position', 'bounds']);
        if (Object.hasOwn(patch, 'width') || Object.hasOwn(patch, 'height'))
            next.props = patchFields(widget.props || {}, patch, ['width', 'height']);
        return next;
    });
    const sourceKey = (source) => String(source.key || source.export);
    const newKeys = new Set(event.layout.sources.map(sourceKey));
    const removed = new Set((event.prevLayout?.sources || []).map(sourceKey).filter(key => !newKeys.has(key)));
    const sources = (state.sources || []).filter(source => !isRecord(source) || !removed.has(sourceKey(source)));
    for (const patch of event.layout.sources) {
        const key = sourceKey(patch);
        const index = sources.findIndex(source => isRecord(source) && sourceKey(source) === key);
        const current = index >= 0 && isRecord(sources[index]) ? sources[index] : { ...patch, export: patch.export || key };
        const next = patchFields(current, patch, ['position', 'width', 'height', 'bounds']);
        if (index >= 0)
            sources[index] = next;
        else
            sources.push(next);
    }
    return { ...state, widgets, sources, ...(event.layout.scroll ? { scroll: { ...(state.scroll || {}), ...event.layout.scroll } } : {}) };
}
function captureField(record, key) {
    if (!isRecord(record) || !Object.prototype.hasOwnProperty.call(record, key))
        return { present: false };
    if (record[key] === undefined)
        throw new Error(`Cannot snapshot non-JSON undefined layout field: ${key}`);
    return { present: true, value: record[key] };
}
function matchesField(record, key, snapshot) {
    if (!snapshot.present)
        return !record || !Object.prototype.hasOwnProperty.call(record, key);
    return Boolean(record && Object.prototype.hasOwnProperty.call(record, key) && deepEqual(record[key], snapshot.value));
}
function restoreField(record, key, snapshot) {
    if (snapshot.present)
        record[key] = snapshot.value;
    else
        delete record[key];
}
function deepEqual(left, right) {
    if (Object.is(left, right))
        return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right)
            && left.length === right.length
            && left.every((value, index) => deepEqual(value, right[index]));
    }
    if (!isRecord(left) || !isRecord(right))
        return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key, index) => key === rightKeys[index] && deepEqual(left[key], right[key]));
}
function sourceEntries(state) {
    const entries = (state.sources || []).filter((source) => isRecord(source) && typeof source.export === 'string');
    if (new Set(entries.map((source) => source.export)).size !== entries.length) {
        throw new Error('Canvas contains duplicate persisted JSX source exports');
    }
    return entries;
}
function axisOf(state) {
    const axis = state.scroll?.axis;
    return axis === 'vertical' || axis === 'horizontal' || axis === 'none' || axis === 'both' ? axis : 'both';
}
function sourcesContainerOf(state) {
    if (!Object.prototype.hasOwnProperty.call(state, 'sources'))
        return 'absent';
    return state.sources === null ? 'null' : 'array';
}
function sourceSnapshot(source) {
    return {
        present: true,
        position: captureField(source, 'position'),
        width: captureField(source, 'width'),
        height: captureField(source, 'height'),
    };
}
/**
 * Capture the minimal field-level inverse for a validated forward layout.
 * Existing source metadata is deliberately excluded; only layout geometry is
 * restored. A source introduced by the layout carries its exact generated
 * record so an independent edit makes the inverse conflict instead of delete.
 */
export function captureCanvasLayoutRestoration(state, layout) {
    const beforeSources = sourceEntries(state);
    const after = applyEvent(state, layout);
    if (after === state || !Array.isArray(after.widgets) || !Array.isArray(after.sources)) {
        throw new Error('Cannot capture restoration for an invalid canvas_layout_updated event');
    }
    const beforeWidgets = state.widgets || [];
    const afterWidgets = after.widgets;
    const beforePropsContainer = (widget) => !Object.prototype.hasOwnProperty.call(widget, 'props') ? 'absent' : widget.props === null ? 'null' : 'object';
    const widgets = beforeWidgets.map((widget) => {
        const next = afterWidgets.find((candidate) => candidate.id === widget.id);
        if (!next)
            throw new Error(`Cannot capture restoration for missing layout widget: ${widget.id}`);
        return {
            id: widget.id,
            expected: {
                position: captureField(next, 'position'),
                width: captureField(next.props, 'width'),
                height: captureField(next.props, 'height'),
                propsContainer: beforePropsContainer(next),
            },
            restore: {
                position: captureField(widget, 'position'),
                width: captureField(widget.props, 'width'),
                height: captureField(widget.props, 'height'),
                propsContainer: beforePropsContainer(widget),
            },
        };
    });
    const sources = layout.sources.map((geometry) => {
        const before = beforeSources.find((source) => source.export === geometry.export);
        const afterIndex = after.sources.findIndex((source) => isRecord(source) && source.export === geometry.export);
        const next = after.sources[afterIndex];
        if (!isRecord(next) || afterIndex < 0)
            throw new Error(`Cannot capture restoration for missing layout source: ${geometry.export}`);
        return before
            ? { export: geometry.export, expected: sourceSnapshot(next), restore: sourceSnapshot(before) }
            : { export: geometry.export, expected: { present: true, record: next, index: afterIndex }, restore: { present: false } };
    });
    return {
        event: 'canvas_layout_restored',
        required: true,
        action: 'undo',
        snapshot: {
            axis: { expected: axisOf(after), restore: axisOf(state) },
            widgets,
            sources,
            sourcesContainer: { expected: sourcesContainerOf(after), restore: sourcesContainerOf(state) },
        },
    };
}
/** Create the inverse restoration record used for redo, without editor state. */
export function reverseCanvasLayoutRestoration(event) {
    const swap = (value) => ({ expected: value.restore, restore: value.expected });
    return {
        ...event,
        action: event.action === 'undo' ? 'redo' : 'undo',
        snapshot: {
            axis: swap(event.snapshot.axis),
            widgets: event.snapshot.widgets.map((widget) => ({
                id: widget.id,
                expected: widget.restore,
                restore: widget.expected,
            })),
            sources: event.snapshot.sources.map((source) => ({ ...source, ...swap(source) })),
            sourcesContainer: swap(event.snapshot.sourcesContainer),
        },
    };
}
function applyCanvasLayoutRestoration(state, event) {
    const snapshot = event.snapshot;
    if (axisOf(state) !== snapshot.axis.expected)
        throw new Error('canvas_layout_restored axis conflict');
    if (sourcesContainerOf(state) !== snapshot.sourcesContainer.expected) {
        throw new Error('canvas_layout_restored sources container conflict');
    }
    const widgets = state.widgets || [];
    const widgetIds = new Set(widgets.map((widget) => widget.id));
    for (const entry of snapshot.widgets) {
        if (!widgetIds.has(entry.id))
            throw new Error(`canvas_layout_restored widget missing: ${entry.id}`);
        const widget = widgets.find((item) => item.id === entry.id);
        if (!matchesField(widget, 'position', entry.expected.position)
            || !matchesField(widget.props, 'width', entry.expected.width)
            || !matchesField(widget.props, 'height', entry.expected.height)) {
            throw new Error(`canvas_layout_restored widget conflict: ${entry.id}`);
        }
    }
    const sources = sourceEntries(state);
    for (const entry of snapshot.sources) {
        const currentIndex = sources.findIndex((source) => source.export === entry.export);
        const current = currentIndex < 0 ? undefined : sources[currentIndex];
        if (!entry.expected.present) {
            if (current)
                throw new Error(`canvas_layout_restored source conflict: ${entry.export}`);
        }
        else if ('record' in entry.expected) {
            if (!current || !deepEqual(current, entry.expected.record))
                throw new Error(`canvas_layout_restored source conflict: ${entry.export}`);
        }
        else if (!current
            || !matchesField(current, 'position', entry.expected.position)
            || !matchesField(current, 'width', entry.expected.width)
            || !matchesField(current, 'height', entry.expected.height)) {
            throw new Error(`canvas_layout_restored source conflict: ${entry.export}`);
        }
    }
    const nextWidgets = widgets.map((widget) => {
        const entry = snapshot.widgets.find((candidate) => candidate.id === widget.id);
        if (!entry)
            return widget;
        const next = { ...widget };
        restoreField(next, 'position', entry.restore.position);
        const props = { ...(isRecord(widget.props) ? widget.props : {}) };
        restoreField(props, 'width', entry.restore.width);
        restoreField(props, 'height', entry.restore.height);
        if (Object.keys(props).length)
            next.props = props;
        else if (entry.restore.propsContainer === 'null')
            next.props = null;
        else if (entry.restore.propsContainer === 'absent')
            delete next.props;
        else
            next.props = props;
        return next;
    });
    const nextSources = [...(state.sources || [])];
    for (const entry of snapshot.sources) {
        const currentIndex = nextSources.findIndex((source) => isRecord(source) && source.export === entry.export);
        if (!entry.restore.present) {
            if (currentIndex >= 0)
                nextSources.splice(currentIndex, 1);
        }
        else if ('record' in entry.restore) {
            if (currentIndex >= 0)
                throw new Error(`canvas_layout_restored source insertion conflict: ${entry.export}`);
            nextSources.splice(Math.min(entry.restore.index, nextSources.length), 0, entry.restore.record);
        }
        else {
            if (currentIndex < 0)
                throw new Error(`canvas_layout_restored source missing: ${entry.export}`);
            const current = nextSources[currentIndex];
            const next = { ...current };
            restoreField(next, 'position', entry.restore.position);
            restoreField(next, 'width', entry.restore.width);
            restoreField(next, 'height', entry.restore.height);
            nextSources[currentIndex] = next;
        }
    }
    const next = {
        ...state,
        scroll: { ...(state.scroll || {}), axis: snapshot.axis.restore },
        widgets: nextWidgets,
    };
    if (nextSources.length)
        next.sources = nextSources;
    else if (snapshot.sourcesContainer.restore === 'absent')
        delete next.sources;
    else if (snapshot.sourcesContainer.restore === 'null')
        next.sources = null;
    else
        next.sources = nextSources;
    return next;
}
/** Validate a single untrusted event before applying it to the current state. */
export function applyEvent(state, event) {
    const decoded = decodeCanvasEvent(event);
    return decoded ? applyDecodedEvent(state, decoded) : state;
}
/**
 * Materialize a canvas state from an ordered array of events.
 *
 * @param {object[]} events - Array of event objects (first should be canvas_created)
 * @returns {object} Materialized canvas state
 */
export function materialize(events) {
    let state = {};
    assertSupportedCanvasFormat(events);
    for (const evt of decodeCanvasEvents(events)) {
        state = applyDecodedEvent(state, evt);
    }
    // The legacy scrolling behavior allows both axes. Materialize that default
    // at the canonical per-canvas location so every consumer sees one setting.
    if (Object.keys(state).length > 0 && (!state.scroll || !['both', 'vertical', 'horizontal', 'none'].includes(String(state.scroll.axis)))) {
        state.scroll = { ...(state.scroll || {}), axis: 'both' };
    }
    // Derive connectorIds on widgets from the connectors array
    if (state.connectors?.length && state.widgets?.length) {
        // Build a map: widgetId → Set of connectorIds
        const widgetConnMap = new Map();
        for (const conn of state.connectors) {
            for (const endpoint of [conn.start, conn.end]) {
                if (!widgetConnMap.has(endpoint.widgetId)) {
                    widgetConnMap.set(endpoint.widgetId, new Set());
                }
                widgetConnMap.get(endpoint.widgetId).add(conn.id);
            }
        }
        state.widgets = state.widgets.map((w) => {
            const ids = widgetConnMap.get(w.id);
            return ids ? { ...w, connectorIds: [...ids] } : w;
        });
    }
    return state;
}
/**
 * Convenience: parse JSONL text and materialize in one step.
 *
 * @param {string} text - Raw JSONL file contents
 * @returns {object} Materialized canvas state
 */
export function materializeFromText(text) {
    return materialize(parseCanvasJsonl(text));
}
/** Strict, line-aware authoring validation. Playback remains tolerant for legacy JSONL. */
export function validateCanvasJsonl(text) {
    const events = [];
    const lines = [];
    const diagnostics = [];
    const rawLines = (text || '').split(/\r?\n/);
    for (let index = 0; index < rawLines.length; index++) {
        const line = (rawLines[index] || '').trim();
        if (!line)
            continue;
        try {
            events.push(JSON.parse(line));
            lines.push(index + 1);
        }
        catch {
            diagnostics.push({ code: 'malformed_json', line: index + 1, message: 'Line is not valid JSON.' });
        }
    }
    if (events.length === 0 || !isRecord(events[0]) || events[0].event !== 'canvas_created') {
        diagnostics.push({ code: 'missing_canvas_created', line: lines[0] || 1, message: 'The first event must be canvas_created.' });
    }
    for (let index = 1; index < events.length; index++) {
        const event = events[index];
        if (isRecord(event) && event.event === 'canvas_created') {
            diagnostics.push({ code: 'invalid_event', line: lines[index] || index + 1, event: 'canvas_created', message: 'A document may contain only one canvas_created event, at the beginning.' });
        }
    }
    if (diagnostics.length)
        return diagnostics;
    for (let index = 0; index < events.length; index++) {
        const event = events[index];
        if (!isRecord(event) || typeof event.event !== 'string') {
            diagnostics.push({ code: 'invalid_event', line: lines[index] || index + 1, message: 'Event must be an object with an event name.' });
            continue;
        }
        if (event.required === true && !isKnownCanvasEventName(event.event)) {
            diagnostics.push({ code: 'incompatible_required_event', line: lines[index] || index + 1, event: event.event, message: `Required canvas event "${event.event}" is not supported.` });
            continue;
        }
        if (event.event === 'canvas_created' && isRecord(event.scroll)
            && event.scroll.axis !== undefined
            && !['both', 'vertical', 'horizontal', 'none'].includes(String(event.scroll.axis))) {
            diagnostics.push({ code: 'invalid_event', line: lines[index] || index + 1, event: event.event, message: 'scroll.axis must be both, vertical, horizontal, or none.' });
            continue;
        }
        if (event.event === 'widget_moved'
            && (!isRecord(event.position)
                || !Number.isFinite(event.position.x)
                || !Number.isFinite(event.position.y))) {
            diagnostics.push({ code: 'invalid_event', line: lines[index] || index + 1, event: event.event, message: 'position.x and position.y must be finite numbers.' });
            continue;
        }
        try {
            const decoded = decodeCanvasEvent(event);
            const known = isKnownCanvasEventName(event.event) || event.event === 'canvas_created';
            if (known && !decoded) {
                diagnostics.push({ code: 'invalid_event', line: lines[index] || index + 1, event: event.event, message: `Invalid ${event.event} event.` });
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            diagnostics.push({
                code: message.includes('formatVersion') || message.includes('requires canvas formatVersion')
                    ? 'incompatible_format'
                    : message.includes('Unsupported required') ? 'incompatible_required_event' : 'invalid_event',
                line: lines[index] || index + 1, event: event.event, message,
            });
        }
    }
    if (!diagnostics.length) {
        try {
            materialize(events);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const parsedEventName = message.match(/Unsupported required canvas event: ([a-z_]+)/i)?.[1];
            const isCanvasLayoutFailure = message.includes('canvas_layout_updated')
                || message.includes('canvas_layout_restored')
                || message.includes('canvas layout')
                || message.includes('persisted JSX source');
            const index = parsedEventName
                ? events.findIndex((event) => isRecord(event) && event.event === parsedEventName)
                : isCanvasLayoutFailure
                    ? events.findIndex((event) => isRecord(event) && (event.event === 'canvas_layout_updated' || event.event === 'canvas_layout_restored'))
                    : events.findIndex((event) => isRecord(event) && event.event === 'canvas_created' && 'formatVersion' in event);
            const eventName = index >= 0 && isRecord(events[index]) ? String(events[index].event) : parsedEventName;
            diagnostics.push({
                code: message.includes('Unsupported canvas formatVersion') || message.includes('requires canvas formatVersion')
                    ? 'incompatible_format' : message.includes('Unsupported required canvas event')
                    ? 'incompatible_required_event' : 'invalid_event',
                line: lines[index >= 0 ? index : lines.length - 1] || 1,
                ...(eventName ? { event: eventName } : {}),
                message,
            });
        }
    }
    return diagnostics;
}
/**
 * Serialize a single event object to a JSONL line (no trailing newline).
 *
 * @param {object} event - Event object
 * @returns {string} Single-line JSON string
 */
export function serializeEvent(event) {
    assertSerializableCanvasEvent(event);
    return JSON.stringify(event);
}
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
