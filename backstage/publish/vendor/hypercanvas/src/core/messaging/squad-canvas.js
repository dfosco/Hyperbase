/** Canvas relationships used by Squad broadcast mode. Non-agent links never enroll members. */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { materializeFromText } from '../canvas/materializer.js';
import { toCanvasId } from '../canvas/identity.js';
import { appendCanvasEventRaw, assertCanvasWritable } from '../canvas/canvasEventWriter.js';
import { findBestAnchors } from '../canvas/collision.js';
const AGENT_TYPES = new Set(['agent', 'agent-chat', 'terminal']);
function fail(message, statusCode = 400) {
    throw Object.assign(new Error(message), { statusCode });
}
function layoutWidget(widget) {
    const x = widget.position?.x;
    const y = widget.position?.y;
    if (typeof widget.type !== 'string' || typeof x !== 'number' || !Number.isFinite(x)
        || typeof y !== 'number' || !Number.isFinite(y))
        fail(`Agent ${widget.id} has invalid canvas geometry`);
    return {
        id: widget.id, type: widget.type, position: { x, y },
        props: {
            ...(typeof widget.props?.width === 'number' ? { width: widget.props.width } : {}),
            ...(typeof widget.props?.height === 'number' ? { height: widget.props.height } : {}),
        },
    };
}
export function connectedAgentIds(canvas, widgetId, allowedIds) {
    const allowed = allowedIds ? new Set(allowedIds) : null;
    const ids = new Set((canvas.widgets || []).filter((widget) => AGENT_TYPES.has(typeof widget.type === 'string' ? widget.type : '')
        && (!allowed || allowed.has(widget.id))).map((widget) => widget.id));
    if (!ids.has(widgetId))
        return [];
    const peers = new Map();
    for (const connector of canvas.connectors || []) {
        const start = connector.start?.widgetId;
        const end = connector.end?.widgetId;
        if (!start || !end || !ids.has(start) || !ids.has(end))
            continue;
        peers.set(start, [...(peers.get(start) || []), end]);
        peers.set(end, [...(peers.get(end) || []), start]);
    }
    const found = new Set([widgetId]);
    for (const id of found)
        for (const peer of peers.get(id) || [])
            found.add(peer);
    return [...found].sort();
}
export function readSquadCanvas(root, canvasId, widgetId) {
    const files = [];
    function walk(directory) {
        if (!fs.existsSync(directory))
            return;
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (entry.isSymbolicLink() || entry.name.startsWith('.'))
                continue;
            const filePath = path.join(directory, entry.name);
            if (entry.isDirectory())
                walk(filePath);
            else if (entry.name.endsWith('.canvas.jsonl')) {
                const relative = path.relative(root, filePath).replace(/\\/g, '/');
                files.push({ filePath, canvasId: toCanvasId(/^(canvas|prototypes)\//.test(relative) ? `src/${relative}` : relative) });
            }
        }
    }
    for (const directory of ['canvas', 'src/canvas', 'prototypes', 'src/prototypes'])
        walk(path.join(root, directory));
    const candidates = canvasId ? files.filter((file) => file.canvasId === canvasId) : files;
    const matches = candidates.map((file) => ({ ...file, canvas: materializeFromText(fs.readFileSync(file.filePath, 'utf8')) }))
        .filter((file) => !widgetId || (file.canvas.widgets || []).some((widget) => widget.id === widgetId));
    if (matches.length > 1)
        fail('Widget or canvas is ambiguous; supply an exact canvas ID', 409);
    if (matches[0])
        return matches[0];
    if (canvasId || files.length > 0)
        fail('Squad agent widget was not found on the requested canvas', 404);
    return null;
}
export function wireSquadPeers(root, canvasId, leaderId, memberIds, wire = true) {
    const target = readSquadCanvas(root, canvasId, leaderId);
    if (!target)
        return null; // Headless rooms have no canvas relationship.
    const widgets = new Map((target.canvas.widgets || []).map((widget) => [widget.id, widget]));
    const ids = [...new Set([leaderId, ...memberIds])];
    for (const id of ids)
        if (!AGENT_TYPES.has(String(widgets.get(id)?.type || '')))
            fail(`Squad member ${id} must be an existing agent widget on ${target.canvasId}`);
    if (ids.length < 2)
        fail('A canvas Squad needs a leader and at least one peer; create peers first');
    assertCanvasWritable(target.filePath);
    const layouts = new Map(ids.map((id) => [id, layoutWidget(widgets.get(id))]));
    if (!wire)
        return target.canvasId;
    const leader = layouts.get(leaderId);
    for (const memberId of ids.filter((id) => id !== leaderId)) {
        if (target.canvas.connectors?.some((connector) => (connector.start?.widgetId === leaderId && connector.end?.widgetId === memberId)
            || (connector.start?.widgetId === memberId && connector.end?.widgetId === leaderId)))
            continue;
        const peer = layouts.get(memberId);
        const anchors = findBestAnchors(leader, peer);
        appendCanvasEventRaw(target.filePath, {
            event: 'connector_added', timestamp: new Date().toISOString(), id: `evt_${randomBytes(6).toString('hex')}`,
            connector: {
                id: `connector-${randomBytes(6).toString('hex')}`, type: 'connector', connectorType: 'default',
                start: { widgetId: leaderId, anchor: anchors.startAnchor },
                end: { widgetId: memberId, anchor: anchors.endAnchor }, meta: {},
            },
        });
    }
    return target.canvasId;
}
