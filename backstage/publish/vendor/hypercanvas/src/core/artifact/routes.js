/**
 * Artifact HTTP routes — REST API for artifact CRUD.
 *
 * Mounted at /_hypercanvas/artifact/ by server-plugin.js.
 *
 * Routes:
 *   POST   /           — Create artifact
 *   PATCH  /           — Edit artifact metadata
 *   DELETE /           — Delete artifact
 *   GET    /list       — List artifacts by type
 *   GET    /schema     — Get JSON Schema for a type
 */
import { createArtifact, editArtifact, deleteArtifact, listArtifacts } from './operations.js';
import { VALID_TYPES, loadSchema } from './validate.js';
import path from 'node:path';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isArtifactType(value) {
    return VALID_TYPES.includes(value);
}
function isOperationResult(value) {
    return isRecord(value) && typeof value.success === 'boolean';
}
function resultErrorMessage(result) {
    return typeof result.error === 'string' ? result.error : undefined;
}
function validationErrors(result) {
    return Array.isArray(result.errors) ? result.errors.filter(isRecord) : [];
}
function notifyArtifactChange(root, files, eventType) {
    const hook = Reflect.get(globalThis, '__HYPERCANVAS_NOTIFY_ARTIFACT_CHANGE__');
    if (typeof hook !== 'function' || !Array.isArray(files))
        return;
    for (const rel of files) {
        if (typeof rel !== 'string')
            continue;
        try {
            Reflect.apply(hook, undefined, [path.resolve(root, rel), eventType]);
        }
        catch { /* best-effort */ }
    }
}
export function createArtifactRoutes({ root, sendJson, deleteSite }) {
    return async function artifactHandler(req, res, ctx) {
        const method = typeof ctx.method === 'string' ? ctx.method : '';
        const subpath = typeof ctx.subpath === 'string' ? ctx.subpath : undefined;
        const pathValue = typeof ctx.path === 'string' ? ctx.path : undefined;
        const routePath = '/' + (subpath || pathValue || '').replace(/^\//, '');
        // GET /list?type=X
        if (method === 'GET' && routePath.startsWith('/list')) {
            const requestUrl = typeof req.url === 'string' ? req.url : '/';
            const url = new URL(requestUrl, 'http://localhost');
            const type = url.searchParams.get('type');
            const folder = url.searchParams.get('folder');
            const parentPath = url.searchParams.get('parentPath');
            if (type && !isArtifactType(type)) {
                sendJson(res, 400, { error: `Invalid type: "${type}". Valid: ${VALID_TYPES.join(', ')}` });
                return;
            }
            if (type) {
                const result = listArtifacts(type, { folder, parentPath }, root);
                sendJson(res, 200, result);
            }
            else {
                const results = {};
                for (const artifactType of VALID_TYPES) {
                    results[artifactType] = listArtifacts(artifactType, { folder, parentPath }, root).items;
                }
                sendJson(res, 200, { items: results });
            }
            return;
        }
        // GET /schema?type=X
        if (method === 'GET' && routePath.startsWith('/schema')) {
            const requestUrl = typeof req.url === 'string' ? req.url : '/';
            const url = new URL(requestUrl, 'http://localhost');
            const type = url.searchParams.get('type');
            if (!type || !isArtifactType(type)) {
                sendJson(res, 400, { error: `type query param required. Valid: ${VALID_TYPES.join(', ')}` });
                return;
            }
            const schema = loadSchema(type);
            if (!schema) {
                sendJson(res, 404, { error: `Schema not found for type: ${type}` });
                return;
            }
            sendJson(res, 200, schema);
            return;
        }
        // POST / — Create
        if (method === 'POST' && (routePath === '/' || routePath === '')) {
            const body = ctx.body;
            if (!isRecord(body) || !body.type) {
                sendJson(res, 400, { error: 'Request body must include "type"' });
                return;
            }
            if (typeof body.type !== 'string') {
                sendJson(res, 400, { error: 'Request body must include "type"' });
                return;
            }
            const { type, ...values } = body;
            const result = createArtifact(type, values, root);
            if (result.success) {
                notifyArtifactChange(root, result.files, 'add');
                sendJson(res, 201, result);
            }
            else {
                const errors = validationErrors(result);
                const status = errors.some(error => typeof error.message === 'string' && error.message.includes('already exists')) ? 409 : 400;
                sendJson(res, status, { error: (typeof errors[0]?.message === 'string' && errors[0].message) || 'Validation failed', errors: result.errors });
            }
            return;
        }
        // PATCH / — Edit
        if (method === 'PATCH' && (routePath === '/' || routePath === '')) {
            const body = ctx.body;
            if (!isRecord(body) || !body.type || !body.name) {
                sendJson(res, 400, { error: 'Request body must include "type" and "name"' });
                return;
            }
            if (typeof body.type !== 'string' || typeof body.name !== 'string') {
                sendJson(res, 400, { error: 'Request body must include "type" and "name"' });
                return;
            }
            if (body.name.trim().length === 0) {
                sendJson(res, 400, { error: 'Artifact update name must be a non-empty string' });
                return;
            }
            if (body.currentName !== undefined
                && (typeof body.currentName !== 'string' || body.currentName.trim().length === 0)) {
                sendJson(res, 400, { error: 'currentName must be a non-empty string when provided' });
                return;
            }
            const { type, name, currentName, ...metadata } = body;
            const lookupName = typeof currentName === 'string' ? currentName : name;
            const updates = currentName === undefined ? metadata : { ...metadata, name };
            const result = editArtifact(type, lookupName, updates, root);
            if (result.success) {
                notifyArtifactChange(root, result.files, 'change');
                sendJson(res, 200, result);
            }
            else {
                const error = resultErrorMessage(result);
                sendJson(res, error?.includes('not found') ? 404 : 400, { error });
            }
            return;
        }
        // DELETE / — Delete
        if (method === 'DELETE' && (routePath === '/' || routePath === '')) {
            const body = ctx.body;
            if (!isRecord(body) || !body.type || !body.name) {
                sendJson(res, 400, { error: 'Request body must include "type" and "name"' });
                return;
            }
            if (typeof body.type !== 'string' || typeof body.name !== 'string') {
                sendJson(res, 400, { error: 'Request body must include "type" and "name"' });
                return;
            }
            const { type, name, ...options } = body;
            const rawResult = type === 'site' && deleteSite
                ? await deleteSite(name, options)
                : await deleteArtifact(type, name, options, root);
            if (!isOperationResult(rawResult)) {
                sendJson(res, 500, { error: 'Artifact delete handler returned an invalid result' });
                return;
            }
            const result = rawResult;
            if (result.success) {
                notifyArtifactChange(root, result.files, 'unlink');
                sendJson(res, 200, result);
            }
            else {
                const error = resultErrorMessage(result);
                const status = result.code === 'CONFIRMATION_REQUIRED' ? 409
                    : error?.includes('not found') ? 404
                        : result.code === 'UNSUPPORTED_CANVAS_LOCATION' ? 409 : 400;
                sendJson(res, status, {
                    error,
                    ...(typeof result.code === 'string' ? { code: result.code } : {}),
                    ...(Array.isArray(result.affectedFiles) ? { affectedFiles: result.affectedFiles } : {}),
                    ...(typeof result.preservedProjectRoot === 'string' && result.preservedProjectRoot
                        ? { preservedProjectRoot: result.preservedProjectRoot }
                        : {}),
                });
            }
            return;
        }
        sendJson(res, 404, { error: `Unknown artifact route: ${method} ${routePath}` });
    };
}
