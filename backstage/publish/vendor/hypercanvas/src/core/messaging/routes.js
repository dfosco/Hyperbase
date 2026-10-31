/** HTTP boundary for the durable Squad ledger and generic event bus. */
import { legacySessionEnv as legacyEnv } from '../envCompat.js';
import { publish, subscribe, read, readMulti } from './bus.js';
import { negotiateFormat, serializeResponse, parseRequestBody } from './toon.js';
import { SquadService } from './squad-service.js';
import { deliverSquadEntry } from './squad-delivery.js';
import { validateSquadMessage } from './squad-ledger.js';
import process from 'node:process';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function routeError(message, statusCode) {
    const error = new Error(message);
    if (statusCode !== undefined)
        error.statusCode = statusCode;
    return error;
}
const sseConnections = new Set();
const SSE_HEARTBEAT_INTERVAL = 30_000;
export function createMessagingRoutes({ sendJson, getSquadContext = null, getSquadDeliveryOptions = null, }) {
    return async (req, res, ctx) => {
        const { method, path: routePath, body } = ctx;
        const subpath = (routePath || '/').replace(/^\//, '').split('?')[0] ?? '';
        try {
            if (method === 'POST' && subpath === 'publish')
                return handlePublish(req, res, body, sendJson);
            if (method === 'POST' && subpath === 'send')
                return handleSend(req, res, body, sendJson);
            if (method === 'POST' && subpath === 'batch')
                return handleBatch(req, res, body);
            if (method === 'GET' && (subpath === 'subscribe' || subpath.startsWith('subscribe/')))
                return handleSubscribe(req, res, ctx, sendJson);
            if (method === 'GET' && (subpath === 'read' || subpath.startsWith('read/')))
                return handleRead(req, res, ctx, sendJson);
            if (subpath === 'broadcast' && method === 'POST') {
                const fields = await parsedBody(req, body);
                const service = await squadService(getSquadContext);
                if (typeof fields.canvasId !== 'string' || typeof fields.widgetId !== 'string' || typeof fields.enabled !== 'boolean'
                    || (fields.squadId !== undefined && typeof fields.squadId !== 'string')) {
                    return sendJson(res, 400, { error: 'canvasId, widgetId and boolean enabled are required; squadId must be a string' });
                }
                const squad = await service.setBroadcast(fields.canvasId, fields.widgetId, fields.enabled, fields.squadId);
                return sendNegotiated(req, res, 200, { ok: true, squad });
            }
            if (subpath === 'squads' && method === 'POST')
                return await handleSquadCreate(req, res, body, sendJson, getSquadContext);
            if (subpath === 'squads' && method === 'GET')
                return await handleSquadList(req, res, ctx, sendJson, getSquadContext);
            if (subpath.startsWith('squad/')) {
                return await handleSquadRoute(req, res, ctx, body, sendJson, getSquadContext, getSquadDeliveryOptions);
            }
            sendJson(res, 404, { error: `Unknown messaging route: ${method} ${subpath}` });
        }
        catch (error) {
            const statusCode = isRecord(error) && typeof error.statusCode === 'number' ? error.statusCode : 500;
            const message = error instanceof Error ? error.message : 'Internal messaging error';
            sendJson(res, statusCode || 500, { error: message || 'Internal messaging error' });
        }
    };
}
async function squadService(getSquadContext) {
    if (typeof getSquadContext !== 'function')
        throw new Error('Squad service is unavailable without a verified Notebook/Paseo binding');
    const context = await getSquadContext();
    if (!context?.root || !context?.workspaceId || !context?.daemonId) {
        throw new Error('A verified Notebook workspace and Paseo daemon are required');
    }
    return new SquadService(context);
}
async function deliverCommittedEntry(service, squadId, entry, widgetId, getOptions, { force = false } = {}) {
    try {
        const options = await getOptions?.({ root: service.root, squadId, widgetId }) || {};
        return await deliverSquadEntry(service, squadId, entry, { ...options, force });
    }
    catch (error) {
        const reason = error instanceof Error ? error.message || String(error) : String(error);
        const results = [];
        const recipients = Array.isArray(entry.to) ? entry.to : [];
        for (const recipient of recipients) {
            try {
                await service.appendSystemEvent(squadId, 'system.delivery.attempt', `Delivery failed for entry ${entry.number}`, {
                    number: entry.number, recipient, state: 'failed', reason: reason.slice(0, 500),
                });
                results.push({ recipient, status: 'failed', error: reason });
            }
            catch (auditError) {
                const auditMessage = auditError instanceof Error ? auditError.message : String(auditError);
                results.push({ recipient, status: 'indeterminate', error: `Delivery failed: ${reason}; audit failed: ${auditMessage}` });
            }
        }
        return results;
    }
}
async function handleSquadCreate(req, res, body, sendJson, getSquadContext) {
    const parsed = await parsedBody(req, body);
    const service = await squadService(getSquadContext);
    const widgetId = parsed.widgetId || (process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID'));
    const squad = await service.create({
        leaderId: widgetId,
        memberIds: (parsed.memberIds || []),
        name: (parsed.name ?? null),
        canvasId: (parsed.canvasId ?? null),
    });
    return sendNegotiated(req, res, 201, { ok: true, squad });
}
async function handleSquadList(req, res, ctx, sendJson, getSquadContext) {
    const url = new URL(`http://localhost${ctx.path || '/'}`);
    const widgetId = url.searchParams.get('widgetId') || (process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID'));
    const service = await squadService(getSquadContext);
    return sendNegotiated(req, res, 200, { squads: await service.list(widgetId || null) });
}
async function handleSquadRoute(req, res, ctx, body, sendJson, getSquadContext, getSquadDeliveryOptions) {
    const url = new URL(`http://localhost${ctx.path || '/'}`);
    const requestPath = (ctx.path || '/').split('?')[0] ?? '/';
    const parts = requestPath.split('/').filter(Boolean);
    const squadId = decodeURIComponent(parts[1] || '');
    const action = parts[2];
    const service = await squadService(getSquadContext);
    const widgetId = url.searchParams.get('widgetId') || (process.env.HYPERCANVAS_WIDGET_ID ?? legacyEnv('STORYBOARD_WIDGET_ID'));
    if (!squadId || !widgetId)
        return sendJson(res, 400, { error: 'Squad ID and widgetId are required' });
    if (action === 'entry' && parts[3] && parts[4] === 'deliver' && methodIs(ctx, 'POST')) {
        const bodyFields = await parsedBody(req, body);
        const number = Number(parts[3]);
        const force = bodyFields.force === true;
        const { entry } = await service.authorizeDeliveryRetry(squadId, widgetId, number, { force });
        const delivery = await deliverCommittedEntry(service, squadId, entry, widgetId, getSquadDeliveryOptions, { force });
        return sendNegotiated(req, res, 200, { ok: true, entry, delivery });
    }
    if (action === 'entry' && !parts[3] && methodIs(ctx, 'POST')) {
        const parsed = await parsedBody(req, body);
        const validation = validateSquadMessage(parsed);
        if (!validation.valid)
            throw routeError(validation.errors.join('; '), 400);
        const entry = await service.append(squadId, widgetId, parsed);
        const delivery = entry.inject === true
            ? await deliverCommittedEntry(service, squadId, entry, widgetId, getSquadDeliveryOptions)
            : [];
        return sendNegotiated(req, res, 201, { ok: true, entry, delivery });
    }
    if (action === 'leader' && methodIs(ctx, 'POST')) {
        const parsed = await parsedBody(req, body);
        const squad = await service.promoteLeader(squadId, widgetId, parsed.targetWidgetId);
        return sendNegotiated(req, res, 200, { ok: true, squad });
    }
    if (action === 'nudge' && methodIs(ctx, 'POST')) {
        const parsed = await parsedBody(req, body);
        const entry = await service.nudgeMember(squadId, widgetId, parsed.targetWidgetId, parsed.description);
        const delivery = await deliverCommittedEntry(service, squadId, entry, widgetId, getSquadDeliveryOptions);
        return sendNegotiated(req, res, 201, { ok: true, entry, delivery });
    }
    if (action === 'room' && methodIs(ctx, 'GET')) {
        const after = Number(url.searchParams.get('after') || 0);
        const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined;
        if (!Number.isSafeInteger(after) || after < 0 || (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))) {
            return sendJson(res, 400, { error: 'after and limit must be valid non-negative/positive integers' });
        }
        return sendNegotiated(req, res, 200, {
            squadId,
            entries: await service.read(squadId, widgetId, { after, ...(limit !== undefined ? { limit } : {}) }),
        });
    }
    if (action === 'reconcile' && methodIs(ctx, 'GET')) {
        return sendNegotiated(req, res, 200, { squadId, work: await service.reconcile(squadId, widgetId) });
    }
    if (action === 'entry' && parts[3] && methodIs(ctx, 'GET')) {
        const number = Number(parts[3]);
        const entry = await service.get(squadId, widgetId, number);
        return entry
            ? sendNegotiated(req, res, 200, { squadId, entry })
            : sendJson(res, 404, { error: `Ledger entry ${parts[3]} not found` });
    }
    return sendJson(res, 404, { error: `Unknown Squad route: ${ctx.method} ${ctx.path}` });
}
function methodIs(ctx, method) {
    return ctx.method === method;
}
async function parsedBody(req, body) {
    const parsed = await parseRequestBody(body, req.headers?.['content-type']);
    if (!isRecord(parsed))
        throw new Error('Request body must be an object');
    return parsed;
}
async function handlePublish(req, res, body, sendJson) {
    const parsed = await parsedBody(req, body);
    if (typeof parsed.channel !== 'string' || !parsed.channel)
        return sendJson(res, 400, { error: 'Missing required field: channel' });
    const event = await publish(parsed.channel, parsed);
    return sendNegotiated(req, res, 201, { ok: true, event });
}
async function handleSend(req, res, body, sendJson) {
    const parsed = await parsedBody(req, body);
    if (typeof parsed.channel !== 'string' || !parsed.channel)
        return sendJson(res, 400, { error: 'Missing required field: channel' });
    const channel = parsed.channel;
    const timeout = typeof parsed.timeout === 'number' ? parsed.timeout : 30_000;
    delete parsed.timeout;
    const requestEvent = await publish(channel, { ...parsed, status: parsed.status || 'pending' });
    const result = await new Promise((resolve) => {
        let timer;
        const unsub = subscribe(channel, (event) => {
            if (event.correlationId !== requestEvent.id || event.id === requestEvent.id)
                return;
            clearTimeout(timer);
            unsub();
            resolve({ ok: true, response: event });
        });
        timer = setTimeout(() => { unsub(); resolve({ ok: false, error: 'timeout', timeout }); }, timeout);
    });
    return sendNegotiated(req, res, result.ok ? 200 : 408, result);
}
async function handleBatch(req, res, body) {
    const parsed = await parsedBody(req, body);
    const result = { published: [], read: {} };
    const publishFields = Array.isArray(parsed.publish) ? parsed.publish : [];
    for (const fields of publishFields) {
        if (!isRecord(fields))
            continue;
        if (typeof fields.channel === 'string' && fields.channel)
            result.published.push(await publish(fields.channel, fields));
    }
    if (Array.isArray(parsed.read)) {
        for (const options of parsed.read) {
            if (isRecord(options) && typeof options.channel === 'string' && options.channel) {
                result.read[options.channel] = await read(options.channel, options);
            }
        }
    }
    else if (isRecord(parsed.read) && Array.isArray(parsed.read.channels)) {
        const requestedChannels = parsed.read.channels;
        const channels = requestedChannels.filter((channel) => typeof channel === 'string');
        Object.assign(result.read, await readMulti(channels, parsed.read));
    }
    return sendNegotiated(req, res, 200, result);
}
function handleSubscribe(req, res, ctx, sendJson) {
    const url = new URL(`http://localhost${ctx.path || '/'}`);
    const subpath = (ctx.path || '/').replace(/^\//, '').split('?')[0] ?? '';
    const channel = subpath.startsWith('subscribe/') ? decodeURIComponent(subpath.slice(10)) : url.searchParams.get('channel');
    if (!channel)
        return sendJson(res, 400, { error: 'Missing channel' });
    const type = url.searchParams.get('type') || undefined;
    const since = req.headers?.['last-event-id'] || url.searchParams.get('since') || undefined;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders?.();
    if (since)
        read(channel, { since, ...(type ? { type } : {}) }).then((events) => events.forEach((event) => writeSseEvent(res, event))).catch(() => { });
    const unsub = subscribe(channel, (event) => {
        if (res.destroyed)
            return unsub();
        if (!type || event.type?.startsWith(type))
            writeSseEvent(res, event);
    });
    const timer = setInterval(() => { if (!res.destroyed)
        res.write?.(':\n\n'); }, SSE_HEARTBEAT_INTERVAL);
    const connection = { res, unsub, timer };
    sseConnections.add(connection);
    const close = () => { unsub(); clearInterval(timer); sseConnections.delete(connection); };
    res.on?.('close', close);
    res.on?.('error', close);
}
function writeSseEvent(res, event) {
    if (!res.destroyed)
        res.write?.(`id: ${event.id}\nevent: message\ndata: ${JSON.stringify(event)}\n\n`);
}
async function handleRead(req, res, ctx, sendJson) {
    const url = new URL(`http://localhost${ctx.path || '/'}`);
    const subpath = (ctx.path || '/').replace(/^\//, '').split('?')[0] ?? '';
    const pathChannel = subpath.startsWith('read/') ? decodeURIComponent(subpath.slice(5)) : null;
    const channels = url.searchParams.get('channels');
    const since = url.searchParams.get('since');
    const limit = url.searchParams.get('limit');
    const type = url.searchParams.get('type');
    const options = {
        ...(since ? { since } : {}),
        ...(limit ? { limit: Number(limit) } : {}),
        ...(type ? { type } : {}),
    };
    if (channels)
        return sendNegotiated(req, res, 200, await readMulti(channels.split(',').map((value) => value.trim()).filter(Boolean), options));
    const channel = pathChannel || url.searchParams.get('channel');
    if (!channel)
        return sendJson(res, 400, { error: 'Missing channel' });
    return sendNegotiated(req, res, 200, { channel, events: await read(channel, options) });
}
async function sendNegotiated(req, res, status, data) {
    const { body, contentType } = await serializeResponse(data, negotiateFormat(req));
    res.writeHead(status, { 'Content-Type': contentType });
    res.end(body);
}
export function closeAllSseConnections() {
    for (const connection of sseConnections) {
        connection.unsub();
        clearInterval(connection.timer);
        if (!connection.res.destroyed)
            connection.res.end();
    }
    sseConnections.clear();
}
