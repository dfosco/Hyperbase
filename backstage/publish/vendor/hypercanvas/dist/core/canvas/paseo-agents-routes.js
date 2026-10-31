/**
 * Paseo Agents API routes — mounted at /_hypercanvas/paseo-agents/.
 *
 * Same-origin proxy in front of the Paseo daemon so daemon credentials never
 * reach the browser. All route inputs are validated before hitting the SDK.
 *
 * Routes:
 *   GET  /health            — runtime + connection diagnostics
 *   GET  /providers         — available providers (pre-launch picker)
 *   GET  /providers/models  — models for ?provider=
 *   GET  /agents            — list agents (optional ?subscribe=1)
 *   GET  /agents/:id        — refresh + fetch one agent snapshot
 *   POST /agents            — create agent { config: { provider, model, ... }, title, context: { workspaceId } }
 *   POST /agents/:id/send   — send message { text, messageId }
 *   POST /agents/:id/cancel — interrupt the active turn
 *   POST /agents/:id/permission — respond { requestId, response: { behavior, ... } }
 *   POST /agents/:id/timeline   — refetch timeline { direction, cursor, limit, projection }
 *   POST /agents/:id/archive    — archive agent
 *
 * Agent/timeline events reach the browser via the Vite custom HMR event
 * `storyboard:paseo-agent-event` (see paseo-agent-runtime.js).
 */
