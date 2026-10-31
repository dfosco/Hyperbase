import { preflightHostTools } from './preflight.js';
/** Read-only host diagnostics. Hypercanvas does not install or repair agent CLIs. */
export function createHostToolsHandler({ preflight = preflightHostTools, sendJson, } = {}) {
    if (typeof sendJson !== 'function')
        throw new TypeError('sendJson is required');
    return async function hostToolsHandler(req, res, ctx = {}) {
        const method = ctx.method || req.method || 'GET';
        const path = String(ctx.path || '/').split('?', 1)[0] || '/';
        if (method !== 'GET' || path !== '/preflight') {
            sendJson(res, 404, { error: { code: 'ROUTE_NOT_FOUND', message: `Unknown host tools route: ${method} ${path}` } });
            return;
        }
        try {
            sendJson(res, 200, await preflight());
        }
        catch {
            sendJson(res, 500, { error: { code: 'HOST_TOOLS_FAILED', message: 'Host tool diagnostics failed' } });
        }
    };
}