import { getPaseoAgentRuntime, MAX_TEXT_LENGTH } from './paseo-agent-runtime.js';
import { getPaseoConnectionDiagnostics } from './paseo-runtime-client.js';
const UUID_LIKE = /^[A-Za-z0-9_-]{1,128}$/;
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function safeId(value) {
    if (typeof value !== 'string' || !UUID_LIKE.test(value))
        return null;
    return value;
}
function sendErr(sendJson, res, status, message, code) {
    return sendJson(res, status, { error: message, ...(code ? { code } : {}) });
}
function errorMessage(error) {
    return isRecord(error) && typeof error.message === 'string' ? error.message : 'Paseo agents request failed';
}
function errorCode(error) {
    return isRecord(error) ? error.code : undefined;
}
export function createPaseoAgentsHandler(ctx) {
    const { root, sendJson, wsSend, workspaceIdResolver } = ctx;
    async function requireRuntime(res) {
        const runtime = await getPaseoAgentRuntime({
            root,
            ...(wsSend === undefined ? {} : { wsSend }),
            ...(workspaceIdResolver === undefined ? {} : { workspaceIdResolver }),
        });
        if (!runtime) {
            const diagnostics = getPaseoConnectionDiagnostics();
            if (diagnostics.lastError && !diagnostics.lastError.includes('Paseo SDK is unavailable')) {
                sendJson(res, 503, {
                    error: diagnostics.lastError,
                    code: 'DAEMON_UNAVAILABLE',
                    diagnostics,
                });
            }
            else {
                sendJson(res, 503, {
                    error: diagnostics.lastError || 'Paseo SDK unavailable. Install @getpaseo/client@0.8.0-beta.1.',
                    code: 'SDK_UNAVAILABLE',
                    diagnostics,
                });
            }
            return null;
        }
        return runtime;
    }
    return async function paseoAgentsHandler(_req, res, { body = {}, path, method }) {
        // Path arrives without the /paseo-agents prefix (e.g. '/agents/xyz/send')
        // and may carry a query string.
        const pathValue = typeof path === 'string' ? path : '/';
        const parsedPath = new URL(`http://x${pathValue}`, 'http://x');
        const query = parsedPath.searchParams;
        const segments = parsedPath.pathname.split('/').filter(Boolean);
        const [head, id, action] = segments;
        const agentId = safeId(id);
        try {
            if (head === 'health' && method === 'GET') {
                const runtime = await requireRuntime(res);
                if (!runtime)
                    return;
                return sendJson(res, 200, await runtime.health());
            }
            if (head === 'providers') {
                if (method !== 'GET')
                    return sendErr(sendJson, res, 405, 'Method not allowed');
                const runtime = await requireRuntime(res);
                if (!runtime)
                    return;
                if (id === 'models') {
                    const provider = query.get('provider');
                    if (!provider)
                        return sendErr(sendJson, res, 400, 'provider query param is required');
                    return sendJson(res, 200, await runtime.listModels(provider));
                }
                return sendJson(res, 200, await runtime.listAvailableProviders());
            }
            if (head === 'agents') {
                if (method === 'GET' && !agentId) {
                    const runtime = await requireRuntime(res);
                    if (!runtime)
                        return;
                    const subscribe = query.get('subscribe') === '1';
                    const result = await runtime.listAgents({ subscribe });
                    return sendJson(res, 200, { entries: result.entries || [], pageInfo: result.pageInfo || null });
                }
                if (method === 'POST' && !agentId && !action) {
                    const runtime = await requireRuntime(res);
                    if (!runtime)
                        return;
                    if (!isRecord(body))
                        return sendErr(sendJson, res, 400, 'body must be an object');
                    const { config, title, context } = body;
                    if (!isRecord(config) || typeof config.provider !== 'string' || !config.provider) {
                        return sendErr(sendJson, res, 400, 'config.provider is required');
                    }
                    if (title !== undefined && typeof title !== 'string') {
                        return sendErr(sendJson, res, 400, 'title must be a string');
                    }
                    if (context !== undefined && (typeof context !== 'object' || context === null || Array.isArray(context))) {
                        return sendErr(sendJson, res, 400, 'context must be an object when provided');
                    }
                    const contextRecord = isRecord(context) ? context : undefined;
                    if (contextRecord?.widgetId !== undefined && (typeof contextRecord.widgetId !== 'string' || !safeId(contextRecord.widgetId))) {
                        return sendErr(sendJson, res, 400, 'context.widgetId must be a valid widget id');
                    }
                    if (contextRecord?.workspaceId !== undefined && (typeof contextRecord.workspaceId !== 'string' || !safeId(contextRecord.workspaceId))) {
                        return sendErr(sendJson, res, 400, 'context.workspaceId must be a valid workspace id');
                    }
                    const workspaceId = await runtime.resolveWorkspaceId();
                    if (!workspaceId)
                        return sendErr(sendJson, res, 400, 'The active Notebook has no Paseo workspace', 'WORKSPACE_REQUIRED');
                    if (contextRecord?.workspaceId && contextRecord.workspaceId !== workspaceId) {
                        return sendErr(sendJson, res, 409, 'context.workspaceId does not match the active Notebook', 'WORKSPACE_MISMATCH');
                    }
                    const result = await runtime.createAgent({
                        config,
                        ...(title !== undefined ? { title } : {}),
                        context: { ...(contextRecord || {}), workspaceId },
                    });
                    return sendJson(res, 200, result);
                }
                if (!agentId)
                    return sendErr(sendJson, res, 400, 'Invalid agent id', 'BAD_AGENT_ID');
                if (method === 'GET' && !action) {
                    const runtime = await requireRuntime(res);
                    if (!runtime)
                        return;
                    return sendJson(res, 200, await runtime.getAgent(agentId));
                }
                if (method === 'POST' && action) {
                    const runtime = await requireRuntime(res);
                    if (!runtime)
                        return;
                    if (action === 'send') {
                        if (!isRecord(body))
                            return sendErr(sendJson, res, 400, 'body must be an object');
                        const { text, messageId } = body;
                        if (typeof text !== 'string' || !text.trim()) {
                            return sendErr(sendJson, res, 400, 'text is required');
                        }
                        if (text.length > MAX_TEXT_LENGTH) {
                            return sendErr(sendJson, res, 413, `text exceeds ${MAX_TEXT_LENGTH} characters`);
                        }
                        if (messageId != null && typeof messageId !== 'string') {
                            return sendErr(sendJson, res, 400, 'messageId must be a string');
                        }
                        return sendJson(res, 200, await runtime.sendMessage(agentId, text, typeof messageId === 'string' ? { messageId } : {}));
                    }
                    if (action === 'cancel') {
                        return sendJson(res, 200, await runtime.cancelTurn(agentId));
                    }
                    if (action === 'permission') {
                        if (!isRecord(body))
                            return sendErr(sendJson, res, 400, 'body must be an object');
                        const { requestId, response } = body;
                        if (typeof requestId !== 'string' || !requestId) {
                            return sendErr(sendJson, res, 400, 'requestId is required');
                        }
                        if (!isRecord(response)) {
                            return sendErr(sendJson, res, 400, 'response is required');
                        }
                        if (response.behavior !== 'allow' && response.behavior !== 'deny') {
                            return sendErr(sendJson, res, 400, 'response.behavior must be "allow" or "deny"');
                        }
                        return sendJson(res, 200, await runtime.respondToPermission(agentId, { requestId, response: response }));
                    }
                    if (action === 'timeline') {
                        if (!isRecord(body))
                            return sendErr(sendJson, res, 400, 'body must be an object');
                        const { direction, cursor, limit, projection } = body;
                        if (direction && (typeof direction !== 'string' || !['tail', 'before', 'after'].includes(direction))) {
                            return sendErr(sendJson, res, 400, 'direction must be tail, before, or after');
                        }
                        if (projection && (typeof projection !== 'string' || !['projected', 'canonical'].includes(projection))) {
                            return sendErr(sendJson, res, 400, 'projection must be projected or canonical');
                        }
                        if (cursor && (!isRecord(cursor) || typeof cursor.epoch !== 'string' || typeof cursor.seq !== 'number' || !Number.isFinite(cursor.seq))) {
                            return sendErr(sendJson, res, 400, 'cursor must be { epoch: string, seq: number }');
                        }
                        if (limit !== undefined && typeof limit !== 'number' && typeof limit !== 'string') {
                            return sendErr(sendJson, res, 400, 'limit must be a number');
                        }
                        return sendJson(res, 200, await runtime.fetchTimeline(agentId, {
                            ...(typeof direction === 'string' ? { direction } : {}),
                            cursor,
                            ...(limit === undefined ? {} : { limit: Number(limit) }),
                            ...(typeof projection === 'string' ? { projection } : {}),
                        }));
                    }
                    if (action === 'archive') {
                        return sendJson(res, 200, await runtime.archiveAgent(agentId));
                    }
                    return sendErr(sendJson, res, 404, `Unknown action: ${action}`);
                }
                return sendErr(sendJson, res, 405, 'Method not allowed');
            }
            return sendErr(sendJson, res, 404, `Unknown paseo-agents route: ${pathValue}`);
        }
        catch (error) {
            const message = errorMessage(error);
            // Connection-level failures surface as 503 so the client store can
            // show a recoverable daemon-unavailable state instead of a generic 500.
            const diagnostics = getPaseoConnectionDiagnostics();
            if (errorCode(error) === 'PASEO_UNAVAILABLE'
                || ['connecting', 'disconnected', 'disposed'].includes(diagnostics.status)
                || /ECONNREFUSED|transport not connected|connection (?:lost|closed|refused|timed out)/i.test(message)) {
                return sendJson(res, 503, {
                    error: 'Paseo daemon is unavailable; Hypercanvas will reconnect automatically when it returns.',
                    code: 'DAEMON_UNAVAILABLE',
                    diagnostics,
                });
            }
            return sendErr(sendJson, res, 500, message);
        }
    };
}
